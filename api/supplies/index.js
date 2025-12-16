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
                    .query('SELECT * FROM Supplies WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query('SELECT * FROM Supplies WHERE IsActive = 1 ORDER BY Name');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
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
                .query(`INSERT INTO Supplies (Name, Category, SKU, Description, Unit, QuantityInStock, MinimumStock, ReorderPoint, UnitCost, ClinicId) 
                        OUTPUT INSERTED.Id VALUES (@name, @category, @sku, @description, @unit, @quantityInStock, @minimumStock, @reorderPoint, @unitCost, @clinicId)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('category', sql.NVarChar, body.category)
                .input('quantityInStock', sql.Int, body.quantityInStock)
                .input('minimumStock', sql.Int, body.minimumStock)
                .input('reorderPoint', sql.Int, body.reorderPoint)
                .query(`UPDATE Supplies SET Name=@name, Category=@category, QuantityInStock=@quantityInStock, MinimumStock=@minimumStock, ReorderPoint=@reorderPoint, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Supply updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Supplies SET IsActive = 0 WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Supply deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
