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
    const raw = value !== undefined && value !== null ? String(value) : '';
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return null;
    return parseInt(raw, 10);
}

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name || '').toLowerCase());
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
        const routingLogColumns = await getTableColumns(pool, 'RequestRoutingLog');

        const requestIdColumn = hasColumn(routingLogColumns, 'RequestId') ? 'RequestId' : null;
        const fromUserColumn = hasColumn(routingLogColumns, 'FromUser') ? 'FromUser' : null;
        const toUserColumn = hasColumn(routingLogColumns, 'ToUser') ? 'ToUser' : null;
        const actionColumn = hasColumn(routingLogColumns, 'EventType') ? 'EventType' : (hasColumn(routingLogColumns, 'Action') ? 'Action' : null);
        const noteColumn = hasColumn(routingLogColumns, 'Message') ? 'Message' : (hasColumn(routingLogColumns, 'Note') ? 'Note' : null);
        const actorColumn = hasColumn(routingLogColumns, 'Actor') ? 'Actor' : null;
        const createdAtColumn = hasColumn(routingLogColumns, 'CreatedAt') ? 'CreatedAt' : null;

        if (!requestIdColumn || !actionColumn) {
            context.res = {
                status: 500,
                headers,
                body: { error: 'RequestRoutingLog schema is missing required columns (RequestId/EventType or Action).' }
            };
            return;
        }

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
                                            ${requestIdColumn} AS requestId,
                                            ${fromUserColumn ? `${fromUserColumn} AS fromUser` : 'NULL AS fromUser'},
                                            ${toUserColumn ? `${toUserColumn} AS toUser` : 'NULL AS toUser'},
                                            ${actionColumn} AS action,
                                            ${noteColumn ? `${noteColumn} AS note` : 'NULL AS note'},
                                            ${createdAtColumn ? `${createdAtColumn} AS createdAt` : 'SYSUTCDATETIME() AS createdAt'}
                    FROM RequestRoutingLog
                                        WHERE ${requestIdColumn} = @requestId
                                        ORDER BY ${createdAtColumn || 'Id'} ASC
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
            const actor = (body.actor !== undefined && body.actor !== null ? String(body.actor) : '').trim() || fromUser || null;

            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }
            if (!toUser) {
                context.res = { status: 400, headers, body: { error: 'Missing toUser.' } };
                return;
            }

            const insertColumns = [requestIdColumn, actionColumn];
            const insertValues = ['@requestId', '@action'];
            const request = pool.request()
                .input('requestId', sql.Int, requestId)
                .input('action', sql.NVarChar, action);

            if (fromUserColumn) {
                insertColumns.push(fromUserColumn);
                insertValues.push('@fromUser');
                request.input('fromUser', sql.NVarChar, fromUser || null);
            }

            if (toUserColumn) {
                insertColumns.push(toUserColumn);
                insertValues.push('@toUser');
                request.input('toUser', sql.NVarChar, toUser);
            }

            if (noteColumn) {
                insertColumns.push(noteColumn);
                insertValues.push('@note');
                request.input('note', sql.NVarChar, note || null);
            }

            if (actorColumn) {
                insertColumns.push(actorColumn);
                insertValues.push('@actor');
                request.input('actor', sql.NVarChar, actor);
            }

            if (createdAtColumn) {
                insertColumns.push(createdAtColumn);
                insertValues.push('SYSDATETIME()');
            }

            const result = await request.query(`
                INSERT INTO RequestRoutingLog
                  (${insertColumns.join(', ')})
                OUTPUT INSERTED.Id
                VALUES
                  (${insertValues.join(', ')})
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
