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

function mapRow(row) {
    return {
        id: row.Id,
        user: row.Username,
        message: row.Message,
        type: row.NotificationType,
        createdAt: row.CreatedAt
    };
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
            const username = String(req.query?.username || req.query?.user || '').trim();
            const limit = Math.min(Math.max(toIntOrNull(req.query?.limit) || 100, 1), 500);

            const request = pool.request().input('limit', sql.Int, limit);
            let where = '';
            if (username) {
                request.input('username', sql.NVarChar(150), username);
                where = 'WHERE Username = @username';
            }

            if (id) {
                const one = await pool.request().input('id', sql.Int, id).query('SELECT * FROM AttendanceNotifications WHERE Id = @id');
                context.res = { status: 200, headers, body: one.recordset[0] ? mapRow(one.recordset[0]) : null };
                return;
            }

            const result = await request.query(`SELECT TOP (@limit) * FROM AttendanceNotifications ${where} ORDER BY CreatedAt DESC, Id DESC`);
            context.res = { status: 200, headers, body: (result.recordset || []).map(mapRow) };
            return;
        }

        if (method === 'POST') {
            const body = req.body || {};
            const user = String(body.user || body.username || '').trim();
            const message = String(body.message || '').trim();
            const type = String(body.type || 'info').trim();

            if (!user || !message) {
                context.res = { status: 400, headers, body: { error: 'user and message are required.' } };
                return;
            }

            const insert = await pool.request()
                .input('user', sql.NVarChar(150), user)
                .input('message', sql.NVarChar(1000), message)
                .input('type', sql.NVarChar(50), type || 'info')
                .query(`INSERT INTO AttendanceNotifications (Username, Message, NotificationType)
                        OUTPUT INSERTED.Id
                        VALUES (@user, @message, @type)`);

            context.res = { status: 201, headers, body: { id: insert.recordset[0].Id } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Attendance Notifications API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
