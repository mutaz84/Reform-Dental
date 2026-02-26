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

function mapRow(row) {
    return {
        id: String(row.Id),
        username: row.Username,
        displayName: row.DisplayName,
        date: row.WorkDate,
        reason: row.Reason,
        recordedAt: row.RecordedAt
    };
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    let pool;
    try {
        pool = await sql.connect(getConfig());
        const method = req.method;
        const id = toIntOrNull(req.params?.id);

        if (method === 'GET') {
            if (id) {
                const one = await pool.request().input('id', sql.Int, id).query('SELECT * FROM AttendanceAbsences WHERE Id = @id');
                context.res = { status: 200, headers, body: one.recordset[0] ? mapRow(one.recordset[0]) : null };
                return;
            }

            const username = String(req.query?.username || '').trim();
            const date = toDateOnly(req.query?.date);
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

            const result = await request.query(`SELECT * FROM AttendanceAbsences ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY WorkDate DESC, Id DESC`);
            context.res = { status: 200, headers, body: (result.recordset || []).map(mapRow) };
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
                .query('SELECT TOP 1 Id FROM AttendanceAbsences WHERE Username = @username AND WorkDate = @workDate');

            if (exists.recordset[0]?.Id) {
                await pool.request()
                    .input('id', sql.Int, exists.recordset[0].Id)
                    .input('displayName', sql.NVarChar(255), body.displayName || null)
                    .input('reason', sql.NVarChar(500), body.reason || null)
                    .query(`UPDATE AttendanceAbsences
                            SET DisplayName = COALESCE(@displayName, DisplayName),
                                Reason = COALESCE(@reason, Reason)
                            WHERE Id = @id`);

                context.res = { status: 200, headers, body: { id: String(exists.recordset[0].Id), upserted: true } };
                return;
            }

            const insert = await pool.request()
                .input('username', sql.NVarChar(150), username)
                .input('displayName', sql.NVarChar(255), body.displayName || null)
                .input('workDate', sql.Date, workDate)
                .input('reason', sql.NVarChar(500), body.reason || null)
                .query(`INSERT INTO AttendanceAbsences (Username, DisplayName, WorkDate, Reason)
                        OUTPUT INSERTED.Id
                        VALUES (@username, @displayName, @workDate, @reason)`);

            context.res = { status: 201, headers, body: { id: String(insert.recordset[0].Id), upserted: false } };
            return;
        }

        if (method === 'DELETE' && id) {
            await pool.request().input('id', sql.Int, id).query('DELETE FROM AttendanceAbsences WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Absence deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Attendance Absences API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
