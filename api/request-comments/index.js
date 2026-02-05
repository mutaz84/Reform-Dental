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
        text: row.text,
        createdBy: row.createdBy,
        createdAt: row.createdAt
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
        const id = toIntOrNull(req.params && req.params.id);
        const body = req.body || {};

        if (method === 'GET') {
            const requestId = toIntOrNull((req.query && req.query.requestId) || (req.query && req.query.requestID));
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
                      CommentText AS [text],
                      CreatedBy AS createdBy,
                      CreatedAt AS createdAt
                    FROM RequestComments
                    WHERE RequestId = @requestId
                    ORDER BY CreatedAt ASC
                `);

            context.res = { status: 200, headers, body: (result.recordset || []).map(mapRow) };
            return;
        }

        if (method === 'POST') {
            const requestId = toIntOrNull(body.requestId);
            const text = (body.text !== undefined && body.text !== null ? String(body.text) : '').trim();
            const createdBy = (body.createdBy !== undefined && body.createdBy !== null ? String(body.createdBy) : '').trim();

            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }
            if (!text) {
                context.res = { status: 400, headers, body: { error: 'Missing comment text.' } };
                return;
            }

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .input('text', sql.NVarChar(sql.MAX), text)
                .input('createdBy', sql.NVarChar, createdBy || null)
                .query(`
                    INSERT INTO RequestComments
                      (RequestId, CommentText, CreatedBy, CreatedAt)
                    OUTPUT INSERTED.Id
                    VALUES
                      (@requestId, @text, @createdBy, SYSDATETIME())
                `);

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        if (method === 'DELETE') {
            const targetId = id !== null ? id : toIntOrNull(body.id);
            if (!targetId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric comment id.' } };
                return;
            }

            await pool.request()
                .input('id', sql.Int, targetId)
                .query('DELETE FROM RequestComments WHERE Id = @id');

            context.res = { status: 200, headers, body: { message: 'Comment deleted', id: targetId } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Request Comments API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
