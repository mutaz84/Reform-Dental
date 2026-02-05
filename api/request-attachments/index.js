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

function toBool(value) {
    const raw = value !== undefined && value !== null ? String(value).trim().toLowerCase() : '';
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

function mapRow(row, includeData) {
    const base = {
        id: row.id,
        requestId: row.requestId,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        uploadedBy: row.uploadedBy,
        uploadedAt: row.uploadedAt
    };
    if (includeData) {
        base.dataBase64 = row.data ? Buffer.from(row.data).toString('base64') : null;
    }
    return base;
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
            const includeData = toBool((req.query && req.query.includeData) || (req.query && req.query.data));

            if (id !== null) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`
                        SELECT
                          Id AS id,
                          RequestId AS requestId,
                          FileName AS fileName,
                          ContentType AS contentType,
                          SizeBytes AS sizeBytes,
                          Data AS data,
                          UploadedBy AS uploadedBy,
                          UploadedAt AS uploadedAt
                        FROM RequestAttachments
                        WHERE Id = @id
                    `);

                context.res = { status: 200, headers, body: result.recordset[0] ? mapRow(result.recordset[0], true) : null };
                return;
            }

            const requestId = toIntOrNull((req.query && req.query.requestId) || (req.query && req.query.requestID));
            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }

            const query = includeData ? `
                SELECT
                  Id AS id,
                  RequestId AS requestId,
                  FileName AS fileName,
                  ContentType AS contentType,
                  SizeBytes AS sizeBytes,
                  Data AS data,
                  UploadedBy AS uploadedBy,
                  UploadedAt AS uploadedAt
                FROM RequestAttachments
                WHERE RequestId = @requestId
                ORDER BY UploadedAt ASC
            ` : `
                SELECT
                  Id AS id,
                  RequestId AS requestId,
                  FileName AS fileName,
                  ContentType AS contentType,
                  SizeBytes AS sizeBytes,
                  CAST(NULL AS VARBINARY(MAX)) AS data,
                  UploadedBy AS uploadedBy,
                  UploadedAt AS uploadedAt
                FROM RequestAttachments
                WHERE RequestId = @requestId
                ORDER BY UploadedAt ASC
            `;

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .query(query);

            context.res = { status: 200, headers, body: (result.recordset || []).map(r => mapRow(r, includeData)) };
            return;
        }

        if (method === 'POST') {
            const requestId = toIntOrNull(body.requestId);
            const fileName = (body.fileName !== undefined && body.fileName !== null ? String(body.fileName) : '').trim();
            const contentType = (body.contentType !== undefined && body.contentType !== null ? String(body.contentType) : '').trim() || 'application/octet-stream';
            const dataBase64 = (body.dataBase64 !== undefined && body.dataBase64 !== null ? String(body.dataBase64) : '').trim();
            const uploadedBy = (body.uploadedBy !== undefined && body.uploadedBy !== null ? String(body.uploadedBy) : '').trim();

            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }
            if (!fileName) {
                context.res = { status: 400, headers, body: { error: 'Missing fileName.' } };
                return;
            }
            if (!dataBase64) {
                context.res = { status: 400, headers, body: { error: 'Missing dataBase64.' } };
                return;
            }

            // Basic safety limit (base64 overhead included). Adjust if needed.
            // ~8MB base64 ~ 6MB binary.
            if (dataBase64.length > 8_000_000) {
                context.res = { status: 413, headers, body: { error: 'Attachment too large. Please upload a smaller file.' } };
                return;
            }

            let buffer;
            try {
                buffer = Buffer.from(dataBase64, 'base64');
            } catch (_) {
                context.res = { status: 400, headers, body: { error: 'Invalid base64 data.' } };
                return;
            }

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .input('fileName', sql.NVarChar(255), fileName)
                .input('contentType', sql.NVarChar(150), contentType)
                .input('sizeBytes', sql.Int, buffer.length)
                .input('data', sql.VarBinary(sql.MAX), buffer)
                .input('uploadedBy', sql.NVarChar(255), uploadedBy || null)
                .query(`
                    INSERT INTO RequestAttachments
                      (RequestId, FileName, ContentType, SizeBytes, Data, UploadedBy, UploadedAt)
                    OUTPUT INSERTED.Id
                    VALUES
                      (@requestId, @fileName, @contentType, @sizeBytes, @data, @uploadedBy, SYSDATETIME())
                `);

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, sizeBytes: buffer.length } };
            return;
        }

        if (method === 'DELETE') {
            const targetId = id !== null ? id : toIntOrNull(body.id);
            if (!targetId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric attachment id.' } };
                return;
            }

            await pool.request()
                .input('id', sql.Int, targetId)
                .query('DELETE FROM RequestAttachments WHERE Id = @id');

            context.res = { status: 200, headers, body: { message: 'Attachment deleted', id: targetId } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Request Attachments API error:', err);
        context.res = { status: 500, headers, body: { error: err.message || 'Server error' } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
