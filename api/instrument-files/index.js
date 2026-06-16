const { sql, getPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

function toSafeString(value, maxLen = 500) {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str.slice(0, maxLen) : null;
}

async function ensureTable(pool) {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='InstrumentFiles' AND xtype='U')
        BEGIN
            CREATE TABLE InstrumentFiles (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                DocumentId NVARCHAR(255) NOT NULL,
                InstrumentId INT NULL,
                AdjustmentTimestamp NVARCHAR(50) NULL,
                PurchaseOrderId NVARCHAR(100) NULL,
                Name NVARCHAR(500) NOT NULL DEFAULT 'instrument-document',
                MimeType NVARCHAR(255) NULL,
                Size INT NULL,
                Data NVARCHAR(MAX) NOT NULL,
                UploadedAt DATETIME2 NULL,
                CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
                CONSTRAINT UQ_InstrumentFiles_DocumentId UNIQUE (DocumentId)
            )
        END
    `);
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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
            const tenantUserId = getRequestUserId(req);
            if (!tenantUserId) {
                context.res = { status: 200, headers, body: documentId ? null : [] };
                return;
            }
            if (!documentId) {
                const instrumentId = req.query && req.query.instrumentId ? parseInt(req.query.instrumentId, 10) : null;
                const r = pool.request().input(TENANT_PARAM, sql.Int, tenantUserId);
                let q = `SELECT f.DocumentId, f.InstrumentId, f.AdjustmentTimestamp, f.PurchaseOrderId, f.Name, f.MimeType, f.Size, f.UploadedAt, f.CreatedDate
                         FROM InstrumentFiles f
                         INNER JOIN Instruments i ON i.Id = f.InstrumentId
                         WHERE ${tenantClinicScopeSql('i.ClinicId')}`;
                if (instrumentId) { q += ' AND f.InstrumentId = @instrumentId'; r.input('instrumentId', sql.Int, instrumentId); }
                q += ' ORDER BY f.CreatedDate DESC';
                const result = await r.query(q);
                context.res = { status: 200, headers, body: result.recordset };
                return;
            }
            const result = await pool.request()
                .input('documentId', sql.NVarChar(255), documentId)
                .input(TENANT_PARAM, sql.Int, tenantUserId)
                .query(`SELECT f.DocumentId, f.InstrumentId, f.AdjustmentTimestamp, f.PurchaseOrderId, f.Name, f.MimeType, f.Size, f.Data, f.UploadedAt, f.CreatedDate
                        FROM InstrumentFiles f
                        INNER JOIN Instruments i ON i.Id = f.InstrumentId
                        WHERE f.DocumentId = @documentId AND ${tenantClinicScopeSql('i.ClinicId')}`);
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
            const instrumentId = body.instrumentId != null ? (parseInt(String(body.instrumentId), 10) || null) : null;
            const adjustmentTimestamp = toSafeString(body.adjustmentTimestamp, 50);
            const purchaseOrderId = toSafeString(body.purchaseOrderId, 100);
            const name = toSafeString(body.name || body.Name, 500) || 'instrument-document';
            const mimeType = toSafeString(body.mimeType || body.MimeType, 255);
            const size = body.size != null ? (parseInt(String(body.size), 10) || null) : null;
            const data = String(body.data || body.Data || '').trim();
            const uploadedAt = body.uploadedAt || body.UploadedAt || null;

            if (!docId) {
                context.res = { status: 400, headers, body: { error: 'documentId is required.' } };
                return;
            }
            if (!data) {
                context.res = { status: 400, headers, body: { error: 'data is required.' } };
                return;
            }

            let parsedUploadedAt = null;
            if (uploadedAt) { try { parsedUploadedAt = new Date(uploadedAt); } catch (_) {} }
            if (!parsedUploadedAt || isNaN(parsedUploadedAt.getTime())) parsedUploadedAt = new Date();

            await pool.request()
                .input('documentId', sql.NVarChar(255), docId)
                .input('instrumentId', sql.Int, instrumentId)
                .input('adjustmentTimestamp', sql.NVarChar(50), adjustmentTimestamp)
                .input('purchaseOrderId', sql.NVarChar(100), purchaseOrderId)
                .input('name', sql.NVarChar(500), name)
                .input('mimeType', sql.NVarChar(255), mimeType)
                .input('size', sql.Int, size)
                .input('data', sql.NVarChar(sql.MAX), data)
                .input('uploadedAt', sql.DateTime2, parsedUploadedAt)
                .query(`
                    MERGE InstrumentFiles WITH (HOLDLOCK) AS target
                    USING (SELECT @documentId AS DocumentId) AS source ON target.DocumentId = source.DocumentId
                    WHEN MATCHED THEN
                        UPDATE SET InstrumentId = @instrumentId, AdjustmentTimestamp = @adjustmentTimestamp, PurchaseOrderId = @purchaseOrderId,
                                   Name = @name, MimeType = @mimeType, Size = @size, Data = @data, UploadedAt = @uploadedAt
                    WHEN NOT MATCHED THEN
                        INSERT (DocumentId, InstrumentId, AdjustmentTimestamp, PurchaseOrderId, Name, MimeType, Size, Data, UploadedAt, CreatedDate)
                        VALUES (@documentId, @instrumentId, @adjustmentTimestamp, @purchaseOrderId, @name, @mimeType, @size, @data, @uploadedAt, GETUTCDATE());
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
                .query('DELETE FROM InstrumentFiles WHERE DocumentId = @documentId');
            context.res = { status: 200, headers, body: { success: true } };
            return;
        }

        if (req.method === 'PATCH') {
            if (!documentId) {
                context.res = { status: 400, headers, body: { error: 'documentId is required.' } };
                return;
            }
            const body = req.body || {};
            const name = toSafeString(body.name || body.Name, 500);
            if (!name) {
                context.res = { status: 400, headers, body: { error: 'name is required.' } };
                return;
            }
            const result = await pool.request()
                .input('documentId', sql.NVarChar(255), documentId)
                .input('name', sql.NVarChar(500), name)
                .query('UPDATE InstrumentFiles SET Name = @name WHERE DocumentId = @documentId; SELECT @@ROWCOUNT AS affected');
            const affected = result.recordset && result.recordset[0] && result.recordset[0].affected;
            if (!affected) {
                context.res = { status: 404, headers, body: { error: 'File not found.' } };
                return;
            }
            context.res = { status: 200, headers, body: { success: true, documentId, name } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (error) {
        if (context.log) context.log.error('Instrument Files API error:', error);
        context.res = { status: 500, headers, body: { error: error.message || 'Server error' } };
    }
};
