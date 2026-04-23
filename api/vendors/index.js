const sql = require('mssql');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=(?:tcp:)?([^,;]+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);

        return {
            server: serverMatch ? serverMatch[1] : '',
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: { encrypt: true, trustServerCertificate: false }
        };
    }
    return {
        server: process.env.SQL_SERVER || '',
        database: process.env.SQL_DATABASE || '',
        user: process.env.SQL_USER || '',
        password: process.env.SQL_PASSWORD || '',
        options: { encrypt: true, trustServerCertificate: false }
    };
}

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
        const pool = await sql.connect(getConfig());
        const vendorColumns = await getTableColumns(pool, 'Vendors');
        if (vendorColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Vendors table not found.' } };
            return;
        }

        const hasIsActive = hasColumn(vendorColumns, 'IsActive');
        const orderBy = hasColumn(vendorColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';
        const id = req.params.id;

        if (req.method === 'GET') {
            if (id) {
                const where = ['Id = @id'];
                if (hasIsActive) {
                    where.push('IsActive = 1');
                }
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT * FROM Vendors WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const whereClause = hasIsActive ? 'WHERE IsActive = 1' : '';
                const result = await pool.request()
                    .query(`SELECT * FROM Vendors ${whereClause} ${orderBy}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
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
                .input('isActive', sql.Bit, body.isActive !== false ? 1 : 0)
                .query('INSERT INTO Vendors (Name, VendorType, ContactName, Phone, AlternatePhone, Email, Address, City, State, ZipCode, Website, PortalUsername, PortalPassword, Notes, IsActive, CreatedDate) OUTPUT INSERTED.Id VALUES (@name, @vendorType, @contactName, @phone, @alternatePhone, @email, @address, @city, @state, @zipCode, @website, @portalUsername, @portalPassword, @notes, @isActive, GETDATE())');
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'Vendor created successfully' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
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
                .input('isActive', sql.Bit, body.isActive !== false ? 1 : 0)
                .query('UPDATE Vendors SET Name=@name, VendorType=@vendorType, ContactName=@contactName, Phone=@phone, AlternatePhone=@alternatePhone, Email=@email, Address=@address, City=@city, State=@state, ZipCode=@zipCode, Website=@website, PortalUsername=@portalUsername, PortalPassword=@portalPassword, Notes=@notes, IsActive=@isActive, ModifiedDate=GETDATE() WHERE Id=@id');
            context.res = { status: 200, headers, body: { message: 'Vendor updated successfully' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Vendors WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Vendor deleted successfully' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
