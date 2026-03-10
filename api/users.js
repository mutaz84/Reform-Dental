// Users API Functions
const { app } = require('@azure/functions');
const { execute } = require('./shared/database');
const { successResponse, errorResponse, handleOptions } = require('./shared/response');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function safeParseJsonObject(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function toBit(value) {
    if (value === true || value === 1) return 1;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' ? 1 : 0;
}

function getHrInfoObjectFromBody(body) {
    if (!body) return {};
    const candidate = body.hrInfo ?? body.HRInfo;
    if (candidate == null) return {};
    if (typeof candidate === 'object') return candidate;
    if (typeof candidate === 'string') return safeParseJsonObject(candidate) || {};
    return {};
}

function getBenefitsFromHrInfo(hrInfoObj) {
    const result = {};
    const raw = hrInfoObj && typeof hrInfoObj === 'object' ? hrInfoObj.benefits : null;
    if (!raw || typeof raw !== 'object') return result;
    Object.entries(raw).forEach(([key, value]) => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) return;
        result[normalizedKey] = toBit(value);
    });
    return result;
}

function humanizeBenefitKey(key) {
    return String(key || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

async function attachBenefitsToUsers(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const userIds = rows
        .map((r) => Number(r?.Id || 0))
        .filter((id) => Number.isInteger(id) && id > 0);
    if (!userIds.length) return rows;

    const inList = Array.from(new Set(userIds)).join(',');
    const benefitsResult = await execute(`
        SELECT uhr.UserId, b.BenefitKey, b.IsEnabled
        FROM UserHRBenefits b
        JOIN UserHRInfo uhr ON uhr.Id = b.UserHRInfoId
        WHERE uhr.UserId IN (${inList})
    `);

    const benefitsByUserId = new Map();
    (benefitsResult.recordset || []).forEach((row) => {
        const userId = Number(row?.UserId || 0);
        const key = String(row?.BenefitKey || '').trim();
        if (!(userId > 0) || !key) return;
        if (!benefitsByUserId.has(userId)) benefitsByUserId.set(userId, {});
        benefitsByUserId.get(userId)[key] = !!row?.IsEnabled;
    });

    rows.forEach((row) => {
        const userId = Number(row?.Id || 0);
        const hrInfo = safeParseJsonObject(row?.HRInfo) || {};
        const tableBenefits = benefitsByUserId.get(userId) || null;
        if (tableBenefits) {
            hrInfo.benefits = {
                ...(hrInfo.benefits && typeof hrInfo.benefits === 'object' ? hrInfo.benefits : {}),
                ...tableBenefits
            };
        }
        row.HRInfo = hrInfo;
    });

    return rows;
}

async function upsertUserHrInfoAndBenefits(userId, body) {
    if (!body || (body.hrInfo === undefined && body.HRInfo === undefined)) return;

    const hrInfoObj = getHrInfoObjectFromBody(body);
    const hrData = JSON.stringify(hrInfoObj || {});

    await execute(`
        MERGE UserHRInfo AS target
        USING (SELECT @userId AS UserId, @hrData AS HRDataJson) AS source
        ON target.UserId = source.UserId
        WHEN MATCHED THEN
            UPDATE SET HRDataJson = source.HRDataJson, LastUpdated = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (UserId, HRDataJson, LastUpdated, CreatedAt, UpdatedAt)
            VALUES (source.UserId, source.HRDataJson, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME());
    `, {
        userId: Number(userId),
        hrData
    });

    const hrInfoIdResult = await execute('SELECT TOP 1 Id FROM UserHRInfo WHERE UserId = @userId', { userId: Number(userId) });
    const userHrInfoId = Number(hrInfoIdResult.recordset?.[0]?.Id || 0);
    if (!(userHrInfoId > 0)) return;

    await execute('DELETE FROM UserHRBenefits WHERE UserHRInfoId = @userHrInfoId', { userHrInfoId });

    const benefits = getBenefitsFromHrInfo(hrInfoObj);
    for (const [benefitKey, bitValue] of Object.entries(benefits)) {
        await execute(`
            INSERT INTO UserHRBenefits (UserHRInfoId, BenefitKey, BenefitName, IsEnabled, UpdatedAt, CreatedAt)
            VALUES (@userHrInfoId, @benefitKey, @benefitName, @isEnabled, SYSUTCDATETIME(), SYSUTCDATETIME())
        `, {
            userHrInfoId,
            benefitKey,
            benefitName: humanizeBenefitKey(benefitKey),
            isEnabled: bitValue
        });
    }
}

// GET all users
app.http('getUsers', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const result = await execute(`
                SELECT Id, Username, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                       PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                       JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role,
                       HireDate, HourlyRate, Salary, Color, ProfileImage, Permissions,
                       CreatedDate, ModifiedDate, SSN, Title, EmergencyContactName,
                       EmergencyContactRelationship, EmergencyContactPhone, EmergencyContactEmail,
                       NextReviewDate, OfficeLocation, DirectSupervisor, SeparationDate,
                      SeparationReason, PhotoFileName, Documents, uhr.HRDataJson AS HRInfo, FailedLoginAttempts,
                       IsOnline, LastSeen, RoleId
                FROM Users u
                LEFT JOIN UserHRInfo uhr ON uhr.UserId = u.Id
                WHERE ISNULL(u.IsActive, 1) = 1
                ORDER BY FirstName, LastName
            `);
            const users = await attachBenefitsToUsers(result.recordset || []);
            return successResponse(users);
        } catch (err) {
            context.error('Error fetching users:', err);
            return errorResponse('Failed to fetch users', 500);
        }
    }
});

// GET single user by ID
app.http('getUserById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const result = await execute(`
                SELECT Id, Username, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                       PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                       JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role,
                       HireDate, HourlyRate, Salary, Color, ProfileImage, Permissions,
                       CreatedDate, ModifiedDate, SSN, Title, EmergencyContactName,
                       EmergencyContactRelationship, EmergencyContactPhone, EmergencyContactEmail,
                       NextReviewDate, OfficeLocation, DirectSupervisor, SeparationDate,
                      SeparationReason, PhotoFileName, Documents, uhr.HRDataJson AS HRInfo, FailedLoginAttempts,
                       IsOnline, LastSeen, RoleId
                FROM Users u
                LEFT JOIN UserHRInfo uhr ON uhr.UserId = u.Id
                WHERE u.Id = @id AND ISNULL(u.IsActive, 1) = 1
            `, { id });
            
            if (result.recordset.length === 0) {
                return errorResponse('User not found', 404);
            }
            const users = await attachBenefitsToUsers([result.recordset[0]]);
            return successResponse(users[0]);
        } catch (err) {
            context.error('Error fetching user:', err);
            return errorResponse('Failed to fetch user', 500);
        }
    }
});

// POST create new user
app.http('createUser', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            // Hash password
            const passwordHash = await bcrypt.hash(body.password || 'changeme123', 10);
            const permissionsValue = body.permissions == null
                ? null
                : (typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions));
            const documentsValue = body.documents == null
                ? null
                : (typeof body.documents === 'string' ? body.documents : JSON.stringify(body.documents));
            
            const result = await execute(`
                INSERT INTO Users (Username, PasswordHash, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                    PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                    JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role,
                    HireDate, HourlyRate, Salary, Color, ProfileImage, Permissions,
                    SSN, Title, EmergencyContactName, EmergencyContactRelationship,
                    EmergencyContactPhone, EmergencyContactEmail, NextReviewDate, OfficeLocation,
                    DirectSupervisor, SeparationDate, SeparationReason, PhotoFileName, Documents,
                    FailedLoginAttempts, IsOnline, LastSeen, RoleId)
                OUTPUT INSERTED.Id
                VALUES (@username, @passwordHash, @firstName, @middleName, @lastName, @gender, @dateOfBirth,
                    @personalEmail, @workEmail, @homePhone, @cellPhone, @address, @city, @state, @zipCode,
                    @jobTitle, @staffType, @employeeType, @department, @employeeStatus, @role,
                    @hireDate, @hourlyRate, @salary, @color, @profileImage, @permissions,
                    @ssn, @title, @emergencyContactName, @emergencyContactRelationship,
                    @emergencyContactPhone, @emergencyContactEmail, @nextReviewDate, @officeLocation,
                        @directSupervisor, @separationDate, @separationReason, @photoFileName, @documents,
                    @failedLoginAttempts, @isOnline, @lastSeen, @roleId)
            `, {
                username: body.username,
                passwordHash: passwordHash,
                firstName: body.firstName || null,
                middleName: body.middleName || null,
                lastName: body.lastName || null,
                gender: body.gender || null,
                dateOfBirth: body.dateOfBirth || null,
                personalEmail: body.personalEmail || null,
                workEmail: body.workEmail || null,
                homePhone: body.homePhone || null,
                cellPhone: body.cellPhone || null,
                address: body.address || null,
                city: body.city || null,
                state: body.state || null,
                zipCode: body.zipCode || null,
                jobTitle: body.jobTitle || null,
                staffType: body.staffType || 'non-clinical',
                employeeType: body.employeeType || 'full-time',
                department: body.department || null,
                employeeStatus: body.employeeStatus || 'active',
                role: body.role || 'user',
                hireDate: body.hireDate || null,
                hourlyRate: body.hourlyRate || null,
                salary: body.salary || null,
                color: body.color || '#10b981',
                profileImage: body.profileImage || null,
                permissions: permissionsValue,
                ssn: body.ssn || body.SSN || null,
                title: body.title || body.Title || null,
                emergencyContactName: body.emergencyContactName || body.EmergencyContactName || null,
                emergencyContactRelationship: body.emergencyContactRelationship || body.EmergencyContactRelationship || null,
                emergencyContactPhone: body.emergencyContactPhone || body.EmergencyContactPhone || null,
                emergencyContactEmail: body.emergencyContactEmail || body.EmergencyContactEmail || null,
                nextReviewDate: body.nextReviewDate || body.NextReviewDate || null,
                officeLocation: body.officeLocation || body.OfficeLocation || null,
                directSupervisor: body.directSupervisor || body.DirectSupervisor || null,
                separationDate: body.separationDate || body.SeparationDate || null,
                separationReason: body.separationReason || body.SeparationReason || null,
                photoFileName: body.photoFileName || body.PhotoFileName || null,
                documents: documentsValue,
                failedLoginAttempts: body.failedLoginAttempts ?? body.FailedLoginAttempts ?? 0,
                isOnline: body.isOnline === true || body.IsOnline === true,
                lastSeen: body.lastSeen || body.LastSeen || null,
                roleId: body.roleId || body.RoleId || null
            });

            const createdUserId = result.recordset[0].Id;
            await upsertUserHrInfoAndBenefits(createdUserId, body);
            
            return successResponse({ id: createdUserId }, 201);
        } catch (err) {
            context.error('Error creating user:', err);
            if (err.message.includes('UNIQUE')) {
                return errorResponse('Username already exists', 400);
            }
            return errorResponse('Failed to create user', 500);
        }
    }
});

// PUT update user
app.http('updateUser', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();

            if (body && (body.hrInfoOnly === true || body.HRInfoOnly === true)) {
                await upsertUserHrInfoAndBenefits(Number(id), body);

                const updatedHr = await execute(`
                    SELECT u.Id, u.Username, uhr.HRDataJson AS HRInfo, u.ModifiedDate
                    FROM Users u
                    LEFT JOIN UserHRInfo uhr ON uhr.UserId = u.Id
                    WHERE u.Id = @id
                `, { id });

                const hydratedHr = await attachBenefitsToUsers(updatedHr.recordset || []);
                return successResponse({ message: 'HR info updated', user: hydratedHr[0] || { Id: Number(id) } });
            }

            const permissionsValue = body.permissions == null
                ? null
                : (typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions));
            const documentsValue = body.documents == null
                ? null
                : (typeof body.documents === 'string' ? body.documents : JSON.stringify(body.documents));
            
            await execute(`
                UPDATE Users SET
                    FirstName = @firstName, MiddleName = @middleName, LastName = @lastName,
                    Gender = @gender, DateOfBirth = @dateOfBirth,
                    PersonalEmail = @personalEmail, WorkEmail = @workEmail,
                    HomePhone = @homePhone, CellPhone = @cellPhone,
                    Address = @address, City = @city, State = @state, ZipCode = @zipCode,
                    JobTitle = @jobTitle, StaffType = @staffType, EmployeeType = @employeeType,
                    Department = @department, EmployeeStatus = @employeeStatus, Role = @role,
                    HireDate = @hireDate, HourlyRate = @hourlyRate, Salary = @salary,
                    Color = @color, ProfileImage = @profileImage, Permissions = @permissions,
                    SSN = @ssn, Title = @title, EmergencyContactName = @emergencyContactName,
                    EmergencyContactRelationship = @emergencyContactRelationship,
                    EmergencyContactPhone = @emergencyContactPhone,
                    EmergencyContactEmail = @emergencyContactEmail, NextReviewDate = @nextReviewDate,
                    OfficeLocation = @officeLocation, DirectSupervisor = @directSupervisor,
                    SeparationDate = @separationDate, SeparationReason = @separationReason,
                    PhotoFileName = @photoFileName, Documents = @documents,
                    FailedLoginAttempts = @failedLoginAttempts, IsOnline = @isOnline,
                    LastSeen = @lastSeen, RoleId = @roleId,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                firstName: body.firstName || null,
                middleName: body.middleName || null,
                lastName: body.lastName || null,
                gender: body.gender || null,
                dateOfBirth: body.dateOfBirth || null,
                personalEmail: body.personalEmail || null,
                workEmail: body.workEmail || null,
                homePhone: body.homePhone || null,
                cellPhone: body.cellPhone || null,
                address: body.address || null,
                city: body.city || null,
                state: body.state || null,
                zipCode: body.zipCode || null,
                jobTitle: body.jobTitle || null,
                staffType: body.staffType || 'non-clinical',
                employeeType: body.employeeType || 'full-time',
                department: body.department || null,
                employeeStatus: body.employeeStatus || 'active',
                role: body.role || 'user',
                hireDate: body.hireDate || null,
                hourlyRate: body.hourlyRate || null,
                salary: body.salary || null,
                color: body.color || '#10b981',
                profileImage: body.profileImage || null,
                permissions: permissionsValue,
                ssn: body.ssn || body.SSN || null,
                title: body.title || body.Title || null,
                emergencyContactName: body.emergencyContactName || body.EmergencyContactName || null,
                emergencyContactRelationship: body.emergencyContactRelationship || body.EmergencyContactRelationship || null,
                emergencyContactPhone: body.emergencyContactPhone || body.EmergencyContactPhone || null,
                emergencyContactEmail: body.emergencyContactEmail || body.EmergencyContactEmail || null,
                nextReviewDate: body.nextReviewDate || body.NextReviewDate || null,
                officeLocation: body.officeLocation || body.OfficeLocation || null,
                directSupervisor: body.directSupervisor || body.DirectSupervisor || null,
                separationDate: body.separationDate || body.SeparationDate || null,
                separationReason: body.separationReason || body.SeparationReason || null,
                photoFileName: body.photoFileName || body.PhotoFileName || null,
                documents: documentsValue,
                failedLoginAttempts: body.failedLoginAttempts ?? body.FailedLoginAttempts ?? 0,
                isOnline: body.isOnline === true || body.IsOnline === true,
                lastSeen: body.lastSeen || body.LastSeen || null,
                roleId: body.roleId || body.RoleId || null
            });

            await upsertUserHrInfoAndBenefits(Number(id), body);

            const updated = await execute(`
                SELECT u.Id, u.Username, uhr.HRDataJson AS HRInfo, u.ModifiedDate
                FROM Users u
                LEFT JOIN UserHRInfo uhr ON uhr.UserId = u.Id
                WHERE u.Id = @id
            `, { id });

            const hydrated = await attachBenefitsToUsers(updated.recordset || []);
            return successResponse({ message: 'User updated successfully', user: hydrated[0] || { Id: Number(id) } });
        } catch (err) {
            context.error('Error updating user:', err);
            return errorResponse('Failed to update user', 500);
        }
    }
});

// DELETE user (soft delete)
app.http('deleteUser', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'users/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`UPDATE Users SET IsActive = 0, ModifiedDate = GETUTCDATE() WHERE Id = @id`, { id });
            return successResponse({ message: 'User deleted successfully' });
        } catch (err) {
            context.error('Error deleting user:', err);
            return errorResponse('Failed to delete user', 500);
        }
    }
});

// POST login
app.http('login', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/login',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const { username, password } = await request.json();
            
            const result = await execute(`
                SELECT Id, Username, PasswordHash, FirstName, LastName, Role, StaffType, Color, Permissions
                FROM Users WHERE Username = @username AND IsActive = 1
            `, { username });
            
            if (result.recordset.length === 0) {
                return errorResponse('Invalid credentials', 401);
            }
            
            const user = result.recordset[0];
            
            // For demo purposes, allow plain text password comparison
            // In production, always use bcrypt
            const isValid = await bcrypt.compare(password, user.PasswordHash) || password === user.PasswordHash;
            
            if (!isValid) {
                return errorResponse('Invalid credentials', 401);
            }
            
            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.Id, 
                    username: user.Username, 
                    role: user.Role 
                },
                process.env.JWT_SECRET || 'default-secret',
                { expiresIn: '24h' }
            );
            
            return successResponse({
                token,
                user: {
                    id: user.Id,
                    username: user.Username,
                    firstName: user.FirstName,
                    lastName: user.LastName,
                    role: user.Role,
                    staffType: user.StaffType,
                    color: user.Color,
                    permissions: user.Permissions ? JSON.parse(user.Permissions) : null
                }
            });
        } catch (err) {
            context.error('Error during login:', err);
            return errorResponse('Login failed', 500);
        }
    }
});
