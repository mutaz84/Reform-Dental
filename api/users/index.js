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
        const serverMatch = connStr.match(/Server=(?:tcp:)?([^,;]+)/i);
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

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function toNullableString(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
}

function toNullableNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function toNullableDate(value) {
    if (!value) return null;
    return value;
}

function toBooleanBit(value) {
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function toJsonString(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch (_) {
        return null;
    }
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
            const userColumns = await getTableColumns(pool, 'Users');
            if (userColumns.size === 0) {
                context.res = { status: 500, headers, body: { error: 'Users table not found.' } };
                return;
            }

            const userClinicColumns = await getTableColumns(pool, 'UserClinics');
            const clinicColumns = await getTableColumns(pool, 'Clinics');

            const hasUserIsActive = hasColumn(userColumns, 'IsActive');
            const hasUserClinics = userClinicColumns.size > 0 && hasColumn(userClinicColumns, 'UserId') && hasColumn(userClinicColumns, 'ClinicId');
            const hasClinicsForJoin = clinicColumns.size > 0 && hasColumn(clinicColumns, 'Id') && hasColumn(clinicColumns, 'Name');
            const hasClinicIsActive = hasColumn(clinicColumns, 'IsActive');

            const preferredColumns = [
                'Id', 'Username', 'PasswordHash', 'FirstName', 'MiddleName', 'LastName', 'Gender', 'DateOfBirth',
                'PersonalEmail', 'WorkEmail', 'HomePhone', 'CellPhone', 'Address', 'City', 'State', 'ZipCode',
                'JobTitle', 'StaffType', 'EmployeeType', 'Department', 'EmployeeStatus', 'Role', 'HireDate',
                'HourlyRate', 'Salary', 'Color', 'ProfileImage', 'Permissions', 'CreatedDate', 'ModifiedDate',
                'IsActive', 'IsOnline', 'LastSeen', 'RoleId', 'SSN', 'Title', 'EmergencyContactName',
                'EmergencyContactRelationship', 'EmergencyContactPhone', 'EmergencyContactEmail', 'NextReviewDate',
                'OfficeLocation', 'DirectSupervisor', 'SeparationDate', 'SeparationReason', 'PhotoFileName',
                'Documents', 'HRInfo', 'FailedLoginAttempts'
            ].filter((name) => hasColumn(userColumns, name));

            if (!preferredColumns.some((c) => c.toLowerCase() === 'id')) {
                preferredColumns.unshift('Id');
            }

            const baseSelect = preferredColumns.map((c) => `u.${c}`).join(', ');
            const clinicIdsJson = hasUserClinics
                ? `, ISNULL((SELECT uc.ClinicId AS Id FROM UserClinics uc WHERE uc.UserId = u.Id FOR JSON PATH), '[]') AS ClinicIdsJson`
                : `, '[]' AS ClinicIdsJson`;
            const clinicsJson = (hasUserClinics && hasClinicsForJoin)
                ? `, ISNULL((SELECT c.Id AS Id, c.Name AS Name FROM UserClinics uc JOIN Clinics c ON c.Id = uc.ClinicId WHERE uc.UserId = u.Id ${hasClinicIsActive ? 'AND c.IsActive = 1' : ''} FOR JSON PATH), '[]') AS ClinicsJson`
                : `, '[]' AS ClinicsJson`;

            if (id) {
                const where = ['u.Id = @id'];
                if (hasUserIsActive) {
                    where.push('ISNULL(u.IsActive, 1) = 1');
                }

                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT ${baseSelect}${clinicIdsJson}${clinicsJson} FROM Users u WHERE ${where.join(' AND ')}`);

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
                const whereClause = hasUserIsActive ? 'WHERE ISNULL(u.IsActive, 1) = 1' : '';
                const orderBy = hasColumn(userColumns, 'FirstName') ? 'ORDER BY u.FirstName' : 'ORDER BY u.Id';

                const result = await pool.request()
                    .query(`SELECT ${baseSelect}${clinicIdsJson}${clinicsJson} FROM Users u ${whereClause} ${orderBy}`);

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
            const permissionsValue = toJsonString(body.permissions || body.Permissions);
            const documentsValue = toJsonString(body.documents || body.Documents);
            const hrInfoValue = toJsonString(body.hrInfo || body.HRInfo);

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const result = await new sql.Request(transaction)
                    .input('username', sql.NVarChar, body.username)
                    .input('passwordHash', sql.NVarChar, body.password || 'changeme')
                    .input('firstName', sql.NVarChar, toNullableString(body.firstName || body.FirstName))
                    .input('middleName', sql.NVarChar, toNullableString(body.middleName || body.MiddleName))
                    .input('lastName', sql.NVarChar, toNullableString(body.lastName || body.LastName))
                    .input('gender', sql.NVarChar, toNullableString(body.gender || body.Gender))
                    .input('dateOfBirth', sql.Date, toNullableDate(body.dateOfBirth || body.DateOfBirth))
                    .input('personalEmail', sql.NVarChar, toNullableString(body.personalEmail || body.PersonalEmail))
                    .input('workEmail', sql.NVarChar, toNullableString(body.workEmail || body.WorkEmail))
                    .input('homePhone', sql.NVarChar, toNullableString(body.homePhone || body.HomePhone))
                    .input('cellPhone', sql.NVarChar, toNullableString(body.cellPhone || body.CellPhone))
                    .input('address', sql.NVarChar, toNullableString(body.address || body.Address))
                    .input('city', sql.NVarChar, toNullableString(body.city || body.City))
                    .input('state', sql.NVarChar, toNullableString(body.state || body.State))
                    .input('zipCode', sql.NVarChar, toNullableString(body.zipCode || body.ZipCode))
                    .input('jobTitle', sql.NVarChar, toNullableString(body.jobTitle || body.JobTitle))
                    .input('staffType', sql.NVarChar, body.staffType || 'non-clinical')
                    .input('employeeType', sql.NVarChar, body.employeeType || 'full-time')
                    .input('department', sql.NVarChar, toNullableString(body.department || body.Department))
                    .input('employeeStatus', sql.NVarChar, body.employeeStatus || 'active')
                    .input('role', sql.NVarChar, body.role || 'user')
                    .input('hireDate', sql.Date, toNullableDate(body.hireDate || body.HireDate))
                    .input('hourlyRate', sql.Decimal(10,2), toNullableNumber(body.hourlyRate || body.HourlyRate))
                    .input('salary', sql.Decimal(12,2), toNullableNumber(body.salary || body.Salary))
                    .input('color', sql.NVarChar, body.color || '#3b82f6')
                    .input('profileImage', sql.NVarChar(sql.MAX), toNullableString(body.profileImage || body.ProfileImage || body.photoData || body.PhotoData))
                    .input('permissions', sql.NVarChar(sql.MAX), permissionsValue)
                    .input('ssn', sql.NVarChar, toNullableString(body.ssn || body.SSN))
                    .input('title', sql.NVarChar, toNullableString(body.title || body.Title))
                    .input('emergencyContactName', sql.NVarChar, toNullableString(body.emergencyContactName || body.EmergencyContactName))
                    .input('emergencyContactRelationship', sql.NVarChar, toNullableString(body.emergencyContactRelationship || body.EmergencyContactRelationship))
                    .input('emergencyContactPhone', sql.NVarChar, toNullableString(body.emergencyContactPhone || body.EmergencyContactPhone))
                    .input('emergencyContactEmail', sql.NVarChar, toNullableString(body.emergencyContactEmail || body.EmergencyContactEmail))
                    .input('nextReviewDate', sql.Date, toNullableDate(body.nextReviewDate || body.NextReviewDate))
                    .input('officeLocation', sql.NVarChar, toNullableString(body.officeLocation || body.OfficeLocation))
                    .input('directSupervisor', sql.NVarChar, toNullableString(body.directSupervisor || body.DirectSupervisor))
                    .input('separationDate', sql.Date, toNullableDate(body.separationDate || body.SeparationDate))
                    .input('separationReason', sql.NVarChar, toNullableString(body.separationReason || body.SeparationReason))
                    .input('photoFileName', sql.NVarChar, toNullableString(body.photoFileName || body.PhotoFileName))
                    .input('documents', sql.NVarChar(sql.MAX), documentsValue)
                    .input('hrInfo', sql.NVarChar(sql.MAX), hrInfoValue)
                    .input('failedLoginAttempts', sql.Int, toNullableNumber(body.failedLoginAttempts || body.FailedLoginAttempts) ?? 0)
                    .input('isOnline', sql.Bit, toBooleanBit(body.isOnline || body.IsOnline))
                    .input('lastSeen', sql.DateTime2, body.lastSeen || body.LastSeen || null)
                    .input('roleId', sql.Int, toNullableNumber(body.roleId || body.RoleId))
                    .query(`INSERT INTO Users (Username, PasswordHash, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                            PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                            JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role, HireDate,
                            HourlyRate, Salary, Color, ProfileImage, Permissions, SSN, Title,
                            EmergencyContactName, EmergencyContactRelationship, EmergencyContactPhone,
                            EmergencyContactEmail, NextReviewDate, OfficeLocation, DirectSupervisor,
                            SeparationDate, SeparationReason, PhotoFileName, Documents, HRInfo,
                            FailedLoginAttempts, IsOnline, LastSeen, RoleId)
                            OUTPUT INSERTED.Id
                            VALUES (@username, @passwordHash, @firstName, @middleName, @lastName, @gender, @dateOfBirth,
                            @personalEmail, @workEmail, @homePhone, @cellPhone, @address, @city, @state, @zipCode,
                            @jobTitle, @staffType, @employeeType, @department, @employeeStatus, @role, @hireDate,
                            @hourlyRate, @salary, @color, @profileImage, @permissions, @ssn, @title,
                            @emergencyContactName, @emergencyContactRelationship, @emergencyContactPhone,
                            @emergencyContactEmail, @nextReviewDate, @officeLocation, @directSupervisor,
                            @separationDate, @separationReason, @photoFileName, @documents, @hrInfo,
                            @failedLoginAttempts, @isOnline, @lastSeen, @roleId)`);

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
            const permissionsValue = toJsonString(body.permissions || body.Permissions);
            const documentsValue = toJsonString(body.documents || body.Documents);
            const hrInfoValue = toJsonString(body.hrInfo || body.HRInfo);
            const shouldUpdateClinics = Object.prototype.hasOwnProperty.call(body || {}, 'clinicIds') ||
                Object.prototype.hasOwnProperty.call(body || {}, 'ClinicIds') ||
                Object.prototype.hasOwnProperty.call(body || {}, 'clinicId') ||
                Object.prototype.hasOwnProperty.call(body || {}, 'ClinicId');

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const updateResult = await new sql.Request(transaction)
                    .input('id', sql.Int, id)
                    .input('username', sql.NVarChar, toNullableString(body.username || body.Username))
                    .input('firstName', sql.NVarChar, toNullableString(body.firstName || body.FirstName))
                    .input('middleName', sql.NVarChar, toNullableString(body.middleName || body.MiddleName))
                    .input('lastName', sql.NVarChar, toNullableString(body.lastName || body.LastName))
                    .input('gender', sql.NVarChar, toNullableString(body.gender || body.Gender))
                    .input('dateOfBirth', sql.Date, toNullableDate(body.dateOfBirth || body.DateOfBirth))
                    .input('personalEmail', sql.NVarChar, toNullableString(body.personalEmail || body.PersonalEmail))
                    .input('workEmail', sql.NVarChar, toNullableString(body.workEmail || body.WorkEmail))
                    .input('homePhone', sql.NVarChar, toNullableString(body.homePhone || body.HomePhone))
                    .input('cellPhone', sql.NVarChar, toNullableString(body.cellPhone || body.CellPhone))
                    .input('address', sql.NVarChar, toNullableString(body.address || body.Address))
                    .input('city', sql.NVarChar, toNullableString(body.city || body.City))
                    .input('state', sql.NVarChar, toNullableString(body.state || body.State))
                    .input('zipCode', sql.NVarChar, toNullableString(body.zipCode || body.ZipCode))
                    .input('jobTitle', sql.NVarChar, toNullableString(body.jobTitle || body.JobTitle))
                    .input('staffType', sql.NVarChar, toNullableString(body.staffType || body.StaffType))
                    .input('employeeType', sql.NVarChar, toNullableString(body.employeeType || body.EmployeeType))
                    .input('department', sql.NVarChar, toNullableString(body.department || body.Department))
                    .input('employeeStatus', sql.NVarChar, toNullableString(body.employeeStatus || body.EmployeeStatus))
                    .input('role', sql.NVarChar, toNullableString(body.role || body.Role))
                    .input('hireDate', sql.Date, toNullableDate(body.hireDate || body.HireDate))
                    .input('hourlyRate', sql.Decimal(10,2), toNullableNumber(body.hourlyRate || body.HourlyRate))
                    .input('salary', sql.Decimal(12,2), toNullableNumber(body.salary || body.Salary))
                    .input('color', sql.NVarChar, toNullableString(body.color || body.Color))
                    .input('profileImage', sql.NVarChar(sql.MAX), toNullableString(body.profileImage || body.ProfileImage || body.photoData || body.PhotoData))
                    .input('permissions', sql.NVarChar(sql.MAX), permissionsValue)
                    .input('ssn', sql.NVarChar, toNullableString(body.ssn || body.SSN))
                    .input('title', sql.NVarChar, toNullableString(body.title || body.Title))
                    .input('emergencyContactName', sql.NVarChar, toNullableString(body.emergencyContactName || body.EmergencyContactName))
                    .input('emergencyContactRelationship', sql.NVarChar, toNullableString(body.emergencyContactRelationship || body.EmergencyContactRelationship))
                    .input('emergencyContactPhone', sql.NVarChar, toNullableString(body.emergencyContactPhone || body.EmergencyContactPhone))
                    .input('emergencyContactEmail', sql.NVarChar, toNullableString(body.emergencyContactEmail || body.EmergencyContactEmail))
                    .input('nextReviewDate', sql.Date, toNullableDate(body.nextReviewDate || body.NextReviewDate))
                    .input('officeLocation', sql.NVarChar, toNullableString(body.officeLocation || body.OfficeLocation))
                    .input('directSupervisor', sql.NVarChar, toNullableString(body.directSupervisor || body.DirectSupervisor))
                    .input('separationDate', sql.Date, toNullableDate(body.separationDate || body.SeparationDate))
                    .input('separationReason', sql.NVarChar, toNullableString(body.separationReason || body.SeparationReason))
                    .input('photoFileName', sql.NVarChar, toNullableString(body.photoFileName || body.PhotoFileName))
                    .input('documents', sql.NVarChar(sql.MAX), documentsValue)
                    .input('hrInfo', sql.NVarChar(sql.MAX), hrInfoValue)
                    .input('failedLoginAttempts', sql.Int, toNullableNumber(body.failedLoginAttempts || body.FailedLoginAttempts) ?? 0)
                    .input('isOnline', sql.Bit, toBooleanBit(body.isOnline || body.IsOnline))
                    .input('lastSeen', sql.DateTime2, body.lastSeen || body.LastSeen || null)
                    .input('roleId', sql.Int, toNullableNumber(body.roleId || body.RoleId))
                    .query(`UPDATE Users SET FirstName=@firstName, MiddleName=@middleName, LastName=@lastName, 
                            Username = COALESCE(@username, Username),
                            Gender=@gender, DateOfBirth=@dateOfBirth, PersonalEmail=@personalEmail, WorkEmail=@workEmail,
                            HomePhone=@homePhone, CellPhone=@cellPhone, Address=@address, City=@city, State=@state, ZipCode=@zipCode,
                            JobTitle=@jobTitle, StaffType=@staffType, EmployeeType=@employeeType, Department=@department,
                            EmployeeStatus=@employeeStatus, Role=@role, HireDate=@hireDate, HourlyRate=@hourlyRate, Salary=@salary,
                            Color=@color, ProfileImage=@profileImage, Permissions=@permissions,
                            SSN=@ssn, Title=@title, EmergencyContactName=@emergencyContactName,
                            EmergencyContactRelationship=@emergencyContactRelationship,
                            EmergencyContactPhone=@emergencyContactPhone, EmergencyContactEmail=@emergencyContactEmail,
                            NextReviewDate=@nextReviewDate, OfficeLocation=@officeLocation,
                            DirectSupervisor=@directSupervisor, SeparationDate=@separationDate,
                            SeparationReason=@separationReason, PhotoFileName=@photoFileName,
                            Documents=@documents, HRInfo=@hrInfo, FailedLoginAttempts=@failedLoginAttempts,
                            IsOnline=@isOnline, LastSeen=@lastSeen, RoleId=@roleId,
                            ModifiedDate=GETUTCDATE() WHERE Id=@id`);

                const affectedRows = Array.isArray(updateResult.rowsAffected)
                    ? updateResult.rowsAffected.reduce((sum, n) => sum + Number(n || 0), 0)
                    : 0;
                if (affectedRows === 0) {
                    await transaction.rollback();
                    context.res = { status: 404, headers, body: { error: 'User not found or not updated' } };
                    await pool.close();
                    return;
                }

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
