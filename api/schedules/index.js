const sql = require('mssql');

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

        const parseIntOrNull = (value) => {
            const parsed = Number.parseInt(String(value), 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        };

        const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

        const parseOptionalIntField = (body, fieldName) => {
            if (!hasOwn(body, fieldName)) return undefined;
            return parseIntOrNull(body[fieldName]);
        };

        const normalizeName = (value) => String(value || '')
            .toLowerCase()
            .replace(/\b(dr|doctor|dds|dmd)\.?\s*/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const isActiveUserId = async (candidateUserId) => {
            const parsedId = parseIntOrNull(candidateUserId);
            if (!parsedId) return false;
            const check = await pool.request()
                .input('userId', sql.Int, parsedId)
                .query('SELECT TOP 1 Id FROM Users WHERE Id = @userId AND ISNULL(IsActive, 1) = 1');
            return !!(check.recordset && check.recordset[0] && check.recordset[0].Id);
        };

        const resolveActiveUserIdByName = async (rawName) => {
            const target = normalizeName(rawName);
            if (!target) return null;
            const result = await pool.request().query(`
                SELECT Id, Username, FirstName, LastName
                FROM Users
                WHERE ISNULL(IsActive, 1) = 1
            `);
            const matched = (result.recordset || []).find((user) => {
                const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
                return normalizeName(fullName) === target || normalizeName(user.Username) === target;
            });
            return parseIntOrNull(matched?.Id);
        };

        const resolveClinicIdByName = async (rawClinicName) => {
            const target = normalizeName(rawClinicName);
            if (!target) return null;
            const result = await pool.request().query(`
                SELECT Id, Name
                FROM Clinics
                WHERE ISNULL(IsActive, 1) = 1
            `);
            const matched = (result.recordset || []).find((clinic) => normalizeName(clinic.Name) === target);
            return parseIntOrNull(matched?.Id);
        };

        const resolveRoomIdByName = async (rawRoomName, clinicId) => {
            const target = normalizeName(rawRoomName);
            if (!target) return null;
            const request = pool.request();
            let query = `SELECT Id, Name FROM Rooms WHERE ISNULL(IsActive, 1) = 1`;
            if (parseIntOrNull(clinicId)) {
                request.input('clinicId', sql.Int, parseIntOrNull(clinicId));
                query += ' AND ClinicId = @clinicId';
            }
            const result = await request.query(query);
            const matched = (result.recordset || []).find((room) => normalizeName(room.Name) === target);
            return parseIntOrNull(matched?.Id);
        };

        const schemaInfo = await pool.request().query(`
            SELECT
                CASE WHEN COL_LENGTH('Schedules', 'ProviderId') IS NULL THEN 0 ELSE 1 END AS HasProviderId,
                CASE WHEN COL_LENGTH('Schedules', 'EmployeeId') IS NULL THEN 0 ELSE 1 END AS HasEmployeeId
        `);
        const hasProviderIdColumn = !!Number(schemaInfo.recordset?.[0]?.HasProviderId || 0);
        const hasEmployeeIdColumn = !!Number(schemaInfo.recordset?.[0]?.HasEmployeeId || 0);
        const hasProviderEmployeeColumns = hasProviderIdColumn && hasEmployeeIdColumn;

        const baseGetSelect = hasProviderEmployeeColumns
            ? `SELECT s.*,
                      u.FirstName + ' ' + u.LastName as EmployeeName,
                      c.Name as ClinicName,
                      r.Name as RoomName,
                      au.FirstName + ' ' + au.LastName as AssistantName,
                      pu.FirstName + ' ' + pu.LastName as ProviderName,
                      eu.FirstName + ' ' + eu.LastName as EmployeeOwnerName
               FROM Schedules s
               LEFT JOIN Users u ON s.UserId = u.Id
               LEFT JOIN Users pu ON s.ProviderId = pu.Id
               LEFT JOIN Users eu ON s.EmployeeId = eu.Id
               LEFT JOIN Users au ON s.AssistantId = au.Id
               LEFT JOIN Clinics c ON s.ClinicId = c.Id
               LEFT JOIN Rooms r ON s.RoomId = r.Id`
            : `SELECT s.*,
                      u.FirstName + ' ' + u.LastName as EmployeeName,
                      c.Name as ClinicName,
                      r.Name as RoomName,
                      au.FirstName + ' ' + au.LastName as AssistantName
               FROM Schedules s
               LEFT JOIN Users u ON s.UserId = u.Id
               LEFT JOIN Users au ON s.AssistantId = au.Id
               LEFT JOIN Clinics c ON s.ClinicId = c.Id
               LEFT JOIN Rooms r ON s.RoomId = r.Id`;

        const activeAndNotSyntheticWhere = `
            s.IsActive = 1
            AND ISNULL(u.IsActive, 1) = 1
            AND LOWER(LTRIM(RTRIM(ISNULL(u.Username, '')))) <> 'schedule_unassigned'
            AND NOT (
                LOWER(LTRIM(RTRIM(ISNULL(u.FirstName, '')))) = 'unassigned'
                AND LOWER(LTRIM(RTRIM(ISNULL(u.LastName, '')))) = 'schedule'
            )`;

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`${baseGetSelect} WHERE s.Id = @id AND ${activeAndNotSyntheticWhere}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query(`${baseGetSelect} WHERE ${activeAndNotSyntheticWhere} ORDER BY s.StartDate, s.StartTime`);
                context.res = { status: 200, headers, body: result.recordset };
            }
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};

            let providerId = parseOptionalIntField(body, 'providerId');
            let employeeId = parseOptionalIntField(body, 'employeeId');
            let assistantId = parseOptionalIntField(body, 'assistantId');
            let legacyUserId = parseOptionalIntField(body, 'userId');

            if (providerId === undefined) providerId = null;
            if (employeeId === undefined) employeeId = null;
            if (assistantId === undefined) assistantId = null;
            if (legacyUserId === undefined) legacyUserId = null;

            if (!providerId) {
                providerId = await resolveActiveUserIdByName(body.providerName || body.provider);
            }
            if (!employeeId) {
                employeeId = await resolveActiveUserIdByName(body.employeeName || body.employee || body.userName || body.name);
            }
            if (!assistantId) {
                assistantId = await resolveActiveUserIdByName(body.assistantName || body.assistant);
            }
            if (!legacyUserId) {
                legacyUserId = await resolveActiveUserIdByName(body.userName || body.employeeName || body.name || body.employee || body.provider);
            }

            let clinicId = parseIntOrNull(body.clinicId);
            if (!clinicId) clinicId = await resolveClinicIdByName(body.clinicName || body.clinic);

            let roomId = parseIntOrNull(body.roomId);
            if (!roomId) roomId = await resolveRoomIdByName(body.roomName || body.room, clinicId);

            const ownerUserId = providerId || employeeId || legacyUserId || assistantId || null;

            if (!clinicId) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Missing required schedule fields', details: { clinicIdResolved: false } }
                };
                return;
            }

            if (!hasProviderEmployeeColumns && !ownerUserId) {
                context.res = {
                    status: 400,
                    headers,
                    body: {
                        error: 'Missing required schedule owner fields',
                        details: {
                            message: 'Apply DB migration to support optional providerId/employeeId/assistantId or provide userId/provider/employee.'
                        }
                    }
                };
                return;
            }

            for (const candidate of [providerId, employeeId, assistantId, ownerUserId]) {
                if (candidate && !(await isActiveUserId(candidate))) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'One or more selected users are inactive or missing.' }
                    };
                    return;
                }
            }

            const request = pool.request()
                .input('userId', sql.Int, ownerUserId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId || null)
                .input('assistantId', sql.Int, assistantId || null)
                .input('startDate', sql.Date, body.startDate)
                .input('endDate', sql.Date, body.endDate || null)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('daysOfWeek', sql.NVarChar, body.daysOfWeek)
                .input('color', sql.NVarChar, body.color)
                .input('notes', sql.NVarChar, body.notes);

            let insertSql = `INSERT INTO Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes)
                             OUTPUT INSERTED.Id
                             VALUES (@userId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)`;

            if (hasProviderEmployeeColumns) {
                request
                    .input('providerId', sql.Int, providerId || null)
                    .input('employeeId', sql.Int, employeeId || null);
                insertSql = `INSERT INTO Schedules (UserId, ProviderId, EmployeeId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes)
                             OUTPUT INSERTED.Id
                             VALUES (@userId, @providerId, @employeeId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)`;
            }

            const result = await request.query(insertSql);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        if (req.method === 'PUT' && id) {
            const body = req.body || {};

            let providerId = parseOptionalIntField(body, 'providerId');
            let employeeId = parseOptionalIntField(body, 'employeeId');
            let assistantId = parseOptionalIntField(body, 'assistantId');
            let legacyUserId = parseOptionalIntField(body, 'userId');

            if (providerId === undefined) providerId = null;
            if (employeeId === undefined) employeeId = null;
            if (assistantId === undefined) assistantId = null;
            if (legacyUserId === undefined) legacyUserId = null;

            if (!providerId) providerId = await resolveActiveUserIdByName(body.providerName || body.provider);
            if (!employeeId) employeeId = await resolveActiveUserIdByName(body.employeeName || body.employee || body.userName || body.name);
            if (!assistantId) assistantId = await resolveActiveUserIdByName(body.assistantName || body.assistant);
            if (!legacyUserId) legacyUserId = await resolveActiveUserIdByName(body.userName || body.employeeName || body.name || body.employee || body.provider);

            let clinicId = parseIntOrNull(body.clinicId);
            if (!clinicId && (body.clinicName || body.clinic)) clinicId = await resolveClinicIdByName(body.clinicName || body.clinic);

            let roomId = parseIntOrNull(body.roomId);
            if (!roomId && (body.roomName || body.room)) roomId = await resolveRoomIdByName(body.roomName || body.room, clinicId);

            const ownerUserId = providerId || employeeId || legacyUserId || assistantId || null;

            for (const candidate of [providerId, employeeId, assistantId, ownerUserId]) {
                if (candidate && !(await isActiveUserId(candidate))) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'One or more selected users are inactive or missing.' }
                    };
                    return;
                }
            }

            const request = pool.request()
                .input('id', sql.Int, id)
                .input('userId', sql.Int, ownerUserId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId)
                .input('assistantId', sql.Int, assistantId)
                .input('startDate', sql.Date, body.startDate)
                .input('endDate', sql.Date, body.endDate)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('daysOfWeek', sql.NVarChar, body.daysOfWeek)
                .input('color', sql.NVarChar, body.color || null)
                .input('notes', sql.NVarChar, body.notes);

            let updateSql = `UPDATE Schedules
                             SET UserId = @userId,
                                 ClinicId = COALESCE(@clinicId, ClinicId),
                                 RoomId = @roomId,
                                 AssistantId = @assistantId,
                                 StartDate = @startDate,
                                 EndDate = @endDate,
                                 StartTime = @startTime,
                                 EndTime = @endTime,
                                 DaysOfWeek = @daysOfWeek,
                                 Color = COALESCE(@color, Color),
                                 Notes = @notes,
                                 ModifiedDate = GETUTCDATE()
                             WHERE Id = @id`;

            if (hasProviderEmployeeColumns) {
                request
                    .input('providerId', sql.Int, providerId)
                    .input('employeeId', sql.Int, employeeId);
                updateSql = `UPDATE Schedules
                             SET UserId = @userId,
                                 ProviderId = @providerId,
                                 EmployeeId = @employeeId,
                                 ClinicId = COALESCE(@clinicId, ClinicId),
                                 RoomId = @roomId,
                                 AssistantId = @assistantId,
                                 StartDate = @startDate,
                                 EndDate = @endDate,
                                 StartTime = @startTime,
                                 EndTime = @endTime,
                                 DaysOfWeek = @daysOfWeek,
                                 Color = COALESCE(@color, Color),
                                 Notes = @notes,
                                 ModifiedDate = GETUTCDATE()
                             WHERE Id = @id`;
            }

            await request.query(updateSql);
            context.res = { status: 200, headers, body: { message: 'Schedule updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            try {
                const hardDelete = await pool.request()
                    .input('id', sql.Int, id)
                    .query('DELETE FROM Schedules WHERE Id = @id');

                const affected = Number(hardDelete?.rowsAffected?.[0] || 0);
                if (affected > 0) {
                    context.res = { status: 200, headers, body: { message: 'Schedule deleted' } };
                } else {
                    context.res = { status: 404, headers, body: { error: 'Schedule not found' } };
                }
            } catch (deleteError) {
                const message = String(deleteError?.message || '').toLowerCase();
                const fkConflict = message.includes('delete statement conflicted') || message.includes('reference constraint');
                if (!fkConflict) throw deleteError;

                await pool.request()
                    .input('id', sql.Int, id)
                    .query('UPDATE Schedules SET IsActive = 0 WHERE Id = @id');
                context.res = { status: 200, headers, body: { message: 'Schedule soft-deleted' } };
            }
            return;
        }

    } catch (err) {
        context.log.error('Database error:', err);
        context.res = {
            status: 500,
            headers,
            body: {
                error: err.message,
                code: err.code || null,
                name: err.name || null
            }
        };
    }
};
