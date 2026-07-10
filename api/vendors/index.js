const { sql, getPool, resetPool } = require('../shared/database');
const { TENANT_PARAM, getRequestUserId, tenantSubscriptionScope } = require('../shared/tenant');
const https = require('https');

const GRAY_FOREST_VENDOR_API_BASE = 'https://gray-forest-05ad14f10.3.azurestaticapps.net/api/vendors';

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function addColumnValue(columns, cols, vals, columnName, paramName, valueExpression) {
    if (hasColumn(columns, columnName)) {
        cols.push(columnName);
        vals.push(valueExpression || `@${paramName}`);
    }
}

function addSetClause(columns, setClauses, columnName, paramName, valueExpression) {
    if (hasColumn(columns, columnName)) {
        setClauses.push(`${columnName}=${valueExpression || `@${paramName}`}`);
    }
}

function isBlackSkyRequest(req) {
    const hostParts = [
        process.env.WEBSITE_HOSTNAME,
        process.env.SWA_HOSTNAME,
        req.headers && req.headers.host,
        req.headers && req.headers['x-forwarded-host']
    ];
    return hostParts.some((part) => /black-sky-06e87aa10/i.test(String(part || '')));
}

function requestJson(url, options, body) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? undefined : JSON.stringify(body || {});
        const req = https.request(url, {
            method: options.method,
            headers: {
                ...options.headers,
                ...(data !== undefined ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let parsed = raw;
                try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
                resolve({ status: res.statusCode || 500, body: parsed });
            });
        });
        req.on('error', reject);
        if (data !== undefined) req.write(data);
        req.end();
    });
}

async function proxyVendorToGrayForest(context, req, responseHeaders) {
    const id = req.params && req.params.id ? String(req.params.id).trim() : '';
    const url = new URL(id ? `${GRAY_FOREST_VENDOR_API_BASE}/${encodeURIComponent(id)}` : GRAY_FOREST_VENDOR_API_BASE);
    Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const proxyHeaders = { 'Content-Type': 'application/json' };
    const userId = req.headers && (req.headers['x-user-id'] || req.headers['X-User-Id']);
    if (userId) proxyHeaders['X-User-Id'] = String(userId);
    const authorization = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (authorization) proxyHeaders.Authorization = String(authorization);

    const hasBody = !['GET', 'DELETE'].includes(String(req.method || '').toUpperCase());
    const result = await requestJson(url, { method: req.method, headers: proxyHeaders }, hasBody ? req.body : undefined);
    context.res = { status: result.status, headers: responseHeaders, body: result.body };
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    if (isBlackSkyRequest(req)) {
        await proxyVendorToGrayForest(context, req, headers);
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
        const hasSubscriptionId = hasColumn(vendorColumns, 'SubscriptionId');
        const orderBy = hasColumn(vendorColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';
        const id = req.params.id;
        const callerUserId = getRequestUserId(req);

        if (req.method === 'GET') {
            if (id) {
                const where = ['Id = @id'];
                if (hasIsActive) where.push('IsActive = 1');
                if (hasSubscriptionId) where.push(tenantSubscriptionScope('SubscriptionId'));
                const r = pool.request().input('id', sql.Int, id);
                if (hasSubscriptionId) r.input(TENANT_PARAM, sql.Int, callerUserId || -1);
                const result = await r.query(`SELECT * FROM Vendors WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const where = [];
                if (hasIsActive) where.push('IsActive = 1');
                if (hasSubscriptionId) where.push(tenantSubscriptionScope('SubscriptionId'));
                const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
                const r = pool.request();
                if (hasSubscriptionId) r.input(TENANT_PARAM, sql.Int, callerUserId || -1);
                const result = await r.query(`SELECT * FROM Vendors ${whereClause} ${orderBy}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const hasImageUrl = hasColumn(vendorColumns, 'ImageUrl');
            const cols = ['Name'];
            const vals = ['@name'];
            addColumnValue(vendorColumns, cols, vals, 'VendorType', 'vendorType');
            addColumnValue(vendorColumns, cols, vals, 'ContactName', 'contactName');
            addColumnValue(vendorColumns, cols, vals, 'Phone', 'phone');
            addColumnValue(vendorColumns, cols, vals, 'AlternatePhone', 'alternatePhone');
            addColumnValue(vendorColumns, cols, vals, 'Email', 'email');
            addColumnValue(vendorColumns, cols, vals, 'Address', 'address');
            addColumnValue(vendorColumns, cols, vals, 'City', 'city');
            addColumnValue(vendorColumns, cols, vals, 'State', 'state');
            addColumnValue(vendorColumns, cols, vals, 'ZipCode', 'zipCode');
            addColumnValue(vendorColumns, cols, vals, 'Website', 'website');
            addColumnValue(vendorColumns, cols, vals, 'PortalUsername', 'portalUsername');
            addColumnValue(vendorColumns, cols, vals, 'PortalPassword', 'portalPassword');
            addColumnValue(vendorColumns, cols, vals, 'Notes', 'notes');
            addColumnValue(vendorColumns, cols, vals, 'IsActive', 'isActive');
            addColumnValue(vendorColumns, cols, vals, 'CreatedDate', null, 'GETDATE()');
            if (hasImageUrl) { cols.push('ImageUrl'); vals.push('@imageUrl'); }
            if (hasSubscriptionId) {
                cols.push('SubscriptionId');
                vals.push('(SELECT TOP 1 SubscriptionId FROM Users WHERE Id = @' + TENANT_PARAM + ')');
            }
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
            if (hasSubscriptionId) {
                request.input(TENANT_PARAM, sql.Int, callerUserId || -1);
            }
            const result = await request.query(`INSERT INTO Vendors (${cols.join(', ')}) OUTPUT INSERTED.Id VALUES (${vals.join(', ')})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'Vendor created successfully' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            const hasImageUrl = hasColumn(vendorColumns, 'ImageUrl');
            const setClauses = ['Name=@name'];
            addSetClause(vendorColumns, setClauses, 'VendorType', 'vendorType');
            addSetClause(vendorColumns, setClauses, 'ContactName', 'contactName');
            addSetClause(vendorColumns, setClauses, 'Phone', 'phone');
            addSetClause(vendorColumns, setClauses, 'AlternatePhone', 'alternatePhone');
            addSetClause(vendorColumns, setClauses, 'Email', 'email');
            addSetClause(vendorColumns, setClauses, 'Address', 'address');
            addSetClause(vendorColumns, setClauses, 'City', 'city');
            addSetClause(vendorColumns, setClauses, 'State', 'state');
            addSetClause(vendorColumns, setClauses, 'ZipCode', 'zipCode');
            addSetClause(vendorColumns, setClauses, 'Website', 'website');
            addSetClause(vendorColumns, setClauses, 'PortalUsername', 'portalUsername');
            addSetClause(vendorColumns, setClauses, 'PortalPassword', 'portalPassword');
            addSetClause(vendorColumns, setClauses, 'Notes', 'notes');
            addSetClause(vendorColumns, setClauses, 'IsActive', 'isActive');
            addSetClause(vendorColumns, setClauses, 'ModifiedDate', null, 'GETDATE()');
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
            const updateWhere = hasSubscriptionId
                ? `WHERE Id=@id AND ${tenantSubscriptionScope('SubscriptionId')}`
                : 'WHERE Id=@id';
            if (hasSubscriptionId) {
                request.input(TENANT_PARAM, sql.Int, callerUserId || -1);
            }
            await request.query(`UPDATE Vendors SET ${setClauses.join(', ')} ${updateWhere}`);
            context.res = { status: 200, headers, body: { message: 'Vendor updated successfully' } };
        } else if (req.method === 'DELETE' && id) {
            const r = pool.request().input('id', sql.Int, id);
            const deleteWhere = hasSubscriptionId
                ? `WHERE Id = @id AND ${tenantSubscriptionScope('SubscriptionId')}`
                : 'WHERE Id = @id';
            if (hasSubscriptionId) r.input(TENANT_PARAM, sql.Int, callerUserId || -1);
            await r.query(`DELETE FROM Vendors ${deleteWhere}`);
            context.res = { status: 200, headers, body: { message: 'Vendor deleted successfully' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
