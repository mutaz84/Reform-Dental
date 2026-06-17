const { sql, getPool, resetPool } = require('../shared/database');

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

async function ensureSupplyTypeColumn(pool, columns) {
    if (hasColumn(columns, 'SupplyType')) return columns;
    try {
        await pool.request().query("ALTER TABLE Supplies ADD SupplyType NVARCHAR(20) NULL");
        columns.add('supplytype');
    } catch (_) { /* ignore */ }
    return columns;
}

function normalizeSupplyType(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'office') return 'Office';
    if (v === 'dental') return 'Dental';
    return null;
}

function toIntOrZero(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
}

function toDecimalOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

function s(v) {
    if (v === null || v === undefined) return null;
    const str = String(v).trim();
    return str === '' ? null : str;
}

async function insertSupplyRow(pool, columns, body, defaultSupplyType) {
    const hasIsActive = hasColumn(columns, 'IsActive');
    const hasSupplyType = hasColumn(columns, 'SupplyType');
    const supplyType = normalizeSupplyType(body.supplyType) || defaultSupplyType || 'Dental';
    const cols = ['Name', 'Category', 'SKU', 'Description', 'Unit', 'QuantityInStock', 'MinimumStock', 'ReorderPoint', 'UnitCost', 'ClinicId', 'Notes', 'Warnings', 'ImageUrl', 'DocumentUrl'];
    const params = ['@name', '@category', '@sku', '@description', '@unit', '@quantityInStock', '@minimumStock', '@reorderPoint', '@unitCost', '@clinicId', '@notes', '@warnings', '@imageUrl', '@documentUrl'];
    if (hasSupplyType) { cols.push('SupplyType'); params.push('@supplyType'); }
    if (hasIsActive)   { cols.push('IsActive');   params.push('@isActive');   }

    const r = pool.request()
        .input('name', sql.NVarChar, s(body.name))
        .input('category', sql.NVarChar, s(body.category))
        .input('sku', sql.NVarChar, s(body.sku))
        .input('description', sql.NVarChar, s(body.description))
        .input('unit', sql.NVarChar, s(body.unit))
        .input('quantityInStock', sql.Int, toIntOrZero(body.quantityInStock))
        .input('minimumStock', sql.Int, toIntOrZero(body.minimumStock))
        .input('reorderPoint', sql.Int, toIntOrZero(body.reorderPoint))
        .input('unitCost', sql.Decimal(12, 2), toDecimalOrNull(body.unitCost))
        .input('clinicId', sql.Int, body.clinicId ? parseInt(body.clinicId, 10) : null)
        .input('notes', sql.NVarChar, s(body.notes))
        .input('warnings', sql.NVarChar, s(body.warnings))
        .input('imageUrl', sql.NVarChar, s(body.imageUrl))
        .input('documentUrl', sql.NVarChar, s(body.documentUrl));
    if (hasSupplyType) r.input('supplyType', sql.NVarChar(20), supplyType);
    if (hasIsActive)   r.input('isActive',   sql.Bit, body.isActive === false ? 0 : 1);

    const result = await r.query(`INSERT INTO Supplies (${cols.join(', ')}) OUTPUT INSERTED.Id VALUES (${params.join(', ')})`);
    return result.recordset[0].Id;
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };
    if (req.method === 'OPTIONS') { context.res = { status: 204, headers }; return; }
    if (req.method !== 'POST')    { context.res = { status: 405, headers, body: { error: 'Method not allowed' } }; return; }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const defaultType = normalizeSupplyType(body.supplyType);
    if (items.length === 0) {
        context.res = { status: 400, headers, body: { error: 'items array is required' } };
        return;
    }
    if (items.length > 2000) {
        context.res = { status: 400, headers, body: { error: 'Maximum 2000 rows per request' } };
        return;
    }

    try {
        const pool = await getPool();
        let columns = await getTableColumns(pool, 'Supplies');
        if (columns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Supplies table not found.' } };
            return;
        }
        columns = await ensureSupplyTypeColumn(pool, columns);

        const results = { created: 0, errors: [], ids: [] };
        for (let i = 0; i < items.length; i++) {
            const row = items[i] || {};
            if (!s(row.name)) {
                results.errors.push({ index: i, message: 'Name is required' });
                continue;
            }
            try {
                const id = await insertSupplyRow(pool, columns, row, defaultType);
                results.created++;
                results.ids.push(id);
            } catch (err) {
                results.errors.push({ index: i, message: String(err.message || err) });
            }
        }
        context.res = { status: 200, headers, body: results };
    } catch (err) {
        context.log.error('supplies-bulk error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
