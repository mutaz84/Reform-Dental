const { sql, getPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

function toSafeString(value, maxLen = 500) {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str.slice(0, maxLen) : null;
}

async function ensureTable(pool) {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='InstrumentAdjustments' AND xtype='U')
        BEGIN
            CREATE TABLE InstrumentAdjustments (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Timestamp NVARCHAR(50) NOT NULL,
                InstrumentId INT NULL,
                ApiInstrumentId INT NULL,
                InstrumentName NVARCHAR(255) NULL,
                UserName NVARCHAR(255) NULL,
                PreviousQty INT NULL,
                NewQty INT NULL,
                ChangeQty INT NULL,
                PurchaseOrderId NVARCHAR(100) NULL,
                Reason NVARCHAR(255) NULL,
                ReasonNotes NVARCHAR(MAX) NULL,
                DocumentId NVARCHAR(255) NULL,
                CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
                CONSTRAINT UQ_InstrumentAdjustments_Timestamp UNIQUE (Timestamp)
            )
        END
    `);
    // Add DocumentIds column (JSON array of attached file keys) if missing.
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'DocumentIds' AND Object_ID = Object_ID(N'InstrumentAdjustments'))
            BEGIN ALTER TABLE InstrumentAdjustments ADD DocumentIds NVARCHAR(MAX) NULL; END
        `);
    } catch (_) {}
    // Add VendorName/PoNumber/UnitCost for inline edits of PO-style adjustments.
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'VendorName' AND Object_ID = Object_ID(N'InstrumentAdjustments'))
            BEGIN ALTER TABLE InstrumentAdjustments ADD VendorName NVARCHAR(255) NULL; END
        `);
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PoNumber' AND Object_ID = Object_ID(N'InstrumentAdjustments'))
            BEGIN ALTER TABLE InstrumentAdjustments ADD PoNumber NVARCHAR(100) NULL; END
        `);
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'UnitCost' AND Object_ID = Object_ID(N'InstrumentAdjustments'))
            BEGIN ALTER TABLE InstrumentAdjustments ADD UnitCost DECIMAL(18,2) NULL; END
        `);
    } catch (_) {}
}

function mapRow(r) {
    let documentIds = [];
    if (r.DocumentIds) {
        try { const parsed = JSON.parse(r.DocumentIds); if (Array.isArray(parsed)) documentIds = parsed.map(String); }
        catch (_) {}
    }
    if (!documentIds.length && r.DocumentId) documentIds = [String(r.DocumentId)];
    return {
        timestamp: Number(r.Timestamp) || r.Timestamp,
        instrumentID: r.InstrumentId,
        apiId: r.ApiInstrumentId,
        instrumentName: r.InstrumentName,
        user: r.UserName,
        previousQty: r.PreviousQty,
        newQty: r.NewQty,
        change: r.ChangeQty,
        purchaseOrderId: r.PurchaseOrderId,
        vendorName: r.VendorName || null,
        poNumber: r.PoNumber || null,
        unitCost: r.UnitCost != null ? Number(r.UnitCost) : null,
        reason: r.Reason,
        reasonNotes: r.ReasonNotes,
        documentId: r.DocumentId,
        documentIds,
        createdAt: r.CreatedAt
    };
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
        const tsParam = toSafeString(req.params && req.params.timestamp, 50);

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            if (!tenantUserId) {
                context.res = { status: 200, headers, body: [] };
                return;
            }
            const r = pool.request().input(TENANT_PARAM, sql.Int, tenantUserId);
            let q = `SELECT a.* FROM InstrumentAdjustments a
                     INNER JOIN Instruments i ON i.Id = a.InstrumentId`;
            const where = [tenantClinicScopeSql('i.ClinicId')];
            if (tsParam) { where.push('a.Timestamp = @ts'); r.input('ts', sql.NVarChar(50), tsParam); }
            const instrumentId = req.query && req.query.instrumentId ? parseInt(req.query.instrumentId, 10) : null;
            if (instrumentId) { where.push('a.InstrumentId = @instrumentId'); r.input('instrumentId', sql.Int, instrumentId); }
            q += ' WHERE ' + where.join(' AND ');
            q += ' ORDER BY CAST(a.Timestamp AS BIGINT) DESC';
            const result = await r.query(q);
            context.res = { status: 200, headers, body: result.recordset.map(mapRow) };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const ts = toSafeString(body.timestamp != null ? String(body.timestamp) : null, 50);
            if (!ts) { context.res = { status: 400, headers, body: { error: 'timestamp is required.' } }; return; }
            const instrumentId = body.instrumentID != null ? (parseInt(String(body.instrumentID), 10) || null) : null;
            const apiId = body.apiId != null ? (parseInt(String(body.apiId), 10) || null) : null;
            const previousQty = body.previousQty != null ? (parseInt(String(body.previousQty), 10) || 0) : null;
            const newQty = body.newQty != null ? (parseInt(String(body.newQty), 10) || 0) : null;
            const changeQty = body.change != null ? (parseInt(String(body.change), 10) || 0) : null;
            let documentIdsJson = null;
            if (Array.isArray(body.documentIds)) {
                const arr = body.documentIds.filter(v => v != null && String(v).trim()).map(v => String(v).slice(0, 255));
                documentIdsJson = arr.length ? JSON.stringify(arr) : null;
            }
            const firstDocId = documentIdsJson
                ? (JSON.parse(documentIdsJson)[0] || null)
                : toSafeString(body.documentId || (body.document && body.document.key), 255);
            const unitCostRaw = body.unitCost != null ? Number(body.unitCost) : (body.purchaseOrder && body.purchaseOrder.unitCost != null ? Number(body.purchaseOrder.unitCost) : null);
            const unitCost = (unitCostRaw != null && Number.isFinite(unitCostRaw)) ? unitCostRaw : null;

            await pool.request()
                .input('ts', sql.NVarChar(50), ts)
                .input('instrumentId', sql.Int, instrumentId)
                .input('apiId', sql.Int, apiId)
                .input('instrumentName', sql.NVarChar(255), toSafeString(body.instrumentName, 255))
                .input('userName', sql.NVarChar(255), toSafeString(body.user, 255))
                .input('previousQty', sql.Int, previousQty)
                .input('newQty', sql.Int, newQty)
                .input('changeQty', sql.Int, changeQty)
                .input('purchaseOrderId', sql.NVarChar(100), toSafeString(body.purchaseOrderId || (body.purchaseOrder && body.purchaseOrder.id), 100))
                .input('reason', sql.NVarChar(255), toSafeString(body.reason, 255))
                .input('reasonNotes', sql.NVarChar(sql.MAX), body.reasonNotes || null)
                .input('documentId', sql.NVarChar(255), firstDocId)
                .input('documentIds', sql.NVarChar(sql.MAX), documentIdsJson)
                .input('vendorName', sql.NVarChar(255), toSafeString(body.vendorName || (body.purchaseOrder && body.purchaseOrder.vendorName), 255))
                .input('poNumber', sql.NVarChar(100), toSafeString(body.poNumber || (body.purchaseOrder && body.purchaseOrder.poNumber), 100))
                .input('unitCost', sql.Decimal(18, 2), unitCost)
                .query(`
                    MERGE InstrumentAdjustments WITH (HOLDLOCK) AS target
                    USING (SELECT @ts AS Timestamp) AS source ON target.Timestamp = source.Timestamp
                    WHEN MATCHED THEN UPDATE SET
                        InstrumentId=@instrumentId, ApiInstrumentId=@apiId, InstrumentName=@instrumentName,
                        UserName=@userName, PreviousQty=@previousQty, NewQty=@newQty, ChangeQty=@changeQty,
                        PurchaseOrderId=@purchaseOrderId, Reason=@reason, ReasonNotes=@reasonNotes,
                        DocumentId=@documentId, DocumentIds=@documentIds,
                        VendorName=@vendorName, PoNumber=@poNumber, UnitCost=@unitCost
                    WHEN NOT MATCHED THEN INSERT
                        (Timestamp, InstrumentId, ApiInstrumentId, InstrumentName, UserName, PreviousQty, NewQty, ChangeQty, PurchaseOrderId, Reason, ReasonNotes, DocumentId, DocumentIds, VendorName, PoNumber, UnitCost)
                        VALUES (@ts, @instrumentId, @apiId, @instrumentName, @userName, @previousQty, @newQty, @changeQty, @purchaseOrderId, @reason, @reasonNotes, @documentId, @documentIds, @vendorName, @poNumber, @unitCost);
                `);

            context.res = { status: 200, headers, body: { success: true, timestamp: ts } };
            return;
        }

        if (req.method === 'DELETE' && tsParam) {
            await pool.request()
                .input('ts', sql.NVarChar(50), tsParam)
                .query('DELETE FROM InstrumentAdjustments WHERE Timestamp = @ts');
            context.res = { status: 200, headers, body: { success: true } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (error) {
        if (context.log) context.log.error('Instrument Adjustments API error:', error);
        context.res = { status: 500, headers, body: { error: error.message || 'Server error' } };
    }
};
