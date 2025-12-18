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
                // Get single user with all fields
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT Id, Username, FirstName, MiddleName, LastName, Gender, DateOfBirth, 
                            PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                            JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role, HireDate,
                            HourlyRate, Salary, Color, CreatedDate, ModifiedDate
                            FROM Users WHERE Id = @id AND IsActive = 1`);
                
                if (result.recordset.length === 0) {
                    context.res = { status: 404, headers, body: { error: 'User not found' } };
                } else {
                    context.res = { status: 200, headers, body: result.recordset[0] };
                }
            } else {
                // Get all users with all fields
                const result = await pool.request()
                    .query(`SELECT Id, Username, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                            PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                            JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role, HireDate,
                            HourlyRate, Salary, Color, CreatedDate, ModifiedDate
                            FROM Users WHERE IsActive = 1 ORDER BY FirstName`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('username', sql.NVarChar, body.username)
                .input('passwordHash', sql.NVarChar, body.password || 'changeme')
                .input('firstName', sql.NVarChar, body.firstName || '')
                .input('middleName', sql.NVarChar, body.middleName || '')
                .input('lastName', sql.NVarChar, body.lastName || '')
                .input('gender', sql.NVarChar, body.gender || '')
                .input('dateOfBirth', sql.Date, body.dateOfBirth || null)
                .input('personalEmail', sql.NVarChar, body.personalEmail || '')
                .input('workEmail', sql.NVarChar, body.workEmail || '')
                .input('homePhone', sql.NVarChar, body.homePhone || '')
                .input('cellPhone', sql.NVarChar, body.cellPhone || '')
                .input('address', sql.NVarChar, body.address || '')
                .input('city', sql.NVarChar, body.city || '')
                .input('state', sql.NVarChar, body.state || '')
                .input('zipCode', sql.NVarChar, body.zipCode || '')
                .input('jobTitle', sql.NVarChar, body.jobTitle || '')
                .input('staffType', sql.NVarChar, body.staffType || 'non-clinical')
                .input('employeeType', sql.NVarChar, body.employeeType || 'full-time')
                .input('department', sql.NVarChar, body.department || '')
                .input('employeeStatus', sql.NVarChar, body.employeeStatus || 'active')
                .input('role', sql.NVarChar, body.role || 'user')
                .input('hireDate', sql.Date, body.hireDate || null)
                .input('hourlyRate', sql.Decimal(10,2), body.hourlyRate || null)
                .input('salary', sql.Decimal(12,2), body.salary || null)
                .input('color', sql.NVarChar, body.color || '#3b82f6')
                .query(`INSERT INTO Users (Username, PasswordHash, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                        PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                        JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role, HireDate,
                        HourlyRate, Salary, Color) 
                        OUTPUT INSERTED.Id 
                        VALUES (@username, @passwordHash, @firstName, @middleName, @lastName, @gender, @dateOfBirth,
                        @personalEmail, @workEmail, @homePhone, @cellPhone, @address, @city, @state, @zipCode,
                        @jobTitle, @staffType, @employeeType, @department, @employeeStatus, @role, @hireDate,
                        @hourlyRate, @salary, @color)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id, message: 'User created' } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('firstName', sql.NVarChar, body.firstName || '')
                .input('middleName', sql.NVarChar, body.middleName || '')
                .input('lastName', sql.NVarChar, body.lastName || '')
                .input('gender', sql.NVarChar, body.gender || '')
                .input('dateOfBirth', sql.Date, body.dateOfBirth || null)
                .input('personalEmail', sql.NVarChar, body.personalEmail || '')
                .input('workEmail', sql.NVarChar, body.workEmail || '')
                .input('homePhone', sql.NVarChar, body.homePhone || '')
                .input('cellPhone', sql.NVarChar, body.cellPhone || '')
                .input('address', sql.NVarChar, body.address || '')
                .input('city', sql.NVarChar, body.city || '')
                .input('state', sql.NVarChar, body.state || '')
                .input('zipCode', sql.NVarChar, body.zipCode || '')
                .input('jobTitle', sql.NVarChar, body.jobTitle || '')
                .input('staffType', sql.NVarChar, body.staffType || '')
                .input('employeeType', sql.NVarChar, body.employeeType || '')
                .input('department', sql.NVarChar, body.department || '')
                .input('employeeStatus', sql.NVarChar, body.employeeStatus || '')
                .input('role', sql.NVarChar, body.role || '')
                .input('hireDate', sql.Date, body.hireDate || null)
                .input('hourlyRate', sql.Decimal(10,2), body.hourlyRate || null)
                .input('salary', sql.Decimal(12,2), body.salary || null)
                .input('color', sql.NVarChar, body.color || '')
                .query(`UPDATE Users SET FirstName=@firstName, MiddleName=@middleName, LastName=@lastName, 
                        Gender=@gender, DateOfBirth=@dateOfBirth, PersonalEmail=@personalEmail, WorkEmail=@workEmail,
                        HomePhone=@homePhone, CellPhone=@cellPhone, Address=@address, City=@city, State=@state, ZipCode=@zipCode,
                        JobTitle=@jobTitle, StaffType=@staffType, EmployeeType=@employeeType, Department=@department,
                        EmployeeStatus=@employeeStatus, Role=@role, HireDate=@hireDate, HourlyRate=@hourlyRate, Salary=@salary,
                        Color=@color, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
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
