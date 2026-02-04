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

function parseDateOnly(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function mapRow(row) {
    return {
        id: row.id,
        title: row.title,
        type: row.type,
        priority: row.priority,
        status: row.status,
        requestedBy: row.requestedBy,
        assignedTo: row.assignedTo,
        neededBy: row.neededBy,
        location: row.location,
        description: row.description,
        requestedAt: row.requestedAt,
        updatedAt: row.updatedAt
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
        const idRaw = req.params && req.params.id ? String(req.params.id) : '';
        const id = idRaw && /^\d+$/.test(idRaw) ? parseInt(idRaw, 10) : null;
        const method = req.method;
        const body = req.body || {};

        if (method === 'GET') {
            if (id !== null) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`
                        SELECT
                          Id AS id,
                          Title AS title,
                          Type AS type,
                          Priority AS priority,
                          Status AS status,
                          RequestedBy AS requestedBy,
                          AssignedTo AS assignedTo,
                          NeededBy AS neededBy,
                          Location AS location,
                          Description AS description,
                          RequestedAt AS requestedAt,
                          UpdatedAt AS updatedAt
                        FROM Requests
                        WHERE Id = @id
                    `);

                context.res = {
                    status: 200,
                    headers,
                    body: result.recordset[0] ? mapRow(result.recordset[0]) : null
                };
                return;
            }

            const result = await pool.request().query(`
                SELECT
                  Id AS id,
                  Title AS title,
                  Type AS type,
                  Priority AS priority,
                  Status AS status,
                  RequestedBy AS requestedBy,
                  AssignedTo AS assignedTo,
                  NeededBy AS neededBy,
                  Location AS location,
                  Description AS description,
                  RequestedAt AS requestedAt,
                  UpdatedAt AS updatedAt
                FROM Requests
                ORDER BY RequestedAt DESC
            `);

            context.res = {
                status: 200,
                headers,
                body: (result.recordset || []).map(mapRow)
            };
            return;
        }

        if (method === 'POST') {
            const now = new Date();
            const neededBy = parseDateOnly(body.neededBy);

            const result = await pool.request()
                .input('title', sql.NVarChar, (body.title || '').trim())
                .input('type', sql.NVarChar, body.type || '')
                .input('priority', sql.NVarChar, body.priority || '')
                .input('status', sql.NVarChar, body.status || 'New')
                .input('requestedBy', sql.NVarChar, body.requestedBy || '')
                .input('assignedTo', sql.NVarChar, body.assignedTo || null)
                .input('neededBy', sql.Date, neededBy)
                .input('location', sql.NVarChar, body.location || null)
                .input('description', sql.NVarChar, (body.description || '').trim())
                .input('requestedAt', sql.DateTime2, now)
                .input('updatedAt', sql.DateTime2, now)
                .query(`
                    INSERT INTO Requests
                      (Title, Type, Priority, Status, RequestedBy, AssignedTo, NeededBy, Location, Description, RequestedAt, UpdatedAt)
                    OUTPUT INSERTED.Id
                    VALUES
                      (@title, @type, @priority, @status, @requestedBy, @assignedTo, @neededBy, @location, @description, @requestedAt, @updatedAt)
                `);

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        if (method === 'PUT') {
            const bodyIdRaw = body.id !== undefined && body.id !== null ? String(body.id) : '';
            const bodyId = bodyIdRaw && /^\d+$/.test(bodyIdRaw) ? parseInt(bodyIdRaw, 10) : null;
            const targetId = id !== null ? id : bodyId;

            if (targetId === null) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric request id.' } };
                return;
            }

            const neededBy = parseDateOnly(body.neededBy);

            await pool.request()
                .input('id', sql.Int, targetId)
                .input('title', sql.NVarChar, (body.title || '').trim())
                .input('type', sql.NVarChar, body.type || '')
                .input('priority', sql.NVarChar, body.priority || '')
                .input('status', sql.NVarChar, body.status || '')
                .input('requestedBy', sql.NVarChar, body.requestedBy || '')
                .input('assignedTo', sql.NVarChar, body.assignedTo || null)
                .input('neededBy', sql.Date, neededBy)
                .input('location', sql.NVarChar, body.location || null)
                .input('description', sql.NVarChar, (body.description || '').trim())
                .query(`
                    UPDATE Requests
                    SET
                      Title=@title,
                      Type=@type,
                      Priority=@priority,
                      Status=@status,
                      RequestedBy=@requestedBy,
                      AssignedTo=@assignedTo,
                      NeededBy=@neededBy,
                      Location=@location,
                      Description=@description,
                      UpdatedAt=SYSDATETIME()
                    WHERE Id=@id
                `);

            context.res = { status: 200, headers, body: { id: targetId } };
            return;
        }

        if (method === 'DELETE') {
            if (id === null) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric request id.' } };
                return;
            }

            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Requests WHERE Id = @id');

            context.res = { status: 200, headers, body: { message: 'Request deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Requests API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
