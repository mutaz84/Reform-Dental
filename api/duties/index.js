const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE || '',
    user: process.env.SQL_USER || '',
    password: process.env.SQL_PASSWORD || '',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Parse connection string if provided
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
            options: {
                encrypt: true,
                trustServerCertificate: false
            }
        };
    }
    return config;
}

module.exports = async function (context, req) {
    // Handle CORS
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await sql.connect(getConfig());
        const id = req.params.id;
        const userId = req.query.userId;

        if (req.method === 'GET') {
            if (id) {
                // Get single duty
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT Id, Name, Description, Schedule, ScheduleTime, ScheduleDay, Location, 
                            Priority, AssignedToUserId, CreatedDate, ModifiedDate, IsActive
                            FROM Duties WHERE Id = @id AND IsActive = 1`);
                
                if (result.recordset.length === 0) {
                    context.res = { status: 404, headers, body: { error: 'Duty not found' } };
                } else {
                    context.res = { status: 200, headers, body: result.recordset[0] };
                }
            } else if (userId) {
                // Get duties for a specific user
                const result = await pool.request()
                    .input('userId', sql.Int, userId)
                    .query(`SELECT d.Id, d.Name, d.Description, d.Schedule, d.ScheduleTime, d.ScheduleDay, 
                            d.Location, d.Priority, d.AssignedToUserId, d.CreatedDate, d.ModifiedDate, d.IsActive,
                            u.FirstName + ' ' + u.LastName as AssignedToName
                            FROM Duties d
                            LEFT JOIN Users u ON d.AssignedToUserId = u.Id
                            WHERE d.AssignedToUserId = @userId AND d.IsActive = 1 
                            ORDER BY d.Priority, d.Name`);
                context.res = { status: 200, headers, body: result.recordset };
            } else {
                // Get all duties
                const result = await pool.request()
                    .query(`SELECT d.Id, d.Name, d.Description, d.Schedule, d.ScheduleTime, d.ScheduleDay, 
                            d.Location, d.Priority, d.AssignedToUserId, d.CreatedDate, d.ModifiedDate, d.IsActive,
                            u.FirstName + ' ' + u.LastName as AssignedToName
                            FROM Duties d
                            LEFT JOIN Users u ON d.AssignedToUserId = u.Id
                            WHERE d.IsActive = 1 
                            ORDER BY d.Priority, d.Name`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('description', sql.NVarChar, body.description || '')
                .input('schedule', sql.NVarChar, body.schedule || 'Daily') // Daily, Weekly, Monthly, Custom
                .input('scheduleTime', sql.NVarChar, body.scheduleTime || '')
                .input('scheduleDay', sql.NVarChar, body.scheduleDay || '')
                .input('location', sql.NVarChar, body.location || '')
                .input('priority', sql.NVarChar, body.priority || 'Medium') // High, Medium, Low
                .input('assignedToUserId', sql.Int, body.assignedToUserId || null)
                .query(`INSERT INTO Duties (Name, Description, Schedule, ScheduleTime, ScheduleDay, Location, Priority, AssignedToUserId)
                        OUTPUT INSERTED.Id
                        VALUES (@name, @description, @schedule, @scheduleTime, @scheduleDay, @location, @priority, @assignedToUserId)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'Duty created' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('description', sql.NVarChar, body.description || '')
                .input('schedule', sql.NVarChar, body.schedule || 'Daily')
                .input('scheduleTime', sql.NVarChar, body.scheduleTime || '')
                .input('scheduleDay', sql.NVarChar, body.scheduleDay || '')
                .input('location', sql.NVarChar, body.location || '')
                .input('priority', sql.NVarChar, body.priority || 'Medium')
                .input('assignedToUserId', sql.Int, body.assignedToUserId || null)
                .query(`UPDATE Duties SET 
                        Name = @name, 
                        Description = @description, 
                        Schedule = @schedule, 
                        ScheduleTime = @scheduleTime, 
                        ScheduleDay = @scheduleDay, 
                        Location = @location, 
                        Priority = @priority, 
                        AssignedToUserId = @assignedToUserId,
                        ModifiedDate = GETDATE()
                        WHERE Id = @id`);
            context.res = { status: 200, headers, body: { message: 'Duty updated' } };
        } else if (req.method === 'DELETE' && id) {
            // Soft delete
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Duties SET IsActive = 0, ModifiedDate = GETDATE() WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Duty deleted' } };
        } else {
            context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
        }
    } catch (error) {
        context.log('Error:', error.message);
        context.res = {
            status: 500,
            headers,
            body: { error: 'Database error', details: error.message }
        };
    }
};
