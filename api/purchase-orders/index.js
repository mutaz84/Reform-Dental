const { sql, getPool } = require('../shared/database');

function toSafeString(value, maxLen = 500) {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str.slice(0, maxLen) : null;
}

async function ensureTable(pool) {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PurchaseOrders' AND xtype='U')
        BEGIN
            CREATE TABLE PurchaseOrders (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                ClientId NVARCHAR(100) NOT NULL,
                InstrumentId INT NULL,
                Quantity INT NULL,
                VendorId NVARCHAR(50) NULL,
                VendorName NVARCHAR(255) NULL,
                PoNumber NVARCHAR(100) NULL,
                UnitCost DECIMAL(18,4) NULL,
                TotalCost DECIMAL(18,4) NULL,
                OrderDate DATE NULL,
                Notes NVARCHAR(MAX) NULL,
                DocumentId NVARCHAR(255) NULL,
                CreatedBy NVARCHAR(255) NULL,
                CreatedAt DATETIME2 NULL,
                ModifiedDate DATETIME2 DEFAULT GETUTCDATE(),
                CONSTRAINT UQ_PurchaseOrders_ClientId UNIQUE (ClientId)
            )
        END
    `);
}

function mapRow(r) {
    return {
        id: r.ClientId,
        dbId: r.Id,
        instrumentID: r.InstrumentId,
        quantity: r.Quantity,
        vendorId: r.VendorId,
        vendorName: r.VendorName,
        poNumber: r.PoNumber,
        unitCost: r.UnitCost != null ? Number(r.UnitCost) : null,
        totalCost: r.TotalCost != null ? Number(r.TotalCost) : null,
        orderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : null,
        notes: r.Notes,
        documentId: r.DocumentId,
        createdBy: r.CreatedBy,
        createdAt: r.CreatedAt
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
        const pool = await getPool();
        await ensureTable(pool);
        const clientId = toSafeString(req.params && req.params.id, 100);

        if (req.method === 'GET') {
            if (clientId) {
                const result = await pool.request()
                    .input('clientId', sql.NVarChar(100), clientId)
                    .query('SELECT * FROM PurchaseOrders WHERE ClientId = @clientId');
                context.res = { status: 200, headers, body: result.recordset[0] ? mapRow(result.recordset[0]) : null };
                return;
            }
            const r = pool.request();
            let q = 'SELECT * FROM PurchaseOrders';
            const instrumentId = req.query && req.query.instrumentId ? parseInt(req.query.instrumentId, 10) : null;
            if (instrumentId) { q += ' WHERE InstrumentId = @instrumentId'; r.input('instrumentId', sql.Int, instrumentId); }
            q += ' ORDER BY CreatedAt DESC, Id DESC';
            const result = await r.query(q);
            context.res = { status: 200, headers, body: result.recordset.map(mapRow) };
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            const body = req.body || {};
            const cid = toSafeString(body.id || body.clientId, 100);
            if (!cid) { context.res = { status: 400, headers, body: { error: 'id (client id) is required.' } }; return; }
            const instrumentId = body.instrumentID != null ? (parseInt(String(body.instrumentID), 10) || null) : null;
            const quantity = body.quantity != null ? (parseInt(String(body.quantity), 10) || null) : null;
            const unitCost = body.unitCost != null && body.unitCost !== '' ? Number(body.unitCost) : null;
            const totalCost = body.totalCost != null && body.totalCost !== '' ? Number(body.totalCost) : null;
            let orderDate = null;
            if (body.orderDate) { try { orderDate = new Date(body.orderDate); if (isNaN(orderDate.getTime())) orderDate = null; } catch (_) {} }
            let createdAt = null;
            if (body.createdAt) { try { createdAt = new Date(body.createdAt); if (isNaN(createdAt.getTime())) createdAt = null; } catch (_) {} }
            if (!createdAt) createdAt = new Date();

            await pool.request()
                .input('clientId', sql.NVarChar(100), cid)
                .input('instrumentId', sql.Int, instrumentId)
                .input('quantity', sql.Int, quantity)
                .input('vendorId', sql.NVarChar(50), toSafeString(body.vendorId, 50))
                .input('vendorName', sql.NVarChar(255), toSafeString(body.vendorName, 255))
                .input('poNumber', sql.NVarChar(100), toSafeString(body.poNumber, 100))
                .input('unitCost', sql.Decimal(18, 4), Number.isFinite(unitCost) ? unitCost : null)
                .input('totalCost', sql.Decimal(18, 4), Number.isFinite(totalCost) ? totalCost : null)
                .input('orderDate', sql.Date, orderDate)
                .input('notes', sql.NVarChar(sql.MAX), body.notes || null)
                .input('documentId', sql.NVarChar(255), toSafeString(body.documentId || (body.document && body.document.key), 255))
                .input('createdBy', sql.NVarChar(255), toSafeString(body.createdBy, 255))
                .input('createdAt', sql.DateTime2, createdAt)
                .query(`
                    MERGE PurchaseOrders WITH (HOLDLOCK) AS target
                    USING (SELECT @clientId AS ClientId) AS source ON target.ClientId = source.ClientId
                    WHEN MATCHED THEN UPDATE SET
                        InstrumentId=@instrumentId, Quantity=@quantity, VendorId=@vendorId, VendorName=@vendorName,
                        PoNumber=@poNumber, UnitCost=@unitCost, TotalCost=@totalCost, OrderDate=@orderDate,
                        Notes=@notes, DocumentId=@documentId, CreatedBy=@createdBy, ModifiedDate=GETUTCDATE()
                    WHEN NOT MATCHED THEN INSERT
                        (ClientId, InstrumentId, Quantity, VendorId, VendorName, PoNumber, UnitCost, TotalCost, OrderDate, Notes, DocumentId, CreatedBy, CreatedAt)
                        VALUES (@clientId, @instrumentId, @quantity, @vendorId, @vendorName, @poNumber, @unitCost, @totalCost, @orderDate, @notes, @documentId, @createdBy, @createdAt);
                `);

            context.res = { status: 200, headers, body: { success: true, id: cid } };
            return;
        }

        if (req.method === 'DELETE' && clientId) {
            await pool.request()
                .input('clientId', sql.NVarChar(100), clientId)
                .query('DELETE FROM PurchaseOrders WHERE ClientId = @clientId');
            context.res = { status: 200, headers, body: { success: true } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (error) {
        if (context.log) context.log.error('Purchase Orders API error:', error);
        context.res = { status: 500, headers, body: { error: error.message || 'Server error' } };
    }
};
