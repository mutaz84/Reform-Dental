const sql = require('mssql');
const { getRequestUserId, tenantVisibleUserIdsClause, TENANT_PARAM } = require('../shared/tenant');

const config = {
    server: process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE || '',
    user: process.env.SQL_USER || '',
    password: process.env.SQL_PASSWORD || '',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Parse connection string if provided
function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=(?:tcp:)?([^,;]+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);
        
        return {
            server: serverMatch ? serverMatch[1] : '',
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: {
                encrypt: true,
                trustServerCertificate: false
            }
        };
    }
    return config;
}

async function ensureDutiesTables(pool) {
    await pool.request().batch(`
        IF OBJECT_ID('dbo.Duties', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Duties (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Name NVARCHAR(255) NOT NULL,
                Description NVARCHAR(MAX) NULL,
                Schedule NVARCHAR(50) NULL,
                ScheduleTime NVARCHAR(20) NULL,
                ScheduleDay NVARCHAR(50) NULL,
                Location NVARCHAR(255) NULL,
                Priority NVARCHAR(50) NULL,
                CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                IsActive BIT NOT NULL DEFAULT 1
            );
        END;

        IF COL_LENGTH('dbo.Duties', 'Name') IS NULL ALTER TABLE dbo.Duties ADD Name NVARCHAR(255) NULL;
        IF COL_LENGTH('dbo.Duties', 'Description') IS NULL ALTER TABLE dbo.Duties ADD Description NVARCHAR(MAX) NULL;
        IF COL_LENGTH('dbo.Duties', 'Schedule') IS NULL ALTER TABLE dbo.Duties ADD Schedule NVARCHAR(50) NULL;
        IF COL_LENGTH('dbo.Duties', 'ScheduleTime') IS NULL ALTER TABLE dbo.Duties ADD ScheduleTime NVARCHAR(20) NULL;
        IF COL_LENGTH('dbo.Duties', 'ScheduleDay') IS NULL ALTER TABLE dbo.Duties ADD ScheduleDay NVARCHAR(50) NULL;
        IF COL_LENGTH('dbo.Duties', 'Location') IS NULL ALTER TABLE dbo.Duties ADD Location NVARCHAR(255) NULL;
        IF COL_LENGTH('dbo.Duties', 'Priority') IS NULL ALTER TABLE dbo.Duties ADD Priority NVARCHAR(50) NULL;
        IF COL_LENGTH('dbo.Duties', 'CreatedDate') IS NULL ALTER TABLE dbo.Duties ADD CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
        IF COL_LENGTH('dbo.Duties', 'ModifiedDate') IS NULL ALTER TABLE dbo.Duties ADD ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
        IF COL_LENGTH('dbo.Duties', 'IsActive') IS NULL ALTER TABLE dbo.Duties ADD IsActive BIT NOT NULL DEFAULT 1;

        IF OBJECT_ID('dbo.UserDutyAssignments', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.UserDutyAssignments (
                UserId INT NOT NULL,
                DutyId INT NOT NULL,
                CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT PK_UserDutyAssignments PRIMARY KEY (UserId, DutyId)
            );
        END;

        IF COL_LENGTH('dbo.UserDutyAssignments', 'UserId') IS NULL ALTER TABLE dbo.UserDutyAssignments ADD UserId INT NULL;
        IF COL_LENGTH('dbo.UserDutyAssignments', 'DutyId') IS NULL ALTER TABLE dbo.UserDutyAssignments ADD DutyId INT NULL;
        IF COL_LENGTH('dbo.UserDutyAssignments', 'CreatedDate') IS NULL ALTER TABLE dbo.UserDutyAssignments ADD CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserDutyAssignments_DutyId' AND object_id = OBJECT_ID('dbo.UserDutyAssignments'))
            CREATE INDEX IX_UserDutyAssignments_DutyId ON dbo.UserDutyAssignments (DutyId);
    `);
}

module.exports = async function (context, req) {
    // Handle CORS
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await sql.connect(getConfig());
        await ensureDutiesTables(pool);
        const id = req.params.id;
        const userId = req.query.userId;

        const mapAssignments = (duties, assignmentRows) => {
            const assignmentMap = new Map();
            (assignmentRows || []).forEach((row) => {
                const dutyId = Number(row.DutyId);
                const assignedUserId = Number(row.UserId);
                if (!Number.isInteger(dutyId) || dutyId <= 0) return;
                if (!Number.isInteger(assignedUserId) || assignedUserId <= 0) return;
                if (!assignmentMap.has(dutyId)) assignmentMap.set(dutyId, []);
                assignmentMap.get(dutyId).push(assignedUserId);
            });

            return (duties || []).map((duty) => {
                const dutyId = Number(duty.Id);
                const assignedUserIds = assignmentMap.get(dutyId) || [];
                const firstAssigned = assignedUserIds.length ? assignedUserIds[0] : null;
                return {
                    ...duty,
                    AssignedUserIds: assignedUserIds,
                    assignedUserIds,
                    AssignedToUserId: firstAssigned,
                    assignedToUserId: firstAssigned
                };
            });
        };

        if (req.method === 'PUT' && String(id || '').toLowerCase() === 'assignments') {
            const userIdNumber = Number(req.body?.userId || req.query?.userId || 0);
            const selectedDutyIdsRaw = Array.isArray(req.body?.selectedDutyIds) ? req.body.selectedDutyIds : [];
            const selectedDutyIds = Array.from(new Set(
                selectedDutyIdsRaw
                    .map((value) => Number(value))
                    .filter((value) => Number.isInteger(value) && value > 0)
            ));

            if (!Number.isInteger(userIdNumber) || userIdNumber <= 0) {
                context.res = { status: 400, headers, body: { error: 'Valid userId is required' } };
                return;
            }

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                await new sql.Request(transaction)
                    .input('userId', sql.Int, userIdNumber)
                    .query('DELETE FROM UserDutyAssignments WHERE UserId = @userId');

                for (const dutyId of selectedDutyIds) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Int, userIdNumber)
                        .input('dutyId', sql.Int, dutyId)
                        .query(`INSERT INTO UserDutyAssignments (UserId, DutyId)
                                SELECT @userId, @dutyId
                                WHERE EXISTS (SELECT 1 FROM Duties WHERE Id = @dutyId AND IsActive = 1)`);
                }

                await transaction.commit();
                context.res = {
                    status: 200,
                    headers,
                    body: {
                        message: 'Duty assignments updated',
                        userId: userIdNumber,
                        assignedDutyIds: selectedDutyIds
                    }
                };
            } catch (assignmentError) {
                await transaction.rollback();
                throw assignmentError;
            }
            return;
        }

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            if (!tenantUserId) {
                context.res = { status: 200, headers, body: id ? null : [] };
                return;
            }
            const tenantClause = tenantVisibleUserIdsClause('UserId');
            if (id) {
                // Get single duty
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT Id, Name, Description, Schedule, ScheduleTime, ScheduleDay, Location, 
                            Priority, CreatedDate, ModifiedDate, IsActive
                            FROM Duties WHERE Id = @id AND IsActive = 1`);
                
                if (result.recordset.length === 0) {
                    context.res = { status: 404, headers, body: { error: 'Duty not found' } };
                } else {
                    const assignmentResult = await pool.request()
                        .input('id', sql.Int, id)
                        .input(TENANT_PARAM, sql.Int, tenantUserId)
                        .query(`SELECT DutyId, UserId FROM UserDutyAssignments WHERE DutyId = @id AND ${tenantClause}`);
                    const mapped = mapAssignments(result.recordset, assignmentResult.recordset || []);
                    context.res = { status: 200, headers, body: mapped[0] };
                }
            } else if (userId) {
                // Get duties for a specific user — must be a visible user
                const userIdNumber = Number(userId);
                const visibilityCheck = await pool.request()
                    .input('uid', sql.Int, userIdNumber)
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT TOP 1 1 AS ok WHERE @uid IN (${require('../shared/tenant').tenantVisibleUserIdsSql()})`);
                if (!visibilityCheck.recordset.length) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                const result = await pool.request()
                    .input('userId', sql.Int, userIdNumber)
                    .query(`SELECT d.Id, d.Name, d.Description, d.Schedule, d.ScheduleTime, d.ScheduleDay,
                            d.Location, d.Priority, d.CreatedDate, d.ModifiedDate, d.IsActive,
                            u.FirstName + ' ' + u.LastName as AssignedToName
                            FROM Duties d
                            INNER JOIN UserDutyAssignments uda ON uda.DutyId = d.Id
                            LEFT JOIN Users u ON uda.UserId = u.Id
                            WHERE uda.UserId = @userId AND d.IsActive = 1
                            ORDER BY d.Priority, d.Name`);
                const mapped = (result.recordset || []).map((duty) => ({
                    ...duty,
                    AssignedUserIds: [userIdNumber],
                    assignedUserIds: [userIdNumber],
                    AssignedToUserId: userIdNumber,
                    assignedToUserId: userIdNumber
                }));
                context.res = { status: 200, headers, body: mapped };
            } else {
                // Get all duties — only those with at least one visible-user assignment
                const dutiesResult = await pool.request()
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT Id, Name, Description, Schedule, ScheduleTime, ScheduleDay,
                            Location, Priority, CreatedDate, ModifiedDate, IsActive
                            FROM Duties
                            WHERE IsActive = 1 AND Id IN (
                                SELECT DutyId FROM UserDutyAssignments WHERE ${tenantClause}
                            )
                            ORDER BY Priority, Name`);

                const assignmentsResult = await pool.request()
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT DutyId, UserId FROM UserDutyAssignments WHERE ${tenantClause}`);

                const mapped = mapAssignments(dutiesResult.recordset || [], assignmentsResult.recordset || []);
                context.res = { status: 200, headers, body: mapped };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const result = await new sql.Request(transaction)
                    .input('name', sql.NVarChar, body.name)
                    .input('description', sql.NVarChar, body.description || '')
                    .input('schedule', sql.NVarChar, body.schedule || 'Daily')
                    .input('scheduleTime', sql.NVarChar, body.scheduleTime || '')
                    .input('scheduleDay', sql.NVarChar, body.scheduleDay || '')
                    .input('location', sql.NVarChar, body.location || '')
                    .input('priority', sql.NVarChar, body.priority || 'Medium')
                    .query(`INSERT INTO Duties (Name, Description, Schedule, ScheduleTime, ScheduleDay, Location, Priority)
                            OUTPUT INSERTED.Id
                            VALUES (@name, @description, @schedule, @scheduleTime, @scheduleDay, @location, @priority)`);

                const dutyId = result.recordset[0].Id;
                const assignedToUserId = Number(body.assignedToUserId || 0);
                if (Number.isInteger(assignedToUserId) && assignedToUserId > 0) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Int, assignedToUserId)
                        .input('dutyId', sql.Int, dutyId)
                        .query('INSERT INTO UserDutyAssignments (UserId, DutyId) VALUES (@userId, @dutyId)');
                }

                await transaction.commit();
                context.res = { status: 201, headers, body: { id: dutyId, message: 'Duty created' } };
            } catch (postError) {
                await transaction.rollback();
                throw postError;
            }
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('description', sql.NVarChar, body.description || '')
                .input('schedule', sql.NVarChar, body.schedule || 'Daily')
                .input('scheduleTime', sql.NVarChar, body.scheduleTime || '')
                .input('scheduleDay', sql.NVarChar, body.scheduleDay || '')
                .input('location', sql.NVarChar, body.location || '')
                .input('priority', sql.NVarChar, body.priority || 'Medium')
                .query(`UPDATE Duties SET 
                        Name = @name, 
                        Description = @description, 
                        Schedule = @schedule, 
                        ScheduleTime = @scheduleTime, 
                        ScheduleDay = @scheduleDay, 
                        Location = @location, 
                        Priority = @priority, 
                        ModifiedDate = GETDATE()
                        WHERE Id = @id`);

            if (Object.prototype.hasOwnProperty.call(body || {}, 'assignedToUserId')) {
                const assignedToUserId = Number(body.assignedToUserId || 0);
                const transaction = new sql.Transaction(pool);
                await transaction.begin();
                try {
                    await new sql.Request(transaction)
                        .input('dutyId', sql.Int, id)
                        .query('DELETE FROM UserDutyAssignments WHERE DutyId = @dutyId');

                    if (Number.isInteger(assignedToUserId) && assignedToUserId > 0) {
                        await new sql.Request(transaction)
                            .input('userId', sql.Int, assignedToUserId)
                            .input('dutyId', sql.Int, id)
                            .query('INSERT INTO UserDutyAssignments (UserId, DutyId) VALUES (@userId, @dutyId)');
                    }

                    await transaction.commit();
                } catch (putAssignmentError) {
                    await transaction.rollback();
                    throw putAssignmentError;
                }
            }

            context.res = { status: 200, headers, body: { message: 'Duty updated' } };
        } else if (req.method === 'DELETE' && id) {
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                await new sql.Request(transaction)
                    .input('id', sql.Int, id)
                    .query('DELETE FROM UserDutyAssignments WHERE DutyId = @id');

                await new sql.Request(transaction)
                    .input('id', sql.Int, id)
                    .query('UPDATE Duties SET IsActive = 0, ModifiedDate = GETDATE() WHERE Id = @id');

                await transaction.commit();
            } catch (deleteError) {
                await transaction.rollback();
                throw deleteError;
            }
            context.res = { status: 200, headers, body: { message: 'Duty deleted' } };
        } else {
            context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
        }
    } catch (error) {
        context.log('Error:', error.message);
        context.res = {
            status: 500,
            headers,
            body: { error: 'Database error', details: error.message }
        };
    }
};
