const sql = require('mssql');

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
        const parseIntOrNull = (value) => {
            const parsed = Number.parseInt(String(value), 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        };

        const normalizeName = (value) => String(value || '')
            .toLowerCase()
            .replace(/\b(dr|doctor|dds|dmd)\.?\s*/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM Schedules WHERE Id = @id AND IsActive = 1');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query(`SELECT s.*, u.FirstName + ' ' + u.LastName as EmployeeName, c.Name as ClinicName, r.Name as RoomName 
                            FROM Schedules s 
                            LEFT JOIN Users u ON s.UserId = u.Id 
                            LEFT JOIN Clinics c ON s.ClinicId = c.Id 
                            LEFT JOIN Rooms r ON s.RoomId = r.Id 
                            WHERE s.IsActive = 1 
                            ORDER BY s.StartDate, s.StartTime`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;

            let userId = parseIntOrNull(body.userId);
            let clinicId = parseIntOrNull(body.clinicId);
            let roomId = parseIntOrNull(body.roomId);

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

            if (!userId || !clinicId) {
                context.res = {
                    status: 400,
                    headers,
                    body: {
                        error: 'Missing required schedule fields',
                        details: {
                            userIdResolved: !!userId,
                            clinicIdResolved: !!clinicId
                        }
                    }
                };
                await pool.close();
                return;
            }

            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId || null)
                .input('startDate', sql.Date, body.startDate)
                .input('endDate', sql.Date, body.endDate || null)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('daysOfWeek', sql.NVarChar, body.daysOfWeek)
                .input('color', sql.NVarChar, body.color)
                .input('notes', sql.NVarChar, body.notes)
                .query(`INSERT INTO Schedules (UserId, ClinicId, RoomId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes) 
                        OUTPUT INSERTED.Id VALUES (@userId, @clinicId, @roomId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;

            let userId = parseIntOrNull(body.userId);
            let clinicId = parseIntOrNull(body.clinicId);
            let roomId = parseIntOrNull(body.roomId);

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

            await pool.request()
                .input('id', sql.Int, id)
                .input('userId', sql.Int, userId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId)
                .input('startDate', sql.Date, body.startDate)
                .input('endDate', sql.Date, body.endDate)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('daysOfWeek', sql.NVarChar, body.daysOfWeek)
                .input('color', sql.NVarChar, body.color || null)
                .input('notes', sql.NVarChar, body.notes)
                .query(`UPDATE Schedules
                        SET UserId = COALESCE(@userId, UserId),
                            ClinicId = COALESCE(@clinicId, ClinicId),
                            RoomId = @roomId,
                            StartDate=@startDate,
                            EndDate=@endDate,
                            StartTime=@startTime,
                            EndTime=@endTime,
                            DaysOfWeek=@daysOfWeek,
                            Color = COALESCE(@color, Color),
                            Notes=@notes,
                            ModifiedDate=GETUTCDATE()
                        WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Schedule updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Schedules SET IsActive = 0 WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Schedule deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
