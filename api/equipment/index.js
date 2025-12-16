const sql = require('mssql');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=tcp:([^,]+)/i);
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
    return {};
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
        const id = req.params.id;

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM Equipment WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query('SELECT * FROM Equipment ORDER BY Name');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('category', sql.NVarChar, body.category)
                .input('brand', sql.NVarChar, body.brand)
                .input('model', sql.NVarChar, body.model)
                .input('serialNumber', sql.NVarChar, body.serialNumber)
                .input('description', sql.NVarChar, body.description)
                .input('status', sql.NVarChar, body.status || 'operational')
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('purchaseDate', sql.Date, body.purchaseDate || null)
                .input('purchasePrice', sql.Decimal, body.purchasePrice || null)
                .input('warrantyExpiry', sql.Date, body.warrantyExpiry || null)
                .query(`INSERT INTO Equipment (Name, Category, Brand, Model, SerialNumber, Description, Status, ClinicId, PurchaseDate, PurchasePrice, WarrantyExpiry) 
                        OUTPUT INSERTED.Id VALUES (@name, @category, @brand, @model, @serialNumber, @description, @status, @clinicId, @purchaseDate, @purchasePrice, @warrantyExpiry)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('category', sql.NVarChar, body.category)
                .input('status', sql.NVarChar, body.status)
                .input('description', sql.NVarChar, body.description)
                .query(`UPDATE Equipment SET Name=@name, Category=@category, Status=@status, Description=@description, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Equipment updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Equipment WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Equipment deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
