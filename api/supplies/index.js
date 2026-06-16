const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

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
    } catch (e) {
        // ignore - we still operate without the column
    }
    return columns;
}

function normalizeSupplyType(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'office') return 'Office';
    if (v === 'dental') return 'Dental';
    return null;
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
        let supplyColumns = await getTableColumns(pool, 'Supplies');
        if (supplyColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Supplies table not found.' } };
            return;
        }
        supplyColumns = await ensureSupplyTypeColumn(pool, supplyColumns);

        const hasIsActive = hasColumn(supplyColumns, 'IsActive');
        const hasSupplyType = hasColumn(supplyColumns, 'SupplyType');
        const orderBy = hasColumn(supplyColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';
        const id = req.params.id;
        const requestedType = normalizeSupplyType(req.query && req.query.type);

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            const hasClinicCol = hasColumn(supplyColumns, 'ClinicId');
            if (id) {
                const where = ['Id = @id'];
                if (hasIsActive) {
                    where.push('IsActive = 1');
                }
                const reqBuilder = pool.request().input('id', sql.Int, id);
                if (hasClinicCol) {
                    if (!tenantUserId) {
                        context.res = { status: 200, headers, body: null };
                        return;
                    }
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    where.push(tenantClinicScopeSql('ClinicId'));
                }
                const result = await reqBuilder
                    .query(`SELECT * FROM Supplies WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                if (hasClinicCol && !tenantUserId) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                const where = [];
                if (hasIsActive) where.push('IsActive = 1');
                const reqBuilder = pool.request();
                if (hasSupplyType && requestedType) {
                    where.push('(SupplyType = @stype OR SupplyType IS NULL)');
                    reqBuilder.input('stype', sql.NVarChar(20), requestedType);
                }
                if (hasClinicCol) {
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    where.push(tenantClinicScopeSql('ClinicId'));
                }
                const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
                const result = await reqBuilder.query(`SELECT * FROM Supplies ${whereClause} ${orderBy}`);
                let rows = result.recordset || [];
                if (hasSupplyType && requestedType) {
                    rows = rows.filter(r => {
                        const t = String(r.SupplyType || '').toLowerCase();
                        return !t || t === requestedType.toLowerCase();
                    });
                }
                context.res = { status: 200, headers, body: rows };
            }
        } else if (req.method === 'POST') {
            const body = req.body || {};
            const supplyType = normalizeSupplyType(body.supplyType) || 'Dental';
            const cols = ['Name', 'Category', 'SKU', 'Description', 'Unit', 'QuantityInStock', 'MinimumStock', 'ReorderPoint', 'UnitCost', 'ClinicId', 'Notes', 'Warnings', 'ImageUrl', 'DocumentUrl'];
            const params = ['@name', '@category', '@sku', '@description', '@unit', '@quantityInStock', '@minimumStock', '@reorderPoint', '@unitCost', '@clinicId', '@notes', '@warnings', '@imageUrl', '@documentUrl'];
            if (hasSupplyType) { cols.push('SupplyType'); params.push('@supplyType'); }
            if (hasIsActive) { cols.push('IsActive'); params.push('@isActive'); }
            const reqBuilder = pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('category', sql.NVarChar, body.category)
                .input('sku', sql.NVarChar, body.sku)
                .input('description', sql.NVarChar, body.description)
                .input('unit', sql.NVarChar, body.unit)
                .input('quantityInStock', sql.Int, body.quantityInStock || 0)
                .input('minimumStock', sql.Int, body.minimumStock || 0)
                .input('reorderPoint', sql.Int, body.reorderPoint || 0)
                .input('unitCost', sql.Decimal, body.unitCost || null)
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('notes', sql.NVarChar, body.notes || null)
                .input('warnings', sql.NVarChar, body.warnings || null)
                .input('imageUrl', sql.NVarChar, body.imageUrl || null)
                .input('documentUrl', sql.NVarChar, body.documentUrl || null);
            if (hasSupplyType) reqBuilder.input('supplyType', sql.NVarChar(20), supplyType);
            if (hasIsActive) reqBuilder.input('isActive', sql.Bit, body.isActive === false ? 0 : 1); (${cols.join(', ')}) OUTPUT INSERTED.Id VALUES (${params.join(', ')})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const supplyType = normalizeSupplyType(body.supplyType);
            const setParts = [
                'Name=@name', 'Category=@category', 'SKU=@sku', 'Description=@description', 'Unit=@unit',
                'QuantityInStock=@quantityInStock', 'MinimumStock=@minimumStock', 'ReorderPoint=@reorderPoint',
                'UnitCost=@unitCost', 'ClinicId=@clinicId', 'Notes=@notes', 'Warnings=@warnings',
                'ImageUrl=@imageUrl', 'DocumentUrl=@documentUrl', 'ModifiedDate=GETUTCDATE()'
            ];
            if (hasSupplyType && supplyType) setParts.push('SupplyType=@supplyType');
            if (hasIsActive && typeof body.isActive !== 'undefined') setParts.push('IsActive=@isActive');
            const reqBuilder = pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('category', sql.NVarChar, body.category)
                .input('sku', sql.NVarChar, body.sku || null)
                .input('description', sql.NVarChar, body.description || null)
                .input('unit', sql.NVarChar, body.unit || null)
                .input('quantityInStock', sql.Int, body.quantityInStock)
                .input('minimumStock', sql.Int, body.minimumStock)
                .input('reorderPoint', sql.Int, body.reorderPoint)
                .input('unitCost', sql.Decimal, body.unitCost || null)
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('notes', sql.NVarChar, body.notes)
                .input('warnings', sql.NVarChar, body.warnings)
                .input('imageUrl', sql.NVarChar, body.imageUrl)
                .input('documentUrl', sql.NVarChar, body.documentUrl);
            if (hasSupplyType && supplyType) reqBuilder.input('supplyType', sql.NVarChar(20), supplyType);
            if (hasIsActive && typeof body.isActive !== 'undefined') reqBuilder.input('isActive', sql.Bit, body.isActive === false ? 0 : 1);
            await reqBuilder.query(`UPDATE Supplies SET ${setParts.join(', ')} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Supply updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Supplies WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Supply deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
