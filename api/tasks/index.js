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
                    .query('SELECT * FROM Tasks WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query('SELECT * FROM Tasks ORDER BY DueDate, Priority');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('title', sql.NVarChar, body.title)
                .input('description', sql.NVarChar, body.description)
                .input('category', sql.NVarChar, body.category)
                .input('priority', sql.NVarChar, body.priority || 'Medium')
                .input('status', sql.NVarChar, body.status || 'Pending')
                .input('dueDate', sql.Date, body.dueDate || null)
                .input('assignedToId', sql.Int, body.assignedToId || null)
                .input('clinicId', sql.Int, body.clinicId || null)
                .query(`INSERT INTO Tasks (Title, Description, Category, Priority, Status, DueDate, AssignedToId, ClinicId) 
                        OUTPUT INSERTED.Id VALUES (@title, @description, @category, @priority, @status, @dueDate, @assignedToId, @clinicId)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('title', sql.NVarChar, body.title)
                .input('description', sql.NVarChar, body.description)
                .input('category', sql.NVarChar, body.category)
                .input('priority', sql.NVarChar, body.priority)
                .input('status', sql.NVarChar, body.status)
                .input('dueDate', sql.Date, body.dueDate || null)
                .query(`UPDATE Tasks SET Title=@title, Description=@description, Category=@category, Priority=@priority, Status=@status, DueDate=@dueDate, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Task updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Tasks WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Task deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
