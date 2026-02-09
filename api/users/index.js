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

        const parseClinicIds = (value) => {
            if (!value) return [];
            const raw = Array.isArray(value) ? value : [value];
            const ids = raw
                .flatMap((v) => {
                    if (v == null) return [];
                    if (typeof v === 'number') return [v];
                    if (typeof v === 'string') {
                        // Allow comma-separated list
                        return v.split(',').map((x) => x.trim()).filter(Boolean);
                    }
                    return [];
                })
                .map((v) => Number.parseInt(String(v), 10))
                .filter((n) => Number.isInteger(n) && n > 0);
            return Array.from(new Set(ids));
        };

        const parseJsonSafe = (s, fallback) => {
            try {
                if (typeof s !== 'string') return fallback;
                return JSON.parse(s);
            } catch (_) {
                return fallback;
            }
        };

        if (req.method === 'GET') {
            if (id) {
                // Get single user with all fields
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT Id, Username, FirstName, MiddleName, LastName, Gender, DateOfBirth, 
                            PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                            JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role, HireDate,
                            HourlyRate, Salary, Color, CreatedDate, ModifiedDate
                            , ISNULL((SELECT uc.ClinicId AS Id FROM UserClinics uc WHERE uc.UserId = Users.Id FOR JSON PATH), '[]') AS ClinicIdsJson
                            , ISNULL((SELECT c.Id AS Id, c.Name AS Name FROM UserClinics uc JOIN Clinics c ON c.Id = uc.ClinicId WHERE uc.UserId = Users.Id AND c.IsActive = 1 FOR JSON PATH), '[]') AS ClinicsJson
                            FROM Users WHERE Id = @id AND IsActive = 1`);
                
                if (result.recordset.length === 0) {
                    context.res = { status: 404, headers, body: { error: 'User not found' } };
                } else {
                    const row = result.recordset[0];
                    const clinicIdObjs = parseJsonSafe(row.ClinicIdsJson, []);
                    const clinics = parseJsonSafe(row.ClinicsJson, []);
                    const clinicIds = Array.isArray(clinicIdObjs)
                        ? clinicIdObjs.map((o) => o && o.Id).map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isInteger(n) && n > 0)
                        : [];

                    delete row.ClinicIdsJson;
                    delete row.ClinicsJson;

                    context.res = {
                        status: 200,
                        headers,
                        body: {
                            ...row,
                            ClinicIds: clinicIds,
                            Clinics: Array.isArray(clinics) ? clinics : []
                        }
                    };
                }
            } else {
                // Get all users with all fields
                const result = await pool.request()
                    .query(`SELECT u.Id, u.Username, u.FirstName, u.MiddleName, u.LastName, u.Gender, u.DateOfBirth,
                            u.PersonalEmail, u.WorkEmail, u.HomePhone, u.CellPhone, u.Address, u.City, u.State, u.ZipCode,
                            u.JobTitle, u.StaffType, u.EmployeeType, u.Department, u.EmployeeStatus, u.Role, u.HireDate,
                            u.HourlyRate, u.Salary, u.Color, u.CreatedDate, u.ModifiedDate,
                            ISNULL((SELECT uc.ClinicId AS Id FROM UserClinics uc WHERE uc.UserId = u.Id FOR JSON PATH), '[]') AS ClinicIdsJson,
                            ISNULL((SELECT c.Id AS Id, c.Name AS Name FROM UserClinics uc JOIN Clinics c ON c.Id = uc.ClinicId WHERE uc.UserId = u.Id AND c.IsActive = 1 FOR JSON PATH), '[]') AS ClinicsJson
                            FROM Users u WHERE u.IsActive = 1 ORDER BY u.FirstName`);

                const users = (result.recordset || []).map((row) => {
                    const clinicIdObjs = parseJsonSafe(row.ClinicIdsJson, []);
                    const clinics = parseJsonSafe(row.ClinicsJson, []);
                    const clinicIds = Array.isArray(clinicIdObjs)
                        ? clinicIdObjs.map((o) => o && o.Id).map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isInteger(n) && n > 0)
                        : [];
                    const { ClinicIdsJson, ClinicsJson, ...rest } = row;
                    return {
                        ...rest,
                        ClinicIds: clinicIds,
                        Clinics: Array.isArray(clinics) ? clinics : []
                    };
                });

                context.res = { status: 200, headers, body: users };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const clinicIds = parseClinicIds(body.clinicIds || body.ClinicIds || body.clinicId || body.ClinicId);

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const result = await new sql.Request(transaction)
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

                const userId = result.recordset[0].Id;

                if (clinicIds.length) {
                    for (const clinicId of clinicIds) {
                        await new sql.Request(transaction)
                            .input('userId', sql.Int, userId)
                            .input('clinicId', sql.Int, clinicId)
                            .query('INSERT INTO UserClinics (UserId, ClinicId) VALUES (@userId, @clinicId)');
                    }
                }

                await transaction.commit();
                context.res = { status: 201, headers, body: { id: userId, message: 'User created' } };
            } catch (e) {
                await transaction.rollback();
                throw e;
            }
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            const clinicIds = parseClinicIds(body.clinicIds || body.ClinicIds || body.clinicId || body.ClinicId);
            const shouldUpdateClinics = Object.prototype.hasOwnProperty.call(body || {}, 'clinicIds') ||
                Object.prototype.hasOwnProperty.call(body || {}, 'ClinicIds') ||
                Object.prototype.hasOwnProperty.call(body || {}, 'clinicId') ||
                Object.prototype.hasOwnProperty.call(body || {}, 'ClinicId');

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                await new sql.Request(transaction)
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

                if (shouldUpdateClinics) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Int, id)
                        .query('DELETE FROM UserClinics WHERE UserId = @userId');

                    for (const clinicId of clinicIds) {
                        await new sql.Request(transaction)
                            .input('userId', sql.Int, id)
                            .input('clinicId', sql.Int, clinicId)
                            .query('INSERT INTO UserClinics (UserId, ClinicId) VALUES (@userId, @clinicId)');
                    }
                }

                await transaction.commit();
                context.res = { status: 200, headers, body: { message: 'User updated' } };
            } catch (e) {
                await transaction.rollback();
                throw e;
            }
        } else if (req.method === 'DELETE' && id) {
            // Hard delete - actually remove the user from database
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Users WHERE Id = @id');
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
