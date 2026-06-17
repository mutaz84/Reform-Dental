const { sql, getPool } = require('../shared/database');
const { successResponse, errorResponse, handleOptions } = require('../shared/response');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

function toSafeString(value, maxLen = 500) {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str.slice(0, maxLen) : null;
}

async function ensureTable(pool) {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EquipmentFiles' AND xtype='U')
        BEGIN
            CREATE TABLE EquipmentFiles (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                DocumentId NVARCHAR(255) NOT NULL,
                EquipmentId INT NOT NULL,
                Name NVARCHAR(500) NOT NULL DEFAULT 'equipment-document',
                MimeType NVARCHAR(255),
                Data NVARCHAR(MAX) NOT NULL,
                UploadedAt DATETIME2,
                CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
                CONSTRAINT UQ_EquipmentFiles_DocumentId UNIQUE (DocumentId)
            )
        END
    `);
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        await ensureTable(pool);

        const documentId = toSafeString(req.params && req.params.documentId, 255);

        if (req.method === 'GET') {
            if (!documentId) {
                context.res = { status: 400, headers, body: { error: 'documentId is required.' } };
                return;
            }
            const tenantUserId = getRequestUserId(req);
            if (!tenantUserId) {
                context.res = { status: 404, headers, body: { error: 'File not found.' } };
                return;
            }
            const result = await pool.request()
                .input('documentId', sql.NVarChar(255), documentId)
                .input(TENANT_PARAM, sql.Int, tenantUserId)
                .query(`SELECT ef.DocumentId, ef.EquipmentId, ef.Name, ef.MimeType, ef.Data, ef.UploadedAt, ef.CreatedDate
                        FROM EquipmentFiles ef
                        INNER JOIN Equipment e ON e.Id = ef.EquipmentId
                        WHERE ef.DocumentId = @documentId AND ${tenantClinicScopeSql('e.ClinicId')}`);
            if (!result.recordset.length) {
                context.res = { status: 404, headers, body: { error: 'File not found.' } };
                return;
            }
            context.res = { status: 200, headers, body: result.recordset[0] };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const docId = toSafeString(body.documentId || body.DocumentId, 255);
            const equipmentId = Number.parseInt(String(body.equipmentId || body.EquipmentId || '0'), 10) || 0;
            const name = toSafeString(body.name || body.Name, 500) || 'equipment-document';
            const mimeType = toSafeString(body.mimeType || body.MimeType, 255);
            const data = String(body.data || body.Data || '').trim();
            const uploadedAt = body.uploadedAt || body.UploadedAt || null;

            if (!docId) {
                context.res = { status: 400, headers, body: { error: 'documentId is required.' } };
                return;
            }
            if (!equipmentId) {
                context.res = { status: 400, headers, body: { error: 'equipmentId is required.' } };
                return;
            }
            if (!data) {
                context.res = { status: 400, headers, body: { error: 'data is required.' } };
                return;
            }

            let parsedUploadedAt = null;
            if (uploadedAt) {
                try { parsedUploadedAt = new Date(uploadedAt); } catch (_) {}
            }
            if (!parsedUploadedAt || isNaN(parsedUploadedAt.getTime())) {
                parsedUploadedAt = new Date();
            }

            await pool.request()
                .input('documentId', sql.NVarChar(255), docId)
                .input('equipmentId', sql.Int, equipmentId)
                .input('name', sql.NVarChar(500), name)
                .input('mimeType', sql.NVarChar(255), mimeType)
                .input('data', sql.NVarChar(sql.MAX), data)
                .input('uploadedAt', sql.DateTime2, parsedUploadedAt)
                .query(`
                    MERGE EquipmentFiles WITH (HOLDLOCK) AS target
                    USING (SELECT @documentId AS DocumentId) AS source ON target.DocumentId = source.DocumentId
                    WHEN MATCHED THEN
                        UPDATE SET Name = @name, MimeType = @mimeType, Data = @data, UploadedAt = @uploadedAt, EquipmentId = @equipmentId
                    WHEN NOT MATCHED THEN
                        INSERT (DocumentId, EquipmentId, Name, MimeType, Data, UploadedAt, CreatedDate)
                        VALUES (@documentId, @equipmentId, @name, @mimeType, @data, @uploadedAt, GETUTCDATE());
                `);

            context.res = { status: 200, headers, body: { success: true, documentId: docId } };
            return;
        }

        if (req.method === 'DELETE') {
            if (!documentId) {
                context.res = { status: 400, headers, body: { error: 'documentId is required.' } };
                return;
            }
            await pool.request()
                .input('documentId', sql.NVarChar(255), documentId)
                .query('DELETE FROM EquipmentFiles WHERE DocumentId = @documentId');
            context.res = { status: 200, headers, body: { success: true } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (error) {
        if (context.log) context.log.error('Equipment Files API error:', error);
        context.res = { status: 500, headers, body: { error: error.message || 'Server error' } };
    }
};
