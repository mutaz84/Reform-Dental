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

        if (req.method === 'GET') {
            if (id) {
                // Get single user
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT Id, Username, FirstName, LastName, Role, StaffType, EmployeeStatus, WorkEmail, CellPhone, JobTitle FROM Users WHERE Id = @id AND IsActive = 1');
                
                if (result.recordset.length === 0) {
                    context.res = { status: 404, headers, body: { error: 'User not found' } };
                } else {
                    context.res = { status: 200, headers, body: result.recordset[0] };
                }
            } else {
                // Get all users
                const result = await pool.request()
                    .query('SELECT Id, Username, FirstName, LastName, Role, StaffType, EmployeeStatus, WorkEmail, CellPhone, JobTitle FROM Users WHERE IsActive = 1 ORDER BY FirstName');
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('username', sql.NVarChar, body.username)
                .input('passwordHash', sql.NVarChar, body.password || 'changeme')
                .input('firstName', sql.NVarChar, body.firstName)
                .input('lastName', sql.NVarChar, body.lastName)
                .input('role', sql.NVarChar, body.role || 'user')
                .input('staffType', sql.NVarChar, body.staffType)
                .input('employeeStatus', sql.NVarChar, body.employeeStatus || 'active')
                .query(`INSERT INTO Users (Username, PasswordHash, FirstName, LastName, Role, StaffType, EmployeeStatus) 
                        OUTPUT INSERTED.Id VALUES (@username, @passwordHash, @firstName, @lastName, @role, @staffType, @employeeStatus)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'User created' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('firstName', sql.NVarChar, body.firstName)
                .input('lastName', sql.NVarChar, body.lastName)
                .input('role', sql.NVarChar, body.role)
                .input('staffType', sql.NVarChar, body.staffType)
                .input('employeeStatus', sql.NVarChar, body.employeeStatus)
                .query(`UPDATE Users SET FirstName=@firstName, LastName=@lastName, Role=@role, StaffType=@staffType, EmployeeStatus=@employeeStatus, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'User updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Users SET IsActive = 0 WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'User deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { 
            status: 500, 
            headers, 
            body: { error: 'Database error', details: err.message } 
        };
    }
};
