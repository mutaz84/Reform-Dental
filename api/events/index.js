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
                    .query('SELECT * FROM Events WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query('SELECT * FROM Events ORDER BY EventDate, StartTime');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('title', sql.NVarChar, body.title)
                .input('eventDate', sql.Date, body.eventDate)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('eventType', sql.NVarChar, body.eventType)
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('description', sql.NVarChar, body.description)
                .input('color', sql.NVarChar, body.color)
                .query(`INSERT INTO Events (Title, EventDate, StartTime, EndTime, EventType, ClinicId, Description, Color) 
                        OUTPUT INSERTED.Id VALUES (@title, @eventDate, @startTime, @endTime, @eventType, @clinicId, @description, @color)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('title', sql.NVarChar, body.title)
                .input('eventDate', sql.Date, body.eventDate)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('description', sql.NVarChar, body.description)
                .query(`UPDATE Events SET Title=@title, EventDate=@eventDate, StartTime=@startTime, EndTime=@endTime, Description=@description WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Event updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Events WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Event deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
