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

function toIntOrNull(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toDateOnly(value) {
    if (!value) return null;
    const str = String(value).trim();
    const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
}

function toTimeOrNull(value) {
    if (!value) return null;
    const str = String(value).trim();
    const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const hh = String(Number(m[1])).padStart(2, '0');
    const mm = m[2];
    const ss = m[3] || '00';
    return `${hh}:${mm}:${ss}`;
}

function toDateTimeOrNull(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseFlags(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function mapRecord(row) {
    return {
        id: row.Id,
        localId: row.LocalRecordId,
        userId: row.UserId,
        username: row.Username,
        displayName: row.DisplayName,
        date: row.WorkDate,
        scheduledStart: row.ScheduledStart,
        scheduledEnd: row.ScheduledEnd,
        clockIn: row.ClockIn,
        clockOut: row.ClockOut,
        minutesWorked: row.MinutesWorked || 0,
        flags: parseFlags(row.FlagsJson),
        createdAt: row.CreatedDate,
        modifiedAt: row.ModifiedDate
    };
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

    let pool;
    try {
        pool = await sql.connect(getConfig());
        const id = toIntOrNull(req.params?.id);
        const method = req.method;

        if (method === 'GET') {
            if (id) {
                const one = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM AttendanceRecords WHERE Id = @id');
                context.res = { status: 200, headers, body: one.recordset[0] ? mapRecord(one.recordset[0]) : null };
                return;
            }

            const username = String(req.query?.username || '').trim();
            const date = toDateOnly(req.query?.date);
            const from = toDateOnly(req.query?.fromDate);
            const to = toDateOnly(req.query?.toDate);

            const request = pool.request();
            const where = [];
            if (username) {
                request.input('username', sql.NVarChar(150), username);
                where.push('Username = @username');
            }
            if (date) {
                request.input('date', sql.Date, date);
                where.push('WorkDate = @date');
            }
            if (from) {
                request.input('fromDate', sql.Date, from);
                where.push('WorkDate >= @fromDate');
            }
            if (to) {
                request.input('toDate', sql.Date, to);
                where.push('WorkDate <= @toDate');
            }

            const sqlText = `SELECT * FROM AttendanceRecords ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY WorkDate DESC, Id DESC`;
            const all = await request.query(sqlText);
            context.res = { status: 200, headers, body: (all.recordset || []).map(mapRecord) };
            return;
        }

        if (method === 'POST') {
            const body = req.body || {};
            const username = String(body.username || '').trim();
            const workDate = toDateOnly(body.date || body.workDate);
            if (!username || !workDate) {
                context.res = { status: 400, headers, body: { error: 'username and date are required.' } };
                return;
            }

            const exists = await pool.request()
                .input('username', sql.NVarChar(150), username)
                .input('workDate', sql.Date, workDate)
                .query('SELECT TOP 1 Id FROM AttendanceRecords WHERE Username = @username AND WorkDate = @workDate');

            const payload = {
                localId: body.localId || body.id || null,
                userId: toIntOrNull(body.userId),
                username,
                displayName: body.displayName || null,
                workDate,
                scheduledStart: toTimeOrNull(body.scheduledStart),
                scheduledEnd: toTimeOrNull(body.scheduledEnd),
                clockIn: toDateTimeOrNull(body.clockIn),
                clockOut: toDateTimeOrNull(body.clockOut),
                minutesWorked: Math.max(0, Number.parseInt(String(body.minutesWorked || 0), 10) || 0),
                flagsJson: JSON.stringify(parseFlags(body.flags))
            };

            if (exists.recordset[0]?.Id) {
                const targetId = exists.recordset[0].Id;
                await pool.request()
                    .input('id', sql.Int, targetId)
                    .input('localId', sql.NVarChar(120), payload.localId)
                    .input('userId', sql.Int, payload.userId)
                    .input('displayName', sql.NVarChar(255), payload.displayName)
                    .input('scheduledStart', sql.Time, payload.scheduledStart)
                    .input('scheduledEnd', sql.Time, payload.scheduledEnd)
                    .input('clockIn', sql.DateTime2, payload.clockIn)
                    .input('clockOut', sql.DateTime2, payload.clockOut)
                    .input('minutesWorked', sql.Int, payload.minutesWorked)
                    .input('flagsJson', sql.NVarChar(sql.MAX), payload.flagsJson)
                    .query(`UPDATE AttendanceRecords
                            SET LocalRecordId = @localId,
                                UserId = COALESCE(@userId, UserId),
                                DisplayName = @displayName,
                                ScheduledStart = @scheduledStart,
                                ScheduledEnd = @scheduledEnd,
                                ClockIn = @clockIn,
                                ClockOut = @clockOut,
                                MinutesWorked = @minutesWorked,
                                FlagsJson = @flagsJson,
                                ModifiedDate = SYSDATETIME()
                            WHERE Id = @id`);

                context.res = { status: 200, headers, body: { id: targetId, upserted: true } };
                return;
            }

            const insert = await pool.request()
                .input('localId', sql.NVarChar(120), payload.localId)
                .input('userId', sql.Int, payload.userId)
                .input('username', sql.NVarChar(150), payload.username)
                .input('displayName', sql.NVarChar(255), payload.displayName)
                .input('workDate', sql.Date, payload.workDate)
                .input('scheduledStart', sql.Time, payload.scheduledStart)
                .input('scheduledEnd', sql.Time, payload.scheduledEnd)
                .input('clockIn', sql.DateTime2, payload.clockIn)
                .input('clockOut', sql.DateTime2, payload.clockOut)
                .input('minutesWorked', sql.Int, payload.minutesWorked)
                .input('flagsJson', sql.NVarChar(sql.MAX), payload.flagsJson)
                .query(`INSERT INTO AttendanceRecords
                        (LocalRecordId, UserId, Username, DisplayName, WorkDate, ScheduledStart, ScheduledEnd, ClockIn, ClockOut, MinutesWorked, FlagsJson)
                        OUTPUT INSERTED.Id
                        VALUES
                        (@localId, @userId, @username, @displayName, @workDate, @scheduledStart, @scheduledEnd, @clockIn, @clockOut, @minutesWorked, @flagsJson)`);

            context.res = { status: 201, headers, body: { id: insert.recordset[0].Id, upserted: false } };
            return;
        }

        if (method === 'PUT' && id) {
            const body = req.body || {};
            await pool.request()
                .input('id', sql.Int, id)
                .input('localId', sql.NVarChar(120), body.localId || body.id || null)
                .input('userId', sql.Int, toIntOrNull(body.userId))
                .input('username', sql.NVarChar(150), body.username || null)
                .input('displayName', sql.NVarChar(255), body.displayName || null)
                .input('workDate', sql.Date, toDateOnly(body.date || body.workDate))
                .input('scheduledStart', sql.Time, toTimeOrNull(body.scheduledStart))
                .input('scheduledEnd', sql.Time, toTimeOrNull(body.scheduledEnd))
                .input('clockIn', sql.DateTime2, toDateTimeOrNull(body.clockIn))
                .input('clockOut', sql.DateTime2, toDateTimeOrNull(body.clockOut))
                .input('minutesWorked', sql.Int, Math.max(0, Number.parseInt(String(body.minutesWorked || 0), 10) || 0))
                .input('flagsJson', sql.NVarChar(sql.MAX), JSON.stringify(parseFlags(body.flags)))
                .query(`UPDATE AttendanceRecords
                        SET LocalRecordId = COALESCE(@localId, LocalRecordId),
                            UserId = COALESCE(@userId, UserId),
                            Username = COALESCE(@username, Username),
                            DisplayName = COALESCE(@displayName, DisplayName),
                            WorkDate = COALESCE(@workDate, WorkDate),
                            ScheduledStart = @scheduledStart,
                            ScheduledEnd = @scheduledEnd,
                            ClockIn = @clockIn,
                            ClockOut = @clockOut,
                            MinutesWorked = @minutesWorked,
                            FlagsJson = @flagsJson,
                            ModifiedDate = SYSDATETIME()
                        WHERE Id = @id`);

            context.res = { status: 200, headers, body: { id } };
            return;
        }

        if (method === 'DELETE' && id) {
            await pool.request().input('id', sql.Int, id).query('DELETE FROM AttendanceRecords WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Attendance record deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Attendance Records API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
