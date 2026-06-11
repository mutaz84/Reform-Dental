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

function toIntOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

function toDecimalOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

function toBitOrNull(v) {
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 0 || v === '0') return false;
    return null;
}

function s(v) {
    if (v === null || v === undefined) return null;
    const str = String(v).trim();
    return str === '' ? null : str;
}

function getBodyValue(body, ...keys) {
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined) return body[k];
    }
    return undefined;
}

function addCol(request, columns, defs, columnName, paramName, type, value) {
    if (!hasColumn(columns, columnName)) return;
    request.input(paramName, type, value);
    defs.push({ columnName, paramName });
}

function buildEquipmentColumnDefinitions(request, columns, body) {
    const defs = [];
    addCol(request, columns, defs, 'Name', 'name', sql.NVarChar, s(getBodyValue(body, 'name', 'Name')));
    addCol(request, columns, defs, 'Category', 'category', sql.NVarChar, s(getBodyValue(body, 'category', 'Category')));
    addCol(request, columns, defs, 'Brand', 'brand', sql.NVarChar, s(getBodyValue(body, 'brand', 'Brand')));
    addCol(request, columns, defs, 'Model', 'model', sql.NVarChar, s(getBodyValue(body, 'model', 'Model')));
    addCol(request, columns, defs, 'SerialNumber', 'serialNumber', sql.NVarChar, s(getBodyValue(body, 'serialNumber', 'SerialNumber')));
    addCol(request, columns, defs, 'Description', 'description', sql.NVarChar(sql.MAX), s(getBodyValue(body, 'description', 'Description')));
    addCol(request, columns, defs, 'Condition', 'condition', sql.NVarChar, s(getBodyValue(body, 'condition', 'Condition')));
    addCol(request, columns, defs, 'Status', 'status', sql.NVarChar, s(getBodyValue(body, 'status', 'Status')) || 'Operational');
    addCol(request, columns, defs, 'ClinicId', 'clinicId', sql.Int, toIntOrNull(getBodyValue(body, 'clinicId', 'ClinicId')));
    addCol(request, columns, defs, 'RoomId', 'roomId', sql.Int, toIntOrNull(getBodyValue(body, 'roomId', 'RoomId')));
    addCol(request, columns, defs, 'VendorId', 'vendorId', sql.Int, toIntOrNull(getBodyValue(body, 'vendorId', 'VendorId')));
    addCol(request, columns, defs, 'PurchaseDate', 'purchaseDate', sql.Date, s(getBodyValue(body, 'purchaseDate', 'PurchaseDate')));
    addCol(request, columns, defs, 'PurchasePrice', 'purchasePrice', sql.Decimal(12, 2), toDecimalOrNull(getBodyValue(body, 'purchasePrice', 'PurchasePrice')));
    addCol(request, columns, defs, 'WarrantyExpiry', 'warrantyExpiry', sql.Date, s(getBodyValue(body, 'warrantyExpiry', 'WarrantyExpiry')));
    addCol(request, columns, defs, 'MaintenanceSchedule', 'maintenanceSchedule', sql.NVarChar, s(getBodyValue(body, 'maintenanceSchedule', 'MaintenanceSchedule')));
    addCol(request, columns, defs, 'ServiceIntervalDays', 'serviceIntervalDays', sql.Int, toIntOrNull(getBodyValue(body, 'serviceIntervalDays', 'ServiceIntervalDays')));
    addCol(request, columns, defs, 'Notes', 'notes', sql.NVarChar(sql.MAX), s(getBodyValue(body, 'notes', 'Notes')));
    addCol(request, columns, defs, 'Warnings', 'warnings', sql.NVarChar(sql.MAX), s(getBodyValue(body, 'warnings', 'Warnings')));
    addCol(request, columns, defs, 'IsActive', 'isActive', sql.Bit, toBitOrNull(getBodyValue(body, 'isActive', 'IsActive')));
    return defs;
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (req.method === 'OPTIONS') { context.res = { status: 204, headers }; return; }
    if (req.method !== 'POST')    { context.res = { status: 405, headers, body: { error: 'Method not allowed' } }; return; }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
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
        const columns = await getTableColumns(pool, 'Equipment');
        if (columns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Equipment table not found.' } };
            return;
        }

        const results = { created: 0, errors: [], ids: [] };
        for (let i = 0; i < items.length; i++) {
            const row = items[i] || {};
            if (!s(getBodyValue(row, 'name', 'Name'))) {
                results.errors.push({ index: i, message: 'Name is required' });
                continue;
            }
            try {
                const request = pool.request();
                const defs = buildEquipmentColumnDefinitions(request, columns, row);
                const colList = defs.map(d => d.columnName).join(', ');
                const valList = defs.map(d => `@${d.paramName}`).join(', ');
                const result = await request.query(`INSERT INTO Equipment (${colList}) OUTPUT INSERTED.Id VALUES (${valList})`);
                results.created++;
                results.ids.push(result.recordset[0].Id);
            } catch (err) {
                results.errors.push({ index: i, message: String(err.message || err) });
            }
        }
        context.res = { status: 200, headers, body: results };
    } catch (err) {
        context.log.error('equipment-bulk error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
