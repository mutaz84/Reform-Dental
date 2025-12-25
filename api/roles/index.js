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
                    .query('SELECT * FROM Roles WHERE Id = @id AND IsActive = 1');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query('SELECT * FROM Roles WHERE IsActive = 1 ORDER BY RoleName');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('roleName', sql.NVarChar, body.roleName || '')
                .input('description', sql.NVarChar, body.description || '')
                .input('duties', sql.NVarChar, body.duties || '')
                .input('responsibilities', sql.NVarChar, body.responsibilities || '')
                .input('fileUrl', sql.NVarChar, body.fileUrl || '')
                .input('fileName', sql.NVarChar, body.fileName || '')
                .input('isActive', sql.Bit, 1)
                .query('INSERT INTO Roles (RoleName, Description, Duties, Responsibilities, FileUrl, FileName, IsActive, CreatedDate) OUTPUT INSERTED.Id VALUES (@roleName, @description, @duties, @responsibilities, @fileUrl, @fileName, @isActive, GETDATE())');
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'Role created successfully' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('roleName', sql.NVarChar, body.roleName || '')
                .input('description', sql.NVarChar, body.description || '')
                .input('duties', sql.NVarChar, body.duties || '')
                .input('responsibilities', sql.NVarChar, body.responsibilities || '')
                .input('fileUrl', sql.NVarChar, body.fileUrl || '')
                .input('fileName', sql.NVarChar, body.fileName || '')
                .query('UPDATE Roles SET RoleName=@roleName, Description=@description, Duties=@duties, Responsibilities=@responsibilities, FileUrl=@fileUrl, FileName=@fileName, ModifiedDate=GETDATE() WHERE Id=@id');
            context.res = { status: 200, headers, body: { message: 'Role updated successfully' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Roles SET IsActive = 0, ModifiedDate = GETDATE() WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Role deleted successfully' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
