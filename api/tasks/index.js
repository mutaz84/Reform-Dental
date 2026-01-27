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
                // Support filtering by TaskType
                const taskType = req.query.taskType;
                let query = 'SELECT * FROM Tasks';
                if (taskType) {
                    query += ' WHERE TaskType = @taskType';
                }
                query += ' ORDER BY DueDate, Priority';
                
                const request = pool.request();
                if (taskType) {
                    request.input('taskType', sql.NVarChar, taskType);
                }
                const result = await request.query(query);
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
                .input('dueTime', sql.NVarChar, body.dueTime || null)
                .input('assignedToId', sql.Int, body.assignedToId || null)
                .input('assignedById', sql.Int, body.assignedById || null)
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('taskType', sql.NVarChar, body.taskType || 'Regular')
                .input('isPaid', sql.Bit, body.isPaid || false)
                .input('payAmount', sql.Decimal(10,2), body.payAmount || null)
                .input('location', sql.NVarChar, body.location || null)
                .input('timeEstimate', sql.NVarChar, body.timeEstimate || null)
                .input('assignee', sql.NVarChar, body.assignee || null)
                .query(`INSERT INTO Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, IsPaid, PayAmount, Location, TimeEstimate, Assignee) 
                        OUTPUT INSERTED.Id VALUES (@title, @description, @category, @priority, @status, @dueDate, @dueTime, @assignedToId, @assignedById, @clinicId, @taskType, @isPaid, @payAmount, @location, @timeEstimate, @assignee)`);
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
                .input('dueTime', sql.NVarChar, body.dueTime || null)
                .input('assignedToId', sql.Int, body.assignedToId || null)
                .input('assignedById', sql.Int, body.assignedById || null)
                .input('taskType', sql.NVarChar, body.taskType || 'Regular')
                .input('isPaid', sql.Bit, body.isPaid || false)
                .input('payAmount', sql.Decimal(10,2), body.payAmount || null)
                .input('location', sql.NVarChar, body.location || null)
                .input('timeEstimate', sql.NVarChar, body.timeEstimate || null)
                .input('assignee', sql.NVarChar, body.assignee || null)
                .input('claimedBy', sql.NVarChar, body.claimedBy || null)
                .input('claimedAt', sql.DateTime, body.claimedAt || null)
                .query(`UPDATE Tasks SET Title=@title, Description=@description, Category=@category, Priority=@priority, Status=@status, DueDate=@dueDate, DueTime=@dueTime, AssignedToId=@assignedToId, AssignedById=@assignedById, TaskType=@taskType, IsPaid=@isPaid, PayAmount=@payAmount, Location=@location, TimeEstimate=@timeEstimate, Assignee=@assignee, ClaimedBy=@claimedBy, ClaimedAt=@claimedAt, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
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
