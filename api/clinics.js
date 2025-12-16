// Clinics & Rooms API Functions
const { app } = require('@azure/functions');
const { execute } = require('./shared/database');
const { successResponse, errorResponse, handleOptions } = require('./shared/response');

// ============ CLINICS ============

// GET all clinics
app.http('getClinics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'clinics',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const result = await execute(`
                SELECT Id, Name, Address, City, State, ZipCode, Phone, Email, Color, Icon, Description, CreatedDate
                FROM Clinics WHERE IsActive = 1
                ORDER BY Name
            `);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching clinics:', err);
            return errorResponse('Failed to fetch clinics', 500);
        }
    }
});

// GET clinic by ID
app.http('getClinicById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'clinics/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const result = await execute(`
                SELECT Id, Name, Address, City, State, ZipCode, Phone, Email, Color, Icon, Description, CreatedDate
                FROM Clinics WHERE Id = @id AND IsActive = 1
            `, { id });
            
            if (result.recordset.length === 0) {
                return errorResponse('Clinic not found', 404);
            }
            return successResponse(result.recordset[0]);
        } catch (err) {
            context.error('Error fetching clinic:', err);
            return errorResponse('Failed to fetch clinic', 500);
        }
    }
});

// POST create clinic
app.http('createClinic', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'clinics',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Clinics (Name, Address, City, State, ZipCode, Phone, Email, Color, Icon, Description)
                OUTPUT INSERTED.Id
                VALUES (@name, @address, @city, @state, @zipCode, @phone, @email, @color, @icon, @description)
            `, {
                name: body.name,
                address: body.address || null,
                city: body.city || null,
                state: body.state || null,
                zipCode: body.zipCode || null,
                phone: body.phone || null,
                email: body.email || null,
                color: body.color || '#10b981',
                icon: body.icon || 'fa-hospital',
                description: body.description || null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating clinic:', err);
            return errorResponse('Failed to create clinic', 500);
        }
    }
});

// PUT update clinic
app.http('updateClinic', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'clinics/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            await execute(`
                UPDATE Clinics SET
                    Name = @name, Address = @address, City = @city, State = @state, ZipCode = @zipCode,
                    Phone = @phone, Email = @email, Color = @color, Icon = @icon, Description = @description,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                name: body.name,
                address: body.address || null,
                city: body.city || null,
                state: body.state || null,
                zipCode: body.zipCode || null,
                phone: body.phone || null,
                email: body.email || null,
                color: body.color || '#10b981',
                icon: body.icon || 'fa-hospital',
                description: body.description || null
            });
            
            return successResponse({ message: 'Clinic updated successfully' });
        } catch (err) {
            context.error('Error updating clinic:', err);
            return errorResponse('Failed to update clinic', 500);
        }
    }
});

// DELETE clinic (soft delete)
app.http('deleteClinic', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'clinics/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`UPDATE Clinics SET IsActive = 0, ModifiedDate = GETUTCDATE() WHERE Id = @id`, { id });
            return successResponse({ message: 'Clinic deleted successfully' });
        } catch (err) {
            context.error('Error deleting clinic:', err);
            return errorResponse('Failed to delete clinic', 500);
        }
    }
});

// ============ ROOMS ============

// GET all rooms
app.http('getRooms', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'rooms',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const clinicId = request.query.get('clinicId');
            
            let query = `
                SELECT r.Id, r.ClinicId, r.Name, r.RoomType, r.Description, r.Color, r.CreatedDate,
                       c.Name AS ClinicName
                FROM Rooms r
                LEFT JOIN Clinics c ON r.ClinicId = c.Id
                WHERE r.IsActive = 1
            `;
            
            const params = {};
            if (clinicId) {
                query += ' AND r.ClinicId = @clinicId';
                params.clinicId = clinicId;
            }
            
            query += ' ORDER BY c.Name, r.Name';
            
            const result = await execute(query, params);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching rooms:', err);
            return errorResponse('Failed to fetch rooms', 500);
        }
    }
});

// GET room by ID
app.http('getRoomById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'rooms/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const result = await execute(`
                SELECT r.Id, r.ClinicId, r.Name, r.RoomType, r.Description, r.Color, r.CreatedDate,
                       c.Name AS ClinicName
                FROM Rooms r
                LEFT JOIN Clinics c ON r.ClinicId = c.Id
                WHERE r.Id = @id AND r.IsActive = 1
            `, { id });
            
            if (result.recordset.length === 0) {
                return errorResponse('Room not found', 404);
            }
            return successResponse(result.recordset[0]);
        } catch (err) {
            context.error('Error fetching room:', err);
            return errorResponse('Failed to fetch room', 500);
        }
    }
});

// POST create room
app.http('createRoom', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'rooms',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Rooms (ClinicId, Name, RoomType, Description, Color)
                OUTPUT INSERTED.Id
                VALUES (@clinicId, @name, @roomType, @description, @color)
            `, {
                clinicId: body.clinicId,
                name: body.name,
                roomType: body.roomType || 'operatory',
                description: body.description || null,
                color: body.color || '#60a5fa'
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating room:', err);
            return errorResponse('Failed to create room', 500);
        }
    }
});

// PUT update room
app.http('updateRoom', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'rooms/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            await execute(`
                UPDATE Rooms SET
                    ClinicId = @clinicId, Name = @name, RoomType = @roomType,
                    Description = @description, Color = @color,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                clinicId: body.clinicId,
                name: body.name,
                roomType: body.roomType || 'operatory',
                description: body.description || null,
                color: body.color || '#60a5fa'
            });
            
            return successResponse({ message: 'Room updated successfully' });
        } catch (err) {
            context.error('Error updating room:', err);
            return errorResponse('Failed to update room', 500);
        }
    }
});

// DELETE room (soft delete)
app.http('deleteRoom', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'rooms/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`UPDATE Rooms SET IsActive = 0, ModifiedDate = GETUTCDATE() WHERE Id = @id`, { id });
            return successResponse({ message: 'Room deleted successfully' });
        } catch (err) {
            context.error('Error deleting room:', err);
            return errorResponse('Failed to delete room', 500);
        }
    }
});
