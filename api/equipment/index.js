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

function toIntOrNull(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDecimalOrNull(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toBitOrNull(value) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
}

function addColumnValue(request, columns, definitions, columnName, paramName, type, value) {
    if (!hasColumn(columns, columnName)) return;
    request.input(paramName, type, value);
    definitions.push({ columnName, paramName });
}

function buildEquipmentColumnDefinitions(request, columns, body) {
    const definitions = [];
    addColumnValue(request, columns, definitions, 'Name', 'name', sql.NVarChar, body.name || null);
    addColumnValue(request, columns, definitions, 'Category', 'category', sql.NVarChar, body.category || null);
    addColumnValue(request, columns, definitions, 'Brand', 'brand', sql.NVarChar, body.brand || null);
    addColumnValue(request, columns, definitions, 'Model', 'model', sql.NVarChar, body.model || null);
    addColumnValue(request, columns, definitions, 'SerialNumber', 'serialNumber', sql.NVarChar, body.serialNumber || null);
    addColumnValue(request, columns, definitions, 'Description', 'description', sql.NVarChar, body.description || null);
    addColumnValue(request, columns, definitions, 'Condition', 'condition', sql.NVarChar, body.condition || null);
    addColumnValue(request, columns, definitions, 'Status', 'status', sql.NVarChar, body.status || 'operational');
    addColumnValue(request, columns, definitions, 'ClinicId', 'clinicId', sql.Int, toIntOrNull(body.clinicId));
    addColumnValue(request, columns, definitions, 'RoomId', 'roomId', sql.Int, toIntOrNull(body.roomId));
    addColumnValue(request, columns, definitions, 'VendorId', 'vendorId', sql.Int, toIntOrNull(body.vendorId));
    addColumnValue(request, columns, definitions, 'PurchaseDate', 'purchaseDate', sql.Date, body.purchaseDate || null);
    addColumnValue(request, columns, definitions, 'PurchasePrice', 'purchasePrice', sql.Decimal(12, 2), toDecimalOrNull(body.purchasePrice));
    addColumnValue(request, columns, definitions, 'WarrantyExpiry', 'warrantyExpiry', sql.Date, body.warrantyExpiry || null);
    addColumnValue(request, columns, definitions, 'MaintenanceSchedule', 'maintenanceSchedule', sql.NVarChar, body.maintenanceSchedule || null);
    addColumnValue(request, columns, definitions, 'LastMaintenanceDate', 'lastMaintenanceDate', sql.Date, body.lastMaintenanceDate || body.lastServiceDate || null);
    addColumnValue(request, columns, definitions, 'NextMaintenanceDate', 'nextMaintenanceDate', sql.Date, body.nextMaintenanceDate || body.nextServiceDate || null);
    addColumnValue(request, columns, definitions, 'ServiceIntervalDays', 'serviceIntervalDays', sql.Int, toIntOrNull(body.serviceIntervalDays));
    addColumnValue(request, columns, definitions, 'LastServiceDate', 'lastServiceDate', sql.Date, body.lastServiceDate || body.lastMaintenanceDate || null);
    addColumnValue(request, columns, definitions, 'NextServiceDate', 'nextServiceDate', sql.Date, body.nextServiceDate || body.nextMaintenanceDate || null);
    addColumnValue(request, columns, definitions, 'ServiceVendor', 'serviceVendor', sql.NVarChar, body.serviceVendor || null);
    addColumnValue(request, columns, definitions, 'Notes', 'notes', sql.NVarChar, body.notes || null);
    addColumnValue(request, columns, definitions, 'Warnings', 'warnings', sql.NVarChar, body.warnings || null);
    addColumnValue(request, columns, definitions, 'ImageUrl', 'imageUrl', sql.NVarChar(sql.MAX), body.imageUrl || null);
    addColumnValue(request, columns, definitions, 'DocumentUrl', 'documentUrl', sql.NVarChar(sql.MAX), body.documentUrl || null);
    addColumnValue(request, columns, definitions, 'IsActive', 'isActive', sql.Bit, toBitOrNull(body.isActive));
    return definitions;
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
        const equipmentColumns = await getTableColumns(pool, 'Equipment');
        if (equipmentColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Equipment table not found.' } };
            return;
        }

        const hasIsActive = hasColumn(equipmentColumns, 'IsActive');
        const orderBy = hasColumn(equipmentColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';
        const id = req.params.id;

        if (req.method === 'GET') {
            if (id) {
                const where = ['Id = @id'];
                if (hasIsActive) {
                    where.push('IsActive = 1');
                }
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT * FROM Equipment WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const whereClause = hasIsActive ? 'WHERE IsActive = 1' : '';
                const result = await pool.request()
                    .query(`SELECT * FROM Equipment ${whereClause} ${orderBy}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body || {};
            const request = pool.request();
            const definitions = buildEquipmentColumnDefinitions(request, equipmentColumns, body);
            const columnList = definitions.map((definition) => definition.columnName).join(', ');
            const valueList = definitions.map((definition) => `@${definition.paramName}`).join(', ');
            const result = await request.query(`INSERT INTO Equipment (${columnList}) OUTPUT INSERTED.Id VALUES (${valueList})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const request = pool.request().input('id', sql.Int, id);
            const definitions = buildEquipmentColumnDefinitions(request, equipmentColumns, body);
            const setClause = definitions
                .map((definition) => `${definition.columnName}=@${definition.paramName}`)
                .concat(hasColumn(equipmentColumns, 'ModifiedDate') ? ['ModifiedDate=GETUTCDATE()'] : [])
                .join(', ');
            await request.query(`UPDATE Equipment SET ${setClause} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Equipment updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Equipment WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Equipment deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
