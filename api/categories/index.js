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
            // Optional query param: ?type=equipment|instruments|supplies
            const categoryType = req.query.type;
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM Categories WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else if (categoryType) {
                const result = await pool.request()
                    .input('categoryType', sql.NVarChar, categoryType)
                    .query('SELECT * FROM Categories WHERE CategoryType = @categoryType AND IsActive = 1 ORDER BY SortOrder, Name');
                context.res = { status: 200, headers, body: result.recordset };
            } else {
                const result = await pool.request()
                    .query('SELECT * FROM Categories WHERE IsActive = 1 ORDER BY CategoryType, SortOrder, Name');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('categoryType', sql.NVarChar, body.categoryType)
                .input('description', sql.NVarChar, body.description || null)
                .input('sortOrder', sql.Int, body.sortOrder || 0)
                .query(`INSERT INTO Categories (Name, CategoryType, Description, SortOrder) 
                        OUTPUT INSERTED.Id VALUES (@name, @categoryType, @description, @sortOrder)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('categoryType', sql.NVarChar, body.categoryType)
                .input('description', sql.NVarChar, body.description || null)
                .input('sortOrder', sql.Int, body.sortOrder || 0)
                .input('isActive', sql.Bit, body.isActive !== false ? 1 : 0)
                .query(`UPDATE Categories SET Name=@name, CategoryType=@categoryType, Description=@description, SortOrder=@sortOrder, IsActive=@isActive, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Category updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Categories SET IsActive = 0, ModifiedDate=GETUTCDATE() WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Category deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
