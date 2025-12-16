// Users API Functions
const { app } = require('@azure/functions');
const { execute } = require('../shared/database');
const { successResponse, errorResponse, handleOptions } = require('../shared/response');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
                       CreatedDate, ModifiedDate
                FROM Users WHERE IsActive = 1
                ORDER BY FirstName, LastName
            `);
            return successResponse(result.recordset);
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
                       CreatedDate, ModifiedDate
                FROM Users WHERE Id = @id AND IsActive = 1
            `, { id });
            
            if (result.recordset.length === 0) {
                return errorResponse('User not found', 404);
            }
            return successResponse(result.recordset[0]);
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
            
            const result = await execute(`
                INSERT INTO Users (Username, PasswordHash, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                    PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                    JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role,
                    HireDate, HourlyRate, Salary, Color, ProfileImage, Permissions)
                OUTPUT INSERTED.Id
                VALUES (@username, @passwordHash, @firstName, @middleName, @lastName, @gender, @dateOfBirth,
                    @personalEmail, @workEmail, @homePhone, @cellPhone, @address, @city, @state, @zipCode,
                    @jobTitle, @staffType, @employeeType, @department, @employeeStatus, @role,
                    @hireDate, @hourlyRate, @salary, @color, @profileImage, @permissions)
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
                permissions: body.permissions ? JSON.stringify(body.permissions) : null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
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
                permissions: body.permissions ? JSON.stringify(body.permissions) : null
            });
            
            return successResponse({ message: 'User updated successfully' });
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
