const { sql, getPool } = require('../shared/database');

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
}

function mapRow(r) {
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
        reason: r.Reason,
        reasonNotes: r.ReasonNotes,
        documentId: r.DocumentId,
        createdAt: r.CreatedAt
    };
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

    try {
        const pool = await getPool();
        await ensureTable(pool);
        const tsParam = toSafeString(req.params && req.params.timestamp, 50);

        if (req.method === 'GET') {
            const r = pool.request();
            let q = 'SELECT * FROM InstrumentAdjustments';
            const where = [];
            if (tsParam) { where.push('Timestamp = @ts'); r.input('ts', sql.NVarChar(50), tsParam); }
            const instrumentId = req.query && req.query.instrumentId ? parseInt(req.query.instrumentId, 10) : null;
            if (instrumentId) { where.push('InstrumentId = @instrumentId'); r.input('instrumentId', sql.Int, instrumentId); }
            if (where.length) q += ' WHERE ' + where.join(' AND ');
            q += ' ORDER BY CAST(Timestamp AS BIGINT) DESC';
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
                .input('documentId', sql.NVarChar(255), toSafeString(body.documentId || (body.document && body.document.key), 255))
                .query(`
                    MERGE InstrumentAdjustments WITH (HOLDLOCK) AS target
                    USING (SELECT @ts AS Timestamp) AS source ON target.Timestamp = source.Timestamp
                    WHEN MATCHED THEN UPDATE SET
                        InstrumentId=@instrumentId, ApiInstrumentId=@apiId, InstrumentName=@instrumentName,
                        UserName=@userName, PreviousQty=@previousQty, NewQty=@newQty, ChangeQty=@changeQty,
                        PurchaseOrderId=@purchaseOrderId, Reason=@reason, ReasonNotes=@reasonNotes, DocumentId=@documentId
                    WHEN NOT MATCHED THEN INSERT
                        (Timestamp, InstrumentId, ApiInstrumentId, InstrumentName, UserName, PreviousQty, NewQty, ChangeQty, PurchaseOrderId, Reason, ReasonNotes, DocumentId)
                        VALUES (@ts, @instrumentId, @apiId, @instrumentName, @userName, @previousQty, @newQty, @changeQty, @purchaseOrderId, @reason, @reasonNotes, @documentId);
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
