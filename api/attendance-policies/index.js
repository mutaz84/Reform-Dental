const sql = require('mssql');

let sharedPoolPromise = null;

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

async function getPool() {
    if (sharedPoolPromise) {
        try {
            const existing = await sharedPoolPromise;
            if (existing && (existing.connected || existing.connecting)) {
                return existing;
            }
            sharedPoolPromise = null;
        } catch (_) {
            sharedPoolPromise = null;
        }
    }

    sharedPoolPromise = sql.connect(getConfig()).catch((error) => {
        sharedPoolPromise = null;
        throw error;
    });
    return sharedPoolPromise;
}

async function resetPool() {
    if (!sharedPoolPromise) return;
    const existing = sharedPoolPromise;
    sharedPoolPromise = null;
    try {
        const pool = await existing;
        if (pool && typeof pool.close === 'function') {
            await pool.close();
        }
    } catch (_) {}
}

function isConnectionError(error) {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return [
        code.includes('econn'),
        code.includes('socket'),
        code.includes('timeout'),
        code.includes('enotopen'),
        message.includes('connection'),
        message.includes('socket'),
        message.includes('timeout'),
        message.includes('closed')
    ].some(Boolean);
}

function mapRow(row) {
    return {
        id: row.Id,
        username: row.Username,
        allowFlex: !!row.AllowFlex,
        beforeMins: row.BeforeMins || 0,
        afterMins: row.AfterMins || 0,
        modifiedBy: row.ModifiedBy || null,
        modifiedDate: row.ModifiedDate
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

    try {
        const method = req.method;
        const routeUsername = String(req.params?.username || '').trim();

        const handle = async () => {
            const pool = await getPool();

            if (method === 'GET') {
                const username = routeUsername || String(req.query?.username || '').trim();
                if (username) {
                    const one = await pool.request()
                        .input('username', sql.NVarChar(150), username)
                        .query('SELECT * FROM AttendancePolicies WHERE Username = @username');
                    context.res = { status: 200, headers, body: one.recordset[0] ? mapRow(one.recordset[0]) : null };
                    return;
                }

                const all = await pool.request().query('SELECT * FROM AttendancePolicies ORDER BY Username');
                context.res = { status: 200, headers, body: (all.recordset || []).map(mapRow) };
                return;
            }

            if (method === 'POST' || method === 'PUT') {
                const body = req.body || {};
                const username = String(body.username || routeUsername || '').trim();
                if (!username) {
                    context.res = { status: 400, headers, body: { error: 'username is required.' } };
                    return;
                }

                const allowFlex = !!body.allowFlex;
                const beforeMins = Math.max(0, Number.parseInt(String(body.beforeMins || 0), 10) || 0);
                const afterMins = Math.max(0, Number.parseInt(String(body.afterMins || 0), 10) || 0);
                const modifiedBy = body.modifiedBy ? String(body.modifiedBy) : null;

                const existing = await pool.request()
                    .input('username', sql.NVarChar(150), username)
                    .query('SELECT TOP 1 Id FROM AttendancePolicies WHERE Username = @username');

                if (existing.recordset[0]?.Id) {
                    await pool.request()
                        .input('username', sql.NVarChar(150), username)
                        .input('allowFlex', sql.Bit, allowFlex)
                        .input('beforeMins', sql.Int, beforeMins)
                        .input('afterMins', sql.Int, afterMins)
                        .input('modifiedBy', sql.NVarChar(255), modifiedBy)
                        .query(`UPDATE AttendancePolicies
                                SET AllowFlex = @allowFlex,
                                    BeforeMins = @beforeMins,
                                    AfterMins = @afterMins,
                                    ModifiedBy = @modifiedBy,
                                    ModifiedDate = SYSDATETIME()
                                WHERE Username = @username`);

                    context.res = { status: 200, headers, body: { username, upserted: true } };
                    return;
                }

                await pool.request()
                    .input('username', sql.NVarChar(150), username)
                    .input('allowFlex', sql.Bit, allowFlex)
                    .input('beforeMins', sql.Int, beforeMins)
                    .input('afterMins', sql.Int, afterMins)
                    .input('modifiedBy', sql.NVarChar(255), modifiedBy)
                    .query(`INSERT INTO AttendancePolicies (Username, AllowFlex, BeforeMins, AfterMins, ModifiedBy)
                            VALUES (@username, @allowFlex, @beforeMins, @afterMins, @modifiedBy)`);

                context.res = { status: 201, headers, body: { username, upserted: false } };
                return;
            }

            context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
        };

        try {
            await handle();
        } catch (err) {
            if (isConnectionError(err)) {
                await resetPool();
                await handle();
            } else {
                throw err;
            }
        }
    } catch (err) {
        context.log.error('Attendance Policies API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    }
};
