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
        const vendorColumns = await getTableColumns(pool, 'Vendors');
        if (vendorColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Vendors table not found.' } };
            return;
        }

        const hasIsActive = hasColumn(vendorColumns, 'IsActive');
        const orderBy = hasColumn(vendorColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';
        const id = req.params.id;

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            const hasClinicCol = hasColumn(vendorColumns, 'ClinicId');
            if (id) {
                const where = ['Id = @id'];
                if (hasIsActive) where.push('IsActive = 1');
                const reqBuilder = pool.request().input('id', sql.Int, id);
                if (hasClinicCol) {
                    if (!tenantUserId) {
                        context.res = { status: 200, headers, body: null };
                        return;
                    }
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    where.push(`(ClinicId IS NULL OR ${tenantClinicScopeSql('ClinicId')})`);
                }
                const result = await reqBuilder.query(`SELECT * FROM Vendors WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                if (hasClinicCol && !tenantUserId) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                const where = [];
                if (hasIsActive) where.push('IsActive = 1');
                const reqBuilder = pool.request();
                if (hasClinicCol) {
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    where.push(`(ClinicId IS NULL OR ${tenantClinicScopeSql('ClinicId')})`);
                }
                const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
                const result = await reqBuilder.query(`SELECT * FROM Vendors ${whereClause} ${orderBy}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const hasImageUrl = hasColumn(vendorColumns, 'ImageUrl');
            const cols = ['Name', 'VendorType', 'ContactName', 'Phone', 'AlternatePhone', 'Email', 'Address', 'City', 'State', 'ZipCode', 'Website', 'PortalUsername', 'PortalPassword', 'Notes', 'IsActive', 'CreatedDate'];
            const vals = ['@name', '@vendorType', '@contactName', '@phone', '@alternatePhone', '@email', '@address', '@city', '@state', '@zipCode', '@website', '@portalUsername', '@portalPassword', '@notes', '@isActive', 'GETDATE()'];
            if (hasImageUrl) { cols.push('ImageUrl'); vals.push('@imageUrl'); }
            const request = pool.request()
                .input('name', sql.NVarChar, body.name || '')
                .input('vendorType', sql.NVarChar, body.vendorType || '')
                .input('contactName', sql.NVarChar, body.contactPerson || '')
                .input('phone', sql.NVarChar, body.phone || '')
                .input('alternatePhone', sql.NVarChar, body.alternatePhone || '')
                .input('email', sql.NVarChar, body.email || '')
                .input('address', sql.NVarChar, body.address || '')
                .input('city', sql.NVarChar, body.city || '')
                .input('state', sql.NVarChar, body.state || '')
                .input('zipCode', sql.NVarChar, body.zipCode || '')
                .input('website', sql.NVarChar, body.website || '')
                .input('portalUsername', sql.NVarChar, body.portalUsername || '')
                .input('portalPassword', sql.NVarChar, body.portalPassword || '')
                .input('notes', sql.NVarChar, body.notes || '')
                .input('isActive', sql.Bit, body.isActive !== false ? 1 : 0);
            if (hasImageUrl) {
                request.input('imageUrl', sql.NVarChar(sql.MAX), body.imageUrl || body.ImageUrl || null);
            }
            const result = await request.query(`INSERT INTO Vendors (${cols.join(', ')}) OUTPUT INSERTED.Id VALUES (${vals.join(', ')})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'Vendor created successfully' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            const hasImageUrl = hasColumn(vendorColumns, 'ImageUrl');
            const setClauses = ['Name=@name', 'VendorType=@vendorType', 'ContactName=@contactName', 'Phone=@phone', 'AlternatePhone=@alternatePhone', 'Email=@email', 'Address=@address', 'City=@city', 'State=@state', 'ZipCode=@zipCode', 'Website=@website', 'PortalUsername=@portalUsername', 'PortalPassword=@portalPassword', 'Notes=@notes', 'IsActive=@isActive', 'ModifiedDate=GETDATE()'];
            const hasImageInBody = Object.prototype.hasOwnProperty.call(body, 'imageUrl') || Object.prototype.hasOwnProperty.call(body, 'ImageUrl');
            if (hasImageUrl && hasImageInBody) setClauses.push('ImageUrl=@imageUrl');
            const request = pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name || '')
                .input('vendorType', sql.NVarChar, body.vendorType || '')
                .input('contactName', sql.NVarChar, body.contactPerson || '')
                .input('phone', sql.NVarChar, body.phone || '')
                .input('alternatePhone', sql.NVarChar, body.alternatePhone || '')
                .input('email', sql.NVarChar, body.email || '')
                .input('address', sql.NVarChar, body.address || '')
                .input('city', sql.NVarChar, body.city || '')
                .input('state', sql.NVarChar, body.state || '')
                .input('zipCode', sql.NVarChar, body.zipCode || '')
                .input('website', sql.NVarChar, body.website || '')
                .input('portalUsername', sql.NVarChar, body.portalUsername || '')
                .input('portalPassword', sql.NVarChar, body.portalPassword || '')
                .input('notes', sql.NVarChar, body.notes || '')
                .input('isActive', sql.Bit, body.isActive !== false ? 1 : 0);
            if (hasImageUrl && hasImageInBody) {
                const incoming = (body.imageUrl !== undefined) ? body.imageUrl : body.ImageUrl;
                request.input('imageUrl', sql.NVarChar(sql.MAX), incoming || null);
            }
            await request.query(`UPDATE Vendors SET ${setClauses.join(', ')} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Vendor updated successfully' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Vendors WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Vendor deleted successfully' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
