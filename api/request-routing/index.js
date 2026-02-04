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
    const raw = value !== undefined && value !== null ? String(value) : '';
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return null;
    return parseInt(raw, 10);
}

function mapRow(row) {
    return {
        id: row.id,
        requestId: row.requestId,
        fromUser: row.fromUser,
        toUser: row.toUser,
        action: row.action,
        note: row.note,
        createdAt: row.createdAt
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
        const body = req.body || {};

        if (method === 'GET') {
            const requestId = toIntOrNull((req.query && req.query.requestId) || (req.params && req.params.id));
            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .query(`
                    SELECT
                      Id AS id,
                      RequestId AS requestId,
                      FromUser AS fromUser,
                      ToUser AS toUser,
                      Action AS action,
                      Note AS note,
                      CreatedAt AS createdAt
                    FROM RequestRoutingLog
                    WHERE RequestId = @requestId
                    ORDER BY CreatedAt ASC
                `);

            context.res = { status: 200, headers, body: (result.recordset || []).map(mapRow) };
            return;
        }

        if (method === 'POST') {
            const requestId = toIntOrNull(body.requestId);
            const fromUser = (body.fromUser !== undefined && body.fromUser !== null ? String(body.fromUser) : '').trim();
            const toUser = (body.toUser !== undefined && body.toUser !== null ? String(body.toUser) : '').trim();
            const action = (body.action !== undefined && body.action !== null ? String(body.action) : '').trim() || 'forwarded';
            const note = (body.note !== undefined && body.note !== null ? String(body.note) : '').trim();

            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }
            if (!toUser) {
                context.res = { status: 400, headers, body: { error: 'Missing toUser.' } };
                return;
            }

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .input('fromUser', sql.NVarChar, fromUser || null)
                .input('toUser', sql.NVarChar, toUser)
                .input('action', sql.NVarChar, action)
                .input('note', sql.NVarChar, note || null)
                .query(`
                    INSERT INTO RequestRoutingLog
                      (RequestId, FromUser, ToUser, Action, Note, CreatedAt)
                    OUTPUT INSERTED.Id
                    VALUES
                      (@requestId, @fromUser, @toUser, @action, @note, SYSDATETIME())
                `);

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Request Routing API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
