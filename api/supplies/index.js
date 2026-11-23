const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, resolveWritableClinicId, TENANT_PARAM } = require('../shared/tenant');

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
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
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

        const hasSupplyType = hasColumn(supplyColumns, 'SupplyType');
        // Declared here (not inside POST) so PUT can use it too. Previously PUT threw
        // "hasIsActive is not defined" and every supply update returned HTTP 500.
        const hasIsActive = hasColumn(supplyColumns, 'IsActive');
        const hasLowStockCol = hasColumn(supplyColumns, 'LowStock');
        const hasOutOfStockCol = hasColumn(supplyColumns, 'OutOfStock');
        const orderBy = hasColumn(supplyColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';
        const id = req.params.id;
        const requestedType = normalizeSupplyType(req.query && req.query.type);
        const tenantUserId = getRequestUserId(req);
        const hasClinicCol = hasColumn(supplyColumns, 'ClinicId');

        if (req.method === 'GET') {
            if (id) {
                const where = ['s.Id = @id'];
                const reqBuilder = pool.request().input('id', sql.Int, id);
                if (hasClinicCol) {
                    if (!tenantUserId) {
                        context.res = { status: 200, headers, body: null };
                        return;
                    }
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    where.push(tenantClinicScopeSql('s.ClinicId'));
                }
                const result = await reqBuilder
                    .query(`SELECT s.*, c.Name AS ClinicName FROM Supplies s LEFT JOIN Clinics c ON c.Id = s.ClinicId WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                if (hasClinicCol && !tenantUserId) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                const where = [];
                const reqBuilder = pool.request();
                if (hasSupplyType && requestedType) {
                    where.push('(SupplyType = @stype OR SupplyType IS NULL)');
                    reqBuilder.input('stype', sql.NVarChar(20), requestedType);
                }
                if (hasClinicCol) {
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    where.push(tenantClinicScopeSql('s.ClinicId'));
                }
                const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
                const result = await reqBuilder.query(`SELECT s.*, c.Name AS ClinicName FROM Supplies s LEFT JOIN Clinics c ON c.Id = s.ClinicId ${whereClause} ORDER BY s.${hasColumn(supplyColumns, 'Name') ? 'Name' : 'Id'}`);
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
            let visibleClinicId = body.clinicId || body.ClinicId || null;
            if (hasClinicCol) {
                if (!tenantUserId) {
                    context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                    return;
                }
                visibleClinicId = await resolveWritableClinicId(pool, body, tenantUserId);
                if (!visibleClinicId) {
                    context.res = { status: 403, headers, body: { error: 'Clinic is outside the current subscription.' } };
                    return;
                }
            }
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
                .input('clinicId', sql.Int, visibleClinicId)
                .input('notes', sql.NVarChar, body.notes || null)
                .input('warnings', sql.NVarChar, body.warnings || null)
                .input('imageUrl', sql.NVarChar, body.imageUrl || null)
                .input('documentUrl', sql.NVarChar, body.documentUrl || null);
            if (hasSupplyType) reqBuilder.input('supplyType', sql.NVarChar(20), supplyType);
            if (hasIsActive) reqBuilder.input('isActive', sql.Bit, body.isActive === false ? 0 : 1);
            const result = await reqBuilder.query(`INSERT INTO Supplies (${cols.join(', ')}) OUTPUT INSERTED.Id VALUES (${params.join(', ')})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            // Partial update: only columns present in the request body are written.
            // The UI sends small bodies for stock toggles ({ outOfStock, lowStock, supplyType });
            // writing every column would blank out Name, Notes, quantities, etc.
            const body = req.body || {};
            const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
            const setParts = [];
            const reqBuilder = pool.request().input('id', sql.Int, id);
            const toNullableString = (v) => (v === undefined || v === null || String(v).trim() === '') ? null : String(v);
            const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
            const toMoney = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

            if (has('name')) {
                const name = String(body.name || '').trim();
                if (!name) {
                    context.res = { status: 400, headers, body: { error: 'Supply name is required.' } };
                    return;
                }
                setParts.push('Name=@name'); reqBuilder.input('name', sql.NVarChar, name);
            }
            const stringFields = [
                ['category', 'Category'], ['sku', 'SKU'], ['description', 'Description'], ['unit', 'Unit'],
                ['notes', 'Notes'], ['warnings', 'Warnings'], ['imageUrl', 'ImageUrl'], ['documentUrl', 'DocumentUrl']
            ];
            for (const [key, col] of stringFields) {
                if (!has(key) || !hasColumn(supplyColumns, col)) continue;
                setParts.push(`${col}=@${key}`); reqBuilder.input(key, sql.NVarChar, toNullableString(body[key]));
            }
            const intFields = [['quantityInStock', 'QuantityInStock'], ['minimumStock', 'MinimumStock'], ['reorderPoint', 'ReorderPoint']];
            for (const [key, col] of intFields) {
                if (!has(key) || !hasColumn(supplyColumns, col)) continue;
                setParts.push(`${col}=@${key}`); reqBuilder.input(key, sql.Int, toInt(body[key]));
            }
            if (has('unitCost') && hasColumn(supplyColumns, 'UnitCost')) {
                setParts.push('UnitCost=@unitCost'); reqBuilder.input('unitCost', sql.Decimal(18, 2), toMoney(body.unitCost));
            }
            const supplyType = normalizeSupplyType(body.supplyType);
            if (hasSupplyType && supplyType) { setParts.push('SupplyType=@supplyType'); reqBuilder.input('supplyType', sql.NVarChar(20), supplyType); }
            if (hasIsActive && has('isActive')) { setParts.push('IsActive=@isActive'); reqBuilder.input('isActive', sql.Bit, body.isActive === false ? 0 : 1); }
            // Stock flags are stored only if the columns exist (see database/migrations/2026-11-23-supplies-stock-flags.sql).
            const ignored = [];
            if (has('lowStock')) {
                if (hasLowStockCol) { setParts.push('LowStock=@lowStock'); reqBuilder.input('lowStock', sql.Bit, body.lowStock ? 1 : 0); }
                else ignored.push('lowStock');
            }
            if (has('outOfStock')) {
                if (hasOutOfStockCol) { setParts.push('OutOfStock=@outOfStock'); reqBuilder.input('outOfStock', sql.Bit, body.outOfStock ? 1 : 0); }
                else ignored.push('outOfStock');
            }

            let updateWhere = 'Id=@id';
            if (hasClinicCol) {
                if (!tenantUserId) {
                    context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                    return;
                }
                reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                updateWhere += ` AND ${tenantClinicScopeSql('ClinicId')}`;
                // Only move the supply to another clinic when the body explicitly names one.
                // (Resolving a clinic from an empty body can create a new clinic.)
                const clinicKeys = ['clinicId', 'ClinicId', 'officeId', 'officeID', 'OfficeId', 'OfficeID', 'clinicName', 'ClinicName', 'officeName'];
                if (clinicKeys.some((k) => has(k) && body[k] !== null && body[k] !== '')) {
                    const visibleClinicId = await resolveWritableClinicId(pool, body, tenantUserId);
                    if (!visibleClinicId) {
                        context.res = { status: 403, headers, body: { error: 'Clinic is outside the current subscription.' } };
                        return;
                    }
                    setParts.push('ClinicId=@clinicId'); reqBuilder.input('clinicId', sql.Int, visibleClinicId);
                }
            }

            if (setParts.length === 0) {
                context.res = { status: 200, headers, body: { message: 'No changes', ignored } };
                return;
            }
            if (hasColumn(supplyColumns, 'ModifiedDate')) setParts.push('ModifiedDate=GETUTCDATE()');
            const result = await reqBuilder.query(`UPDATE Supplies SET ${setParts.join(', ')} WHERE ${updateWhere}`);
            if (!result.rowsAffected || result.rowsAffected[0] === 0) {
                context.res = { status: 404, headers, body: { error: 'Supply not found in current subscription.' } };
                return;
            }
            context.res = { status: 200, headers, body: { message: 'Supply updated', ignored } };
        } else if (req.method === 'DELETE' && id) {
            const request = pool.request().input('id', sql.Int, id);
            let deleteWhere = 'Id = @id';
            if (hasClinicCol) {
                if (!tenantUserId) {
                    context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                    return;
                }
                request.input(TENANT_PARAM, sql.Int, tenantUserId);
                deleteWhere += ` AND ${tenantClinicScopeSql('ClinicId')}`;
            }
            const result = await request.query(`DELETE FROM Supplies WHERE ${deleteWhere}`);
            if (hasClinicCol && (!result.rowsAffected || result.rowsAffected[0] === 0)) {
                context.res = { status: 404, headers, body: { error: 'Supply not found in current subscription.' } };
                return;
            }
            context.res = { status: 200, headers, body: { message: 'Supply deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
