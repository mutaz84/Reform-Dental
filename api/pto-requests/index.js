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

function toDateTimeOrNull(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function mapRow(row) {
    return {
        id: String(row.Id),
        username: row.Username,
        employeeName: row.EmployeeName,
        startDate: row.StartDate,
        endDate: row.EndDate,
        hours: Number(row.Hours || 0),
        reason: row.Reason || '',
        status: row.Status || 'pending',
        reviewedBy: row.ReviewedBy || null,
        reviewedAt: row.ReviewedAt,
        createdAt: row.CreatedAt
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

    try {
        const method = req.method;
        const id = toIntOrNull(req.params?.id);

        const handle = async () => {
            const pool = await getPool();

            if (method === 'GET') {
                if (id) {
                    const one = await pool.request()
                        .input('id', sql.Int, id)
                        .query('SELECT * FROM PtoRequests WHERE Id = @id');
                    context.res = { status: 200, headers, body: one.recordset[0] ? mapRow(one.recordset[0]) : null };
                    return;
                }

                const username = String(req.query?.username || '').trim();
                const status = String(req.query?.status || '').trim();
                const request = pool.request();
                const where = [];

                if (username) {
                    request.input('username', sql.NVarChar(150), username);
                    where.push('Username = @username');
                }
                if (status) {
                    request.input('status', sql.NVarChar(30), status);
                    where.push('Status = @status');
                }

                const result = await request.query(`SELECT * FROM PtoRequests ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CreatedAt DESC, Id DESC`);
                context.res = { status: 200, headers, body: (result.recordset || []).map(mapRow) };
                return;
            }

            if (method === 'POST') {
                const body = req.body || {};
                const username = String(body.username || '').trim();
                const startDate = toDateOnly(body.startDate);
                const endDate = toDateOnly(body.endDate);
                const hours = Number(body.hours || 0);

                if (!username || !startDate || !endDate || !Number.isFinite(hours) || hours <= 0) {
                    context.res = { status: 400, headers, body: { error: 'username, startDate, endDate, hours are required.' } };
                    return;
                }

                const insert = await pool.request()
                    .input('username', sql.NVarChar(150), username)
                    .input('employeeName', sql.NVarChar(255), body.employeeName || username)
                    .input('startDate', sql.Date, startDate)
                    .input('endDate', sql.Date, endDate)
                    .input('hours', sql.Decimal(10, 2), hours)
                    .input('reason', sql.NVarChar(sql.MAX), body.reason || null)
                    .input('status', sql.NVarChar(30), body.status || 'pending')
                    .query(`INSERT INTO PtoRequests (Username, EmployeeName, StartDate, EndDate, Hours, Reason, Status)
                            OUTPUT INSERTED.Id
                            VALUES (@username, @employeeName, @startDate, @endDate, @hours, @reason, @status)`);

                context.res = { status: 201, headers, body: { id: String(insert.recordset[0].Id) } };
                return;
            }

            if (method === 'PUT' && id) {
                const body = req.body || {};
                const status = body.status ? String(body.status).trim() : null;

                await pool.request()
                    .input('id', sql.Int, id)
                    .input('username', sql.NVarChar(150), body.username || null)
                    .input('employeeName', sql.NVarChar(255), body.employeeName || null)
                    .input('startDate', sql.Date, toDateOnly(body.startDate))
                    .input('endDate', sql.Date, toDateOnly(body.endDate))
                    .input('hours', sql.Decimal(10, 2), Number.isFinite(Number(body.hours)) ? Number(body.hours) : null)
                    .input('reason', sql.NVarChar(sql.MAX), body.reason || null)
                    .input('status', sql.NVarChar(30), status)
                    .input('reviewedBy', sql.NVarChar(255), body.reviewedBy || null)
                    .input('reviewedAt', sql.DateTime2, toDateTimeOrNull(body.reviewedAt) || (status ? new Date() : null))
                    .query(`UPDATE PtoRequests
                            SET Username = COALESCE(@username, Username),
                                EmployeeName = COALESCE(@employeeName, EmployeeName),
                                StartDate = COALESCE(@startDate, StartDate),
                                EndDate = COALESCE(@endDate, EndDate),
                                Hours = COALESCE(@hours, Hours),
                                Reason = COALESCE(@reason, Reason),
                                Status = COALESCE(@status, Status),
                                ReviewedBy = CASE WHEN @status IS NULL THEN ReviewedBy ELSE @reviewedBy END,
                                ReviewedAt = CASE WHEN @status IS NULL THEN ReviewedAt ELSE COALESCE(@reviewedAt, SYSDATETIME()) END,
                                ModifiedDate = SYSDATETIME()
                            WHERE Id = @id`);

                context.res = { status: 200, headers, body: { id: String(id) } };
                return;
            }

            if (method === 'DELETE' && id) {
                await pool.request().input('id', sql.Int, id).query('DELETE FROM PtoRequests WHERE Id = @id');
                context.res = { status: 200, headers, body: { message: 'PTO request deleted' } };
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
        context.log.error('PTO Requests API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    }
};
