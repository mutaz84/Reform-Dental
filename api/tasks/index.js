const sql = require('mssql');

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

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=tcp:([^,]+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);
        
        return {
            server: serverMatch ? serverMatch[1] : '',
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: { encrypt: true, trustServerCertificate: false }
        };
    }
    return {};
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
        const pool = await sql.connect(getConfig());
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

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
