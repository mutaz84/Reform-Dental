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
        toUser: row.toUser,
        fromUser: row.fromUser,
        type: row.type,
        message: row.message,
        createdAt: row.createdAt,
        read: !!row.read
    };
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
            const toUser = (req.query && req.query.to ? String(req.query.to) : '').trim();
            const unread = (req.query && req.query.unread ? String(req.query.unread) : '').trim();
            const limitRaw = (req.query && req.query.limit ? String(req.query.limit) : '').trim();
            const limit = Math.min(Math.max(toIntOrNull(limitRaw) || 50, 1), 200);

            if (!toUser) {
                context.res = { status: 400, headers, body: { error: 'Missing to (recipient user).' } };
                return;
            }

            const request = pool.request()
                .input('toUser', sql.NVarChar, toUser)
                .input('limit', sql.Int, limit);

            let where = 'WHERE ToUser = @toUser';
            if (unread === '1' || unread.toLowerCase() === 'true') {
                where += ' AND IsRead = 0';
            }

            const result = await request.query(`
                SELECT TOP (@limit)
                  Id AS id,
                  RequestId AS requestId,
                  ToUser AS toUser,
                  FromUser AS fromUser,
                  NotificationType AS type,
                  Message AS message,
                  CreatedAt AS createdAt,
                  IsRead AS [read]
                FROM RequestNotifications
                ${where}
                ORDER BY CreatedAt DESC
            `);

            context.res = { status: 200, headers, body: (result.recordset || []).map(mapRow) };
            return;
        }

        if (method === 'POST') {
            const requestId = toIntOrNull(body.requestId);
            const toUser = (body.toUser !== undefined && body.toUser !== null ? String(body.toUser) : '').trim();
            const fromUser = (body.fromUser !== undefined && body.fromUser !== null ? String(body.fromUser) : '').trim();
            const type = (body.type !== undefined && body.type !== null ? String(body.type) : 'update').trim();
            const message = (body.message !== undefined && body.message !== null ? String(body.message) : '').trim();

            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }
            if (!toUser) {
                context.res = { status: 400, headers, body: { error: 'Missing toUser.' } };
                return;
            }
            if (!message) {
                context.res = { status: 400, headers, body: { error: 'Missing message.' } };
                return;
            }

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .input('toUser', sql.NVarChar, toUser)
                .input('fromUser', sql.NVarChar, fromUser || null)
                .input('type', sql.NVarChar, type || 'update')
                .input('message', sql.NVarChar, message)
                .query(`
                    INSERT INTO RequestNotifications
                      (RequestId, ToUser, FromUser, NotificationType, Message, CreatedAt, IsRead)
                    OUTPUT INSERTED.Id
                    VALUES
                      (@requestId, @toUser, @fromUser, @type, @message, SYSDATETIME(), 0)
                `);

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        if (method === 'PUT') {
            const markAllRead = !!body.markAllRead;
            const toUser = (body.toUser !== undefined && body.toUser !== null ? String(body.toUser) : '').trim();

            if (markAllRead) {
                if (!toUser) {
                    context.res = { status: 400, headers, body: { error: 'Missing toUser for markAllRead.' } };
                    return;
                }

                await pool.request()
                    .input('toUser', sql.NVarChar, toUser)
                    .query(`
                        UPDATE RequestNotifications
                        SET IsRead = 1,
                            ReadAt = SYSDATETIME()
                        WHERE ToUser = @toUser AND IsRead = 0
                    `);

                context.res = { status: 200, headers, body: { message: 'Marked all read' } };
                return;
            }

            const targetId = id !== null ? id : toIntOrNull(body.id);
            if (!targetId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric notification id.' } };
                return;
            }

            await pool.request()
                .input('id', sql.Int, targetId)
                .query(`
                    UPDATE RequestNotifications
                    SET IsRead = 1,
                        ReadAt = SYSDATETIME()
                    WHERE Id = @id
                `);

            context.res = { status: 200, headers, body: { id: targetId } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Request Notifications API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
