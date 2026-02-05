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

function normalizeBase64(data) {
    const raw = data !== undefined && data !== null ? String(data).trim() : '';
    if (!raw) return '';
    const match = raw.match(/^data:.*;base64,(.*)$/i);
    return match ? match[1] : raw;
}

function mapRow(row, includeData) {
    const mapped = {
        id: row.id,
        requestId: row.requestId,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        uploadedBy: row.uploadedBy,
        uploadedAt: row.uploadedAt
    };

    if (includeData && row.data) {
        mapped.dataBase64 = Buffer.from(row.data).toString('base64');
    }

    return mapped;
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
        const body = req.body || {};

        if (method === 'GET') {
            const requestId = toIntOrNull(req.query && req.query.requestId);
            const attachmentId = toIntOrNull((req.query && (req.query.id || req.query.attachmentId)) || (req.params && req.params.id));

            const includeDataRaw = (req.query && req.query.includeData ? String(req.query.includeData) : '').trim();
            const includeData = includeDataRaw === '1' || includeDataRaw.toLowerCase() === 'true';

            if (requestId) {
                const selectFields = includeData
                    ? 'Id AS id, RequestId AS requestId, FileName AS fileName, ContentType AS contentType, SizeBytes AS sizeBytes, UploadedBy AS uploadedBy, UploadedAt AS uploadedAt, Data AS data'
                    : 'Id AS id, RequestId AS requestId, FileName AS fileName, ContentType AS contentType, SizeBytes AS sizeBytes, UploadedBy AS uploadedBy, UploadedAt AS uploadedAt';

                const result = await pool.request()
                    .input('requestId', sql.Int, requestId)
                    .query(`
                        SELECT ${selectFields}
                        FROM RequestAttachments
                        WHERE RequestId = @requestId
                        ORDER BY UploadedAt ASC
                    `);

                context.res = {
                    status: 200,
                    headers,
                    body: (result.recordset || []).map(row => mapRow(row, includeData))
                };
                return;
            }

            if (attachmentId) {
                const result = await pool.request()
                    .input('id', sql.Int, attachmentId)
                    .query(`
                        SELECT
                          Id AS id,
                          RequestId AS requestId,
                          FileName AS fileName,
                          ContentType AS contentType,
                          SizeBytes AS sizeBytes,
                          UploadedBy AS uploadedBy,
                          UploadedAt AS uploadedAt,
                          Data AS data
                        FROM RequestAttachments
                        WHERE Id = @id
                    `);

                const row = (result.recordset || [])[0];
                if (!row) {
                    context.res = { status: 404, headers, body: { error: 'Attachment not found.' } };
                    return;
                }

                context.res = { status: 200, headers, body: mapRow(row, true) };
                return;
            }

            context.res = { status: 400, headers, body: { error: 'Missing numeric requestId (for list) or id (for download).' } };
            return;
        }

        if (method === 'POST') {
            const requestId = toIntOrNull(body.requestId);
            const fileName = (body.fileName !== undefined && body.fileName !== null ? String(body.fileName) : '').trim();
            const contentType = (body.contentType !== undefined && body.contentType !== null ? String(body.contentType) : '').trim();
            const uploadedBy = (body.uploadedBy !== undefined && body.uploadedBy !== null
                ? String(body.uploadedBy)
                : (body.createdBy !== undefined && body.createdBy !== null ? String(body.createdBy) : '')
            ).trim();
            const base64 = normalizeBase64(body.dataBase64 || body.base64 || body.data);

            if (!requestId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric requestId.' } };
                return;
            }
            if (!fileName) {
                context.res = { status: 400, headers, body: { error: 'Missing fileName.' } };
                return;
            }
            if (!contentType) {
                context.res = { status: 400, headers, body: { error: 'Missing contentType.' } };
                return;
            }
            if (!base64) {
                context.res = { status: 400, headers, body: { error: 'Missing dataBase64.' } };
                return;
            }

            const buffer = Buffer.from(base64, 'base64');

            // Guardrail for JSON base64 uploads (keep it reasonably small).
            if (buffer.length > 4 * 1024 * 1024) {
                context.res = { status: 413, headers, body: { error: 'File too large. Please upload a file under 4 MB.' } };
                return;
            }
            const sizeBytes = toIntOrNull(body.sizeBytes) || buffer.length;

            const result = await pool.request()
                .input('requestId', sql.Int, requestId)
                .input('fileName', sql.NVarChar, fileName)
                .input('contentType', sql.NVarChar, contentType)
                .input('sizeBytes', sql.Int, sizeBytes)
                .input('data', sql.VarBinary, buffer)
                .input('uploadedBy', sql.NVarChar, uploadedBy || null)
                .query(`
                    INSERT INTO RequestAttachments
                      (RequestId, FileName, ContentType, SizeBytes, Data, UploadedBy, UploadedAt)
                    OUTPUT INSERTED.Id
                    VALUES
                      (@requestId, @fileName, @contentType, @sizeBytes, @data, @uploadedBy, SYSDATETIME())
                `);

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        if (method === 'DELETE') {
            const attachmentId = toIntOrNull((req.query && (req.query.id || req.query.attachmentId)) || (req.params && req.params.id));
            if (!attachmentId) {
                context.res = { status: 400, headers, body: { error: 'Missing numeric attachment id.' } };
                return;
            }

            const result = await pool.request()
                .input('id', sql.Int, attachmentId)
                .query('DELETE FROM RequestAttachments WHERE Id = @id');

            const affected = (result.rowsAffected && result.rowsAffected[0]) ? result.rowsAffected[0] : 0;
            if (!affected) {
                context.res = { status: 404, headers, body: { error: 'Attachment not found.' } };
                return;
            }

            context.res = { status: 204, headers };
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
