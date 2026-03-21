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
        const parseDateOrNull = (value) => {
            const text = String(value ?? '').trim();
            if (!text) return null;
            const parsed = new Date(text);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const parseTextOrNull = (value) => {
            const text = String(value ?? '').trim();
            return text || null;
        };

        const isActiveUserId = async (candidateUserId) => {
            const parsedId = parseIntOrNull(candidateUserId);
            if (!parsedId) return false;
            const check = await pool.request()
                .input('userId', sql.Int, parsedId)
                .query('SELECT TOP 1 Id FROM Users WHERE Id = @userId AND ISNULL(IsActive, 1) = 1');
            return !!(check.recordset && check.recordset[0] && check.recordset[0].Id);
        };

        const normalizeName = (value) => String(value || '')
            .toLowerCase()
            .replace(/\b(dr|doctor|dds|dmd)\.?\s*/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const ensureUnassignedUserId = async () => {
            const existing = await pool.request().query(`
                SELECT TOP 1 Id
                FROM Users
                WHERE ISNULL(IsActive, 1) = 1
                  AND (
                    LOWER(LTRIM(RTRIM(Username))) = 'schedule_unassigned'
                    OR (LOWER(LTRIM(RTRIM(ISNULL(FirstName, '')))) = 'unassigned' AND LOWER(LTRIM(RTRIM(ISNULL(LastName, '')))) = 'schedule')
                  )
                ORDER BY Id
            `);

            const existingId = parseIntOrNull(existing.recordset?.[0]?.Id);
            if (existingId) return existingId;

            const created = await pool.request()
                .input('username', sql.NVarChar(50), 'schedule_unassigned')
                .input('passwordHash', sql.NVarChar(255), 'system-generated-no-login')
                .input('firstName', sql.NVarChar(100), 'Unassigned')
                .input('lastName', sql.NVarChar(100), 'Schedule')
                .input('role', sql.NVarChar(50), 'user')
                .query(`
                    INSERT INTO Users (Username, PasswordHash, FirstName, LastName, Role, IsActive, IsOnline, FailedLoginAttempts, CreatedDate, ModifiedDate)
                    OUTPUT INSERTED.Id
                    VALUES (@username, @passwordHash, @firstName, @lastName, @role, 1, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME())
                `);

            return parseIntOrNull(created.recordset?.[0]?.Id);
        };

        const ensureFallbackClinicId = async () => {
            const activeClinic = await pool.request().query(`
                SELECT TOP 1 Id
                FROM Clinics
                WHERE ISNULL(IsActive, 1) = 1
                ORDER BY Id
            `);

            const activeClinicId = parseIntOrNull(activeClinic.recordset?.[0]?.Id);
            if (activeClinicId) return activeClinicId;

            const existingFallback = await pool.request().query(`
                SELECT TOP 1 Id
                FROM Clinics
                WHERE LOWER(LTRIM(RTRIM(Name))) = 'unassigned clinic'
                ORDER BY Id
            `);
            const fallbackId = parseIntOrNull(existingFallback.recordset?.[0]?.Id);
            if (fallbackId) return fallbackId;

            const createdClinic = await pool.request()
                .input('name', sql.NVarChar(200), 'Unassigned Clinic')
                .query(`
                    INSERT INTO Clinics (Name, IsActive, CreatedDate, ModifiedDate)
                    OUTPUT INSERTED.Id
                    VALUES (@name, 1, SYSUTCDATETIME(), SYSUTCDATETIME())
                `);
            return parseIntOrNull(createdClinic.recordset?.[0]?.Id);
        };

        const todayIsoDate = () => {
            const now = new Date();
            const y = now.getUTCFullYear();
            const m = String(now.getUTCMonth() + 1).padStart(2, '0');
            const d = String(now.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT s.*, 
                                   u.FirstName + ' ' + u.LastName as EmployeeName,
                                   c.Name as ClinicName,
                                   r.Name as RoomName,
                                   au.FirstName + ' ' + au.LastName as AssistantName
                            FROM Schedules s
                            LEFT JOIN Users u ON s.UserId = u.Id
                            LEFT JOIN Clinics c ON s.ClinicId = c.Id
                            LEFT JOIN Rooms r ON s.RoomId = r.Id
                            LEFT JOIN Users au ON s.AssistantId = au.Id
                            WHERE s.Id = @id AND s.IsActive = 1 AND ISNULL(u.IsActive, 1) = 1`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query(`SELECT s.*, u.FirstName + ' ' + u.LastName as EmployeeName, c.Name as ClinicName, r.Name as RoomName, au.FirstName + ' ' + au.LastName as AssistantName
                            FROM Schedules s 
                            LEFT JOIN Users u ON s.UserId = u.Id 
                            LEFT JOIN Clinics c ON s.ClinicId = c.Id 
                            LEFT JOIN Rooms r ON s.RoomId = r.Id 
                            LEFT JOIN Users au ON s.AssistantId = au.Id
                            WHERE s.IsActive = 1 AND ISNULL(u.IsActive, 1) = 1 
                            ORDER BY s.StartDate, s.StartTime`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;

            let userId = parseIntOrNull(body.userId);
            let clinicId = parseIntOrNull(body.clinicId);
            let roomId = parseIntOrNull(body.roomId);
            let assistantId = parseIntOrNull(body.assistantId);

            if (!userId && (body.userName || body.employeeName || body.name || body.employee || body.provider)) {
                const rawUserName = body.userName || body.employeeName || body.name || body.employee || body.provider;
                const targetUser = normalizeName(rawUserName);
                const userResult = await pool.request()
                    .query(`SELECT Id, Username, FirstName, LastName
                            FROM Users
                            WHERE IsActive = 1`);

                const matchedUser = (userResult.recordset || []).find((user) => {
                    const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
                    return normalizeName(fullName) === targetUser || normalizeName(user.Username) === targetUser;
                });

                if (matchedUser) {
                    userId = matchedUser.Id;
                }
            }

            if (!clinicId && (body.clinicName || body.clinic)) {
                const targetClinic = normalizeName(body.clinicName || body.clinic);
                const clinicResult = await pool.request()
                    .query(`SELECT Id, Name
                            FROM Clinics
                            WHERE IsActive = 1`);

                const matchedClinic = (clinicResult.recordset || []).find((clinic) => normalizeName(clinic.Name) === targetClinic);
                if (matchedClinic) {
                    clinicId = matchedClinic.Id;
                }
            }

            if (!roomId && (body.roomName || body.room) && clinicId) {
                const targetRoom = normalizeName(body.roomName || body.room);
                const roomResult = await pool.request()
                    .input('clinicId', sql.Int, clinicId)
                    .query(`SELECT Id, Name
                            FROM Rooms
                            WHERE IsActive = 1 AND ClinicId = @clinicId`);

                const matchedRoom = (roomResult.recordset || []).find((room) => normalizeName(room.Name) === targetRoom);
                if (matchedRoom) {
                    roomId = matchedRoom.Id;
                }
            }

            if (!roomId && (body.roomName || body.room) && !clinicId) {
                const targetRoom = normalizeName(body.roomName || body.room);
                const roomResult = await pool.request()
                    .query(`SELECT Id, Name
                            FROM Rooms
                            WHERE IsActive = 1`);

                const matchedRoom = (roomResult.recordset || []).find((room) => normalizeName(room.Name) === targetRoom);
                if (matchedRoom) {
                    roomId = matchedRoom.Id;
                }
            }

            if (!assistantId && (body.assistantName || body.assistant)) {
                const rawAssistantName = body.assistantName || body.assistant;
                const targetAssistant = normalizeName(rawAssistantName);
                const assistantResult = await pool.request()
                    .query(`SELECT Id, Username, FirstName, LastName
                            FROM Users
                            WHERE IsActive = 1`);

                const matchedAssistant = (assistantResult.recordset || []).find((user) => {
                    const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
                    return normalizeName(fullName) === targetAssistant || normalizeName(user.Username) === targetAssistant;
                });

                if (matchedAssistant) {
                    assistantId = matchedAssistant.Id;
                }
            }

            // Assistant-only shift support: store assistant as primary schedule owner.
            if (!userId && assistantId) {
                userId = assistantId;
                assistantId = null;
            }

            if (!userId) {
                userId = await ensureUnassignedUserId();
            }
            if (!clinicId) {
                clinicId = await ensureFallbackClinicId();
            }

            const startDateValue = parseDateOrNull(body.startDate) || parseDateOrNull(todayIsoDate());
            const endDateValue = parseDateOrNull(body.endDate);
            const startTimeValue = parseTextOrNull(body.startTime) || '08:00';
            const endTimeValue = parseTextOrNull(body.endTime) || '16:00';

            if (userId && !(await isActiveUserId(userId))) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Selected provider is inactive or missing.' }
                };
                return;
            }

            if (assistantId && !(await isActiveUserId(assistantId))) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Selected assistant is inactive or missing.' }
                };
                return;
            }

            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId || null)
                .input('assistantId', sql.Int, assistantId || null)
                .input('startDate', sql.Date, startDateValue)
                .input('endDate', sql.Date, endDateValue)
                .input('startTime', sql.VarChar, startTimeValue)
                .input('endTime', sql.VarChar, endTimeValue)
                .input('daysOfWeek', sql.NVarChar, parseTextOrNull(body.daysOfWeek))
                .input('color', sql.NVarChar, parseTextOrNull(body.color))
                .input('notes', sql.NVarChar, parseTextOrNull(body.notes))
                .query(`INSERT INTO Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes) 
                        OUTPUT INSERTED.Id VALUES (@userId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;

            let userId = parseIntOrNull(body.userId);
            let clinicId = parseIntOrNull(body.clinicId);
            let roomId = parseIntOrNull(body.roomId);
            let assistantId = parseIntOrNull(body.assistantId);

            if (!userId && (body.userName || body.employeeName || body.name || body.employee || body.provider)) {
                const rawUserName = body.userName || body.employeeName || body.name || body.employee || body.provider;
                const targetUser = normalizeName(rawUserName);
                const userResult = await pool.request()
                    .query(`SELECT Id, Username, FirstName, LastName
                            FROM Users
                            WHERE IsActive = 1`);

                const matchedUser = (userResult.recordset || []).find((user) => {
                    const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
                    return normalizeName(fullName) === targetUser || normalizeName(user.Username) === targetUser;
                });

                if (matchedUser) {
                    userId = matchedUser.Id;
                }
            }

            if (!clinicId && (body.clinicName || body.clinic)) {
                const targetClinic = normalizeName(body.clinicName || body.clinic);
                const clinicResult = await pool.request()
                    .query(`SELECT Id, Name
                            FROM Clinics
                            WHERE IsActive = 1`);

                const matchedClinic = (clinicResult.recordset || []).find((clinic) => normalizeName(clinic.Name) === targetClinic);
                if (matchedClinic) {
                    clinicId = matchedClinic.Id;
                }
            }

            if (!roomId && (body.roomName || body.room) && clinicId) {
                const targetRoom = normalizeName(body.roomName || body.room);
                const roomResult = await pool.request()
                    .input('clinicId', sql.Int, clinicId)
                    .query(`SELECT Id, Name
                            FROM Rooms
                            WHERE IsActive = 1 AND ClinicId = @clinicId`);

                const matchedRoom = (roomResult.recordset || []).find((room) => normalizeName(room.Name) === targetRoom);
                if (matchedRoom) {
                    roomId = matchedRoom.Id;
                }
            }

            if (!roomId && (body.roomName || body.room) && !clinicId) {
                const targetRoom = normalizeName(body.roomName || body.room);
                const roomResult = await pool.request()
                    .query(`SELECT Id, Name
                            FROM Rooms
                            WHERE IsActive = 1`);

                const matchedRoom = (roomResult.recordset || []).find((room) => normalizeName(room.Name) === targetRoom);
                if (matchedRoom) {
                    roomId = matchedRoom.Id;
                }
            }

            if (!assistantId && (body.assistantName || body.assistant)) {
                const rawAssistantName = body.assistantName || body.assistant;
                const targetAssistant = normalizeName(rawAssistantName);
                const assistantResult = await pool.request()
                    .query(`SELECT Id, Username, FirstName, LastName
                            FROM Users
                            WHERE IsActive = 1`);

                const matchedAssistant = (assistantResult.recordset || []).find((user) => {
                    const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
                    return normalizeName(fullName) === targetAssistant || normalizeName(user.Username) === targetAssistant;
                });

                if (matchedAssistant) {
                    assistantId = matchedAssistant.Id;
                }
            }

            // Assistant-only shift support for updates as well.
            if (!userId && assistantId) {
                userId = assistantId;
                assistantId = null;
            }

            if (!userId) {
                userId = await ensureUnassignedUserId();
            }
            if (!clinicId) {
                clinicId = await ensureFallbackClinicId();
            }

            const startDateValue = parseDateOrNull(body.startDate) || parseDateOrNull(todayIsoDate());
            const endDateValue = parseDateOrNull(body.endDate);
            const startTimeValue = parseTextOrNull(body.startTime) || '08:00';
            const endTimeValue = parseTextOrNull(body.endTime) || '16:00';

            if (userId && !(await isActiveUserId(userId))) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Selected provider is inactive or missing.' }
                };
                await pool.close();
                return;
            }

            if (assistantId && !(await isActiveUserId(assistantId))) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Selected assistant is inactive or missing.' }
                };
                await pool.close();
                return;
            }

            await pool.request()
                .input('id', sql.Int, id)
                .input('userId', sql.Int, userId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId)
                .input('assistantId', sql.Int, assistantId)
                .input('startDate', sql.Date, startDateValue)
                .input('endDate', sql.Date, endDateValue)
                .input('startTime', sql.VarChar, startTimeValue)
                .input('endTime', sql.VarChar, endTimeValue)
                .input('daysOfWeek', sql.NVarChar, parseTextOrNull(body.daysOfWeek))
                .input('color', sql.NVarChar, parseTextOrNull(body.color))
                .input('notes', sql.NVarChar, parseTextOrNull(body.notes))
                .query(`UPDATE Schedules
                        SET UserId = @userId,
                            ClinicId = @clinicId,
                            RoomId = @roomId,
                            AssistantId = @assistantId,
                            StartDate=@startDate,
                            EndDate=@endDate,
                            StartTime=@startTime,
                            EndTime=@endTime,
                            DaysOfWeek=@daysOfWeek,
                            Color = @color,
                            Notes=@notes,
                            ModifiedDate=GETUTCDATE()
                        WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Schedule updated' } };
        } else if (req.method === 'DELETE' && id) {
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
                // If hard delete is blocked by FK constraints, fall back to soft delete.
                const message = String(deleteError?.message || '').toLowerCase();
                const fkConflict = message.includes('delete statement conflicted') || message.includes('reference constraint');
                if (!fkConflict) {
                    throw deleteError;
                }

                await pool.request()
                    .input('id', sql.Int, id)
                    .query('UPDATE Schedules SET IsActive = 0 WHERE Id = @id');
                context.res = { status: 200, headers, body: { message: 'Schedule soft-deleted' } };
            }
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
