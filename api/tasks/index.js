const { sql, getPool, resetPool } = require('../shared/database');

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query(`
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = @tableName`);

    return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function getExistingColumn(columns, candidates = []) {
    for (const candidate of candidates) {
        if (hasColumn(columns, candidate)) {
            return candidate;
        }
    }
    return null;
}

function toNullableInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

async function resolveUserId(pool, key) {
    if (key === null || key === undefined) return null;
    const keyStr = String(key).trim();
    if (!keyStr) return null;
    const numericId = Number(keyStr);
    if (Number.isFinite(numericId) && Number.isInteger(numericId)) return numericId;

    const result = await pool.request()
        .input('key', sql.NVarChar, keyStr)
        .query(`SELECT TOP 1 Id FROM Users WHERE IsActive = 1 AND (
                    Username = @key OR
                    WorkEmail = @key OR
                    PersonalEmail = @key OR
                    LTRIM(RTRIM(CONCAT(FirstName, ' ', LastName))) = @key
                )`);

    return result.recordset[0]?.Id || null;
}

async function ensureTasksTable(pool) {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Tasks') AND type = 'U')
        BEGIN
            CREATE TABLE Tasks (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Title NVARCHAR(255) NOT NULL,
                Description NVARCHAR(MAX),
                Category NVARCHAR(50),
                Priority NVARCHAR(20) NOT NULL DEFAULT 'Medium',
                Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
                DueDate DATE,
                DueTime NVARCHAR(10),
                AssignedToId INT,
                AssignedById INT,
                ClinicId INT,
                CompletedDate DATETIME2,
                CompletedById INT,
                Notes NVARCHAR(MAX),
                Tags NVARCHAR(MAX),
                IsRecurring BIT DEFAULT 0,
                RecurrenceRule NVARCHAR(255),
                TaskType NVARCHAR(50) DEFAULT 'Regular',
                IsPaid BIT DEFAULT 0,
                PayAmount DECIMAL(10,2),
                Location NVARCHAR(100),
                TimeEstimate NVARCHAR(50),
                Assignee NVARCHAR(100),
                ClaimedBy NVARCHAR(100),
                ClaimedAt DATETIME,
                ComplianceFlag BIT DEFAULT 0,
                LinkedComplianceId INT,
                LinkedComplianceTitle NVARCHAR(255),
                LinkedComplianceStatus NVARCHAR(50),
                CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
                ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
            );
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TaskType')
            ALTER TABLE Tasks ADD TaskType NVARCHAR(50) DEFAULT 'Regular';
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'IsPaid')
            ALTER TABLE Tasks ADD IsPaid BIT DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'PayAmount')
            ALTER TABLE Tasks ADD PayAmount DECIMAL(10,2) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Location')
            ALTER TABLE Tasks ADD Location NVARCHAR(100) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TimeEstimate')
            ALTER TABLE Tasks ADD TimeEstimate NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Assignee')
            ALTER TABLE Tasks ADD Assignee NVARCHAR(100) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedBy')
            ALTER TABLE Tasks ADD ClaimedBy NVARCHAR(100) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedAt')
            ALTER TABLE Tasks ADD ClaimedAt DATETIME NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ComplianceFlag')
            ALTER TABLE Tasks ADD ComplianceFlag BIT DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceId')
            ALTER TABLE Tasks ADD LinkedComplianceId INT NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceTitle')
            ALTER TABLE Tasks ADD LinkedComplianceTitle NVARCHAR(255) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceStatus')
            ALTER TABLE Tasks ADD LinkedComplianceStatus NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'DueTime')
            ALTER TABLE Tasks ADD DueTime NVARCHAR(10) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ModifiedDate')
            ALTER TABLE Tasks ADD ModifiedDate DATETIME2 DEFAULT GETUTCDATE();
    `);
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        await ensureTasksTable(pool);
        const id = req.params.id;
        const taskColumns = await getTableColumns(pool, 'Tasks');
        const hasModifiedDate = hasColumn(taskColumns, 'ModifiedDate');
        const complianceFlagColumn = getExistingColumn(taskColumns, ['ComplianceFlag']);
        const linkedComplianceIdColumn = getExistingColumn(taskColumns, ['LinkedComplianceId', 'ComplianceId']);
        const linkedComplianceTitleColumn = getExistingColumn(taskColumns, ['LinkedComplianceTitle', 'ComplianceTitle']);
        const linkedComplianceStatusColumn = getExistingColumn(taskColumns, ['LinkedComplianceStatus', 'ComplianceStatus']);

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM Tasks WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                // Support filtering by TaskType
                const taskType = req.query.taskType;
                let query = 'SELECT * FROM Tasks';
                if (taskType) {
                    query += ' WHERE TaskType = @taskType';
                }
                query += ' ORDER BY DueDate, Priority';
                
                const request = pool.request();
                if (taskType) {
                    request.input('taskType', sql.NVarChar, taskType);
                }
                const result = await request.query(query);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const providedAssignedById = Number.isFinite(Number(body.assignedById)) ? Number(body.assignedById) : null;
            const assignedByKey = body.assignedBy || body.createdBy || body.createdByUsername || body.createdByUser || body.assignedByName || body.assignedByEmail || null;
            const resolvedAssignedById = providedAssignedById || await resolveUserId(pool, assignedByKey);
            const insertDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar, value: body.title },
                { column: 'Description', param: 'description', type: sql.NVarChar, value: body.description || null },
                { column: 'Category', param: 'category', type: sql.NVarChar, value: body.category || null },
                { column: 'Priority', param: 'priority', type: sql.NVarChar, value: body.priority || 'Medium' },
                { column: 'Status', param: 'status', type: sql.NVarChar, value: body.status || 'Pending' },
                { column: 'DueDate', param: 'dueDate', type: sql.Date, value: body.dueDate || null },
                { column: 'DueTime', param: 'dueTime', type: sql.NVarChar, value: body.dueTime || null },
                { column: 'AssignedToId', param: 'assignedToId', type: sql.Int, value: body.assignedToId || null },
                { column: 'AssignedById', param: 'assignedById', type: sql.Int, value: resolvedAssignedById },
                { column: 'ClinicId', param: 'clinicId', type: sql.Int, value: body.clinicId || null },
                { column: 'TaskType', param: 'taskType', type: sql.NVarChar, value: body.taskType || 'Regular' },
                { column: 'IsPaid', param: 'isPaid', type: sql.Bit, value: !!body.isPaid },
                { column: 'PayAmount', param: 'payAmount', type: sql.Decimal(10,2), value: body.payAmount || null },
                { column: 'Location', param: 'location', type: sql.NVarChar, value: body.location || null },
                { column: 'TimeEstimate', param: 'timeEstimate', type: sql.NVarChar, value: body.timeEstimate || null },
                { column: 'Assignee', param: 'assignee', type: sql.NVarChar, value: body.assignee || null }
            ].filter((def) => hasColumn(taskColumns, def.column));

            if (complianceFlagColumn) {
                insertDefs.push({ column: complianceFlagColumn, param: 'complianceFlag', type: sql.Bit, value: !!body.complianceFlag });
            }
            if (linkedComplianceIdColumn) {
                insertDefs.push({ column: linkedComplianceIdColumn, param: 'linkedComplianceId', type: sql.Int, value: toNullableInt(body.linkedComplianceId) });
            }
            if (linkedComplianceTitleColumn) {
                insertDefs.push({ column: linkedComplianceTitleColumn, param: 'linkedComplianceTitle', type: sql.NVarChar(255), value: body.linkedComplianceTitle || null });
            }
            if (linkedComplianceStatusColumn) {
                insertDefs.push({ column: linkedComplianceStatusColumn, param: 'linkedComplianceStatus', type: sql.NVarChar(50), value: body.linkedComplianceStatus || null });
            }

            if (!insertDefs.length) {
                context.res = { status: 500, headers, body: { error: 'Tasks schema mismatch: no insertable columns found.' } };
                return;
            }

            const insertRequest = pool.request();
            insertDefs.forEach((def) => insertRequest.input(def.param, def.type, def.value));

            const insertColumns = insertDefs.map((def) => def.column).join(', ');
            const insertValues = insertDefs.map((def) => `@${def.param}`).join(', ');
            const result = await insertRequest.query(`INSERT INTO Tasks (${insertColumns}) OUTPUT INSERTED.Id VALUES (${insertValues})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            const providedAssignedById = Number.isFinite(Number(body.assignedById)) ? Number(body.assignedById) : null;
            const assignedByKey = body.assignedBy || body.createdBy || body.createdByUsername || body.createdByUser || body.assignedByName || body.assignedByEmail || null;
            const resolvedAssignedById = providedAssignedById || await resolveUserId(pool, assignedByKey);

            // Atomic claim/unclaim to prevent races across users.
            const claimAction = body?.claimAction;
            const actorKey = body?.actorKey;
            if (claimAction === 'claim') {
                if (!actorKey || typeof actorKey !== 'string') {
                    context.res = { status: 400, headers, body: { error: 'actorKey is required' } };
                    return;
                }

                const claimResult = await pool.request()
                    .input('id', sql.Int, id)
                    .input('actorKey', sql.NVarChar, actorKey)
                    .input('claimedAt', sql.DateTime, body.claimedAt ? new Date(body.claimedAt) : new Date())
                    .input('status', sql.NVarChar, body.status || null)
                    .query(`
                        UPDATE Tasks
                        SET ClaimedBy = @actorKey,
                            ClaimedAt = @claimedAt,
                            Status = COALESCE(@status, Status),
                            ModifiedDate = GETUTCDATE()
                        WHERE Id = @id
                          AND (ClaimedBy IS NULL OR LTRIM(RTRIM(ClaimedBy)) = '');

                        SELECT ClaimedBy FROM Tasks WHERE Id = @id;
                    `);

                const rowsAffected = claimResult?.rowsAffected?.[0] || 0;
                const existingClaimedBy = claimResult?.recordset?.[0]?.ClaimedBy || null;
                if (rowsAffected === 0) {
                    context.res = { status: 409, headers, body: { error: 'Task already claimed', claimedBy: existingClaimedBy } };
                    return;
                }

                context.res = { status: 200, headers, body: { message: 'Task claimed', claimedBy: actorKey } };
                return;
            }

            if (claimAction === 'unclaim') {
                if (!actorKey || typeof actorKey !== 'string') {
                    context.res = { status: 400, headers, body: { error: 'actorKey is required' } };
                    return;
                }

                const unclaimResult = await pool.request()
                    .input('id', sql.Int, id)
                    .input('actorKey', sql.NVarChar, actorKey)
                    .input('status', sql.NVarChar, body.status || null)
                    .query(`
                        UPDATE Tasks
                        SET ClaimedBy = NULL,
                            ClaimedAt = NULL,
                            Status = COALESCE(@status, Status),
                            ModifiedDate = GETUTCDATE()
                        WHERE Id = @id
                          AND ClaimedBy = @actorKey;

                        SELECT ClaimedBy FROM Tasks WHERE Id = @id;
                    `);

                const rowsAffected = unclaimResult?.rowsAffected?.[0] || 0;
                const currentClaimedBy = unclaimResult?.recordset?.[0]?.ClaimedBy || null;
                if (rowsAffected === 0) {
                    if (!currentClaimedBy || String(currentClaimedBy).trim() === '') {
                        context.res = { status: 409, headers, body: { error: 'Task is not claimed' } };
                        return;
                    }
                    context.res = { status: 403, headers, body: { error: 'Only the claimer can unclaim', claimedBy: currentClaimedBy } };
                    return;
                }

                context.res = { status: 200, headers, body: { message: 'Task unclaimed' } };
                return;
            }

            const updateDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar, value: body.title },
                { column: 'Description', param: 'description', type: sql.NVarChar, value: body.description || null },
                { column: 'Category', param: 'category', type: sql.NVarChar, value: body.category || null },
                { column: 'Priority', param: 'priority', type: sql.NVarChar, value: body.priority || null },
                { column: 'Status', param: 'status', type: sql.NVarChar, value: body.status || null },
                { column: 'DueDate', param: 'dueDate', type: sql.Date, value: body.dueDate || null },
                { column: 'DueTime', param: 'dueTime', type: sql.NVarChar, value: body.dueTime || null },
                { column: 'AssignedToId', param: 'assignedToId', type: sql.Int, value: body.assignedToId || null },
                { column: 'AssignedById', param: 'assignedById', type: sql.Int, value: resolvedAssignedById },
                { column: 'TaskType', param: 'taskType', type: sql.NVarChar, value: body.taskType || 'Regular' },
                { column: 'IsPaid', param: 'isPaid', type: sql.Bit, value: !!body.isPaid },
                { column: 'PayAmount', param: 'payAmount', type: sql.Decimal(10,2), value: body.payAmount || null },
                { column: 'Location', param: 'location', type: sql.NVarChar, value: body.location || null },
                { column: 'TimeEstimate', param: 'timeEstimate', type: sql.NVarChar, value: body.timeEstimate || null },
                { column: 'Assignee', param: 'assignee', type: sql.NVarChar, value: body.assignee || null },
                { column: 'ClaimedBy', param: 'claimedBy', type: sql.NVarChar, value: body.claimedBy || null },
                { column: 'ClaimedAt', param: 'claimedAt', type: sql.DateTime, value: body.claimedAt || null }
            ].filter((def) => hasColumn(taskColumns, def.column));

            if (complianceFlagColumn) {
                updateDefs.push({ column: complianceFlagColumn, param: 'complianceFlag', type: sql.Bit, value: !!body.complianceFlag });
            }
            if (linkedComplianceIdColumn) {
                updateDefs.push({ column: linkedComplianceIdColumn, param: 'linkedComplianceId', type: sql.Int, value: toNullableInt(body.linkedComplianceId) });
            }
            if (linkedComplianceTitleColumn) {
                updateDefs.push({ column: linkedComplianceTitleColumn, param: 'linkedComplianceTitle', type: sql.NVarChar(255), value: body.linkedComplianceTitle || null });
            }
            if (linkedComplianceStatusColumn) {
                updateDefs.push({ column: linkedComplianceStatusColumn, param: 'linkedComplianceStatus', type: sql.NVarChar(50), value: body.linkedComplianceStatus || null });
            }

            const updateRequest = pool.request().input('id', sql.Int, id);
            updateDefs.forEach((def) => updateRequest.input(def.param, def.type, def.value));

            const setClauses = updateDefs.map((def) => {
                if (def.column === 'AssignedById') {
                    return `${def.column}=CASE WHEN @${def.param} IS NULL THEN ${def.column} ELSE @${def.param} END`;
                }
                return `${def.column}=@${def.param}`;
            });

            if (hasModifiedDate) {
                setClauses.push('ModifiedDate=GETUTCDATE()');
            }

            if (!setClauses.length) {
                context.res = { status: 500, headers, body: { error: 'Tasks schema mismatch: no updatable columns found.' } };
                return;
            }

            await updateRequest.query(`UPDATE Tasks SET ${setClauses.join(', ')} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Task updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Tasks WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Task deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
