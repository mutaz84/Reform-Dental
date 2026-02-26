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

function mapRow(row) {
    return {
        id: row.Id,
        username: row.Username,
        creditHours: Number(row.CreditHours || 0),
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

    let pool;
    try {
        pool = await sql.connect(getConfig());
        const method = req.method;
        const routeUsername = String(req.params?.username || '').trim();

        if (method === 'GET') {
            const username = routeUsername || String(req.query?.username || '').trim();
            if (username) {
                const one = await pool.request()
                    .input('username', sql.NVarChar(150), username)
                    .query('SELECT * FROM PtoCredits WHERE Username = @username');
                context.res = { status: 200, headers, body: one.recordset[0] ? mapRow(one.recordset[0]) : null };
                return;
            }

            const all = await pool.request().query('SELECT * FROM PtoCredits ORDER BY Username');
            context.res = { status: 200, headers, body: (all.recordset || []).map(mapRow) };
            return;
        }

        if (method === 'POST' || method === 'PUT') {
            const body = req.body || {};
            const username = String(body.username || routeUsername || '').trim();
            const creditHours = Math.max(0, Number(body.creditHours ?? body.hours ?? 0) || 0);
            const modifiedBy = body.modifiedBy ? String(body.modifiedBy) : null;

            if (!username) {
                context.res = { status: 400, headers, body: { error: 'username is required.' } };
                return;
            }

            const existing = await pool.request()
                .input('username', sql.NVarChar(150), username)
                .query('SELECT TOP 1 Id FROM PtoCredits WHERE Username = @username');

            if (existing.recordset[0]?.Id) {
                await pool.request()
                    .input('username', sql.NVarChar(150), username)
                    .input('creditHours', sql.Decimal(10, 2), creditHours)
                    .input('modifiedBy', sql.NVarChar(255), modifiedBy)
                    .query(`UPDATE PtoCredits
                            SET CreditHours = @creditHours,
                                ModifiedBy = @modifiedBy,
                                ModifiedDate = SYSDATETIME()
                            WHERE Username = @username`);

                context.res = { status: 200, headers, body: { username, creditHours, upserted: true } };
                return;
            }

            await pool.request()
                .input('username', sql.NVarChar(150), username)
                .input('creditHours', sql.Decimal(10, 2), creditHours)
                .input('modifiedBy', sql.NVarChar(255), modifiedBy)
                .query(`INSERT INTO PtoCredits (Username, CreditHours, ModifiedBy)
                        VALUES (@username, @creditHours, @modifiedBy)`);

            context.res = { status: 201, headers, body: { username, creditHours, upserted: false } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('PTO Credits API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
