// Schedules API Functions
const { app } = require('@azure/functions');
const { execute } = require('./shared/database');
const { successResponse, errorResponse, handleOptions } = require('./shared/response');

// GET all schedules
app.http('getSchedules', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'schedules',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const userId = request.query.get('userId');
            const clinicId = request.query.get('clinicId');
            const startDate = request.query.get('startDate');
            const endDate = request.query.get('endDate');
            
            let query = `
                SELECT s.Id, s.UserId, s.ClinicId, s.RoomId, s.AssistantId,
                       s.StartDate, s.EndDate, s.StartTime, s.EndTime, s.DaysOfWeek,
                       s.Color, s.Notes, s.CreatedDate,
                       u.FirstName + ' ' + ISNULL(u.LastName, '') AS ProviderName,
                       u.JobTitle AS ProviderRole,
                       c.Name AS ClinicName,
                       r.Name AS RoomName,
                       a.FirstName + ' ' + ISNULL(a.LastName, '') AS AssistantName
                FROM Schedules s
                LEFT JOIN Users u ON s.UserId = u.Id
                LEFT JOIN Clinics c ON s.ClinicId = c.Id
                LEFT JOIN Rooms r ON s.RoomId = r.Id
                LEFT JOIN Users a ON s.AssistantId = a.Id
                WHERE s.IsActive = 1
            `;
            
            const params = {};
            
            if (userId) {
                query += ' AND s.UserId = @userId';
                params.userId = userId;
            }
            if (clinicId) {
                query += ' AND s.ClinicId = @clinicId';
                params.clinicId = clinicId;
            }
            if (startDate) {
                query += ' AND s.EndDate >= @startDate';
                params.startDate = startDate;
            }
            if (endDate) {
                query += ' AND s.StartDate <= @endDate';
                params.endDate = endDate;
            }
            
            query += ' ORDER BY s.StartDate, s.StartTime';
            
            const result = await execute(query, params);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching schedules:', err);
            return errorResponse('Failed to fetch schedules', 500);
        }
    }
});

// GET schedule by ID
app.http('getScheduleById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'schedules/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const result = await execute(`
                SELECT s.Id, s.UserId, s.ClinicId, s.RoomId, s.AssistantId,
                       s.StartDate, s.EndDate, s.StartTime, s.EndTime, s.DaysOfWeek,
                       s.Color, s.Notes, s.CreatedDate,
                       u.FirstName + ' ' + ISNULL(u.LastName, '') AS ProviderName,
                       c.Name AS ClinicName,
                       r.Name AS RoomName,
                       a.FirstName + ' ' + ISNULL(a.LastName, '') AS AssistantName
                FROM Schedules s
                LEFT JOIN Users u ON s.UserId = u.Id
                LEFT JOIN Clinics c ON s.ClinicId = c.Id
                LEFT JOIN Rooms r ON s.RoomId = r.Id
                LEFT JOIN Users a ON s.AssistantId = a.Id
                WHERE s.Id = @id AND s.IsActive = 1
            `, { id });
            
            if (result.recordset.length === 0) {
                return errorResponse('Schedule not found', 404);
            }
            return successResponse(result.recordset[0]);
        } catch (err) {
            context.error('Error fetching schedule:', err);
            return errorResponse('Failed to fetch schedule', 500);
        }
    }
});

// POST create schedule
app.http('createSchedule', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'schedules',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes)
                OUTPUT INSERTED.Id
                VALUES (@userId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)
            `, {
                userId: body.userId,
                clinicId: body.clinicId,
                roomId: body.roomId || null,
                assistantId: body.assistantId || null,
                startDate: body.startDate,
                endDate: body.endDate || null,
                startTime: body.startTime,
                endTime: body.endTime,
                daysOfWeek: body.daysOfWeek || 'Mon,Tue,Wed,Thu,Fri',
                color: body.color || '#10b981',
                notes: body.notes || null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating schedule:', err);
            return errorResponse('Failed to create schedule', 500);
        }
    }
});

// PUT update schedule
app.http('updateSchedule', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'schedules/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            await execute(`
                UPDATE Schedules SET
                    UserId = @userId, ClinicId = @clinicId, RoomId = @roomId, AssistantId = @assistantId,
                    StartDate = @startDate, EndDate = @endDate, StartTime = @startTime, EndTime = @endTime,
                    DaysOfWeek = @daysOfWeek, Color = @color, Notes = @notes,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                userId: body.userId,
                clinicId: body.clinicId,
                roomId: body.roomId || null,
                assistantId: body.assistantId || null,
                startDate: body.startDate,
                endDate: body.endDate || null,
                startTime: body.startTime,
                endTime: body.endTime,
                daysOfWeek: body.daysOfWeek || 'Mon,Tue,Wed,Thu,Fri',
                color: body.color || '#10b981',
                notes: body.notes || null
            });
            
            return successResponse({ message: 'Schedule updated successfully' });
        } catch (err) {
            context.error('Error updating schedule:', err);
            return errorResponse('Failed to update schedule', 500);
        }
    }
});

// DELETE schedule (soft delete)
app.http('deleteSchedule', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'schedules/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`UPDATE Schedules SET IsActive = 0, ModifiedDate = GETUTCDATE() WHERE Id = @id`, { id });
            return successResponse({ message: 'Schedule deleted successfully' });
        } catch (err) {
            context.error('Error deleting schedule:', err);
            return errorResponse('Failed to delete schedule', 500);
        }
    }
});
