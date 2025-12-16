// Tasks API Functions
const { app } = require('@azure/functions');
const { execute } = require('../shared/database');
const { successResponse, errorResponse, handleOptions } = require('../shared/response');

// GET all tasks
app.http('getTasks', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'tasks',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const status = request.query.get('status');
            const priority = request.query.get('priority');
            const category = request.query.get('category');
            const assignedToId = request.query.get('assignedToId');
            const startDate = request.query.get('startDate');
            const endDate = request.query.get('endDate');
            
            let query = `
                SELECT t.Id, t.Title, t.Description, t.Category, t.Priority, t.Status,
                       t.DueDate, t.DueTime, t.AssignedToId, t.AssignedById, t.ClinicId,
                       t.CompletedDate, t.CompletedById, t.Notes, t.Tags,
                       t.IsRecurring, t.RecurrenceRule, t.CreatedDate, t.ModifiedDate,
                       u.FirstName + ' ' + ISNULL(u.LastName, '') AS AssignedToName,
                       ab.FirstName + ' ' + ISNULL(ab.LastName, '') AS AssignedByName,
                       c.Name AS ClinicName
                FROM Tasks t
                LEFT JOIN Users u ON t.AssignedToId = u.Id
                LEFT JOIN Users ab ON t.AssignedById = ab.Id
                LEFT JOIN Clinics c ON t.ClinicId = c.Id
                WHERE 1=1
            `;
            
            const params = {};
            
            if (status) {
                query += ' AND t.Status = @status';
                params.status = status;
            }
            if (priority) {
                query += ' AND t.Priority = @priority';
                params.priority = priority;
            }
            if (category) {
                query += ' AND t.Category = @category';
                params.category = category;
            }
            if (assignedToId) {
                query += ' AND t.AssignedToId = @assignedToId';
                params.assignedToId = assignedToId;
            }
            if (startDate) {
                query += ' AND t.DueDate >= @startDate';
                params.startDate = startDate;
            }
            if (endDate) {
                query += ' AND t.DueDate <= @endDate';
                params.endDate = endDate;
            }
            
            query += ` ORDER BY 
                CASE t.Priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
                t.DueDate`;
            
            const result = await execute(query, params);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching tasks:', err);
            return errorResponse('Failed to fetch tasks', 500);
        }
    }
});

// GET task by ID
app.http('getTaskById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'tasks/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const result = await execute(`
                SELECT t.Id, t.Title, t.Description, t.Category, t.Priority, t.Status,
                       t.DueDate, t.DueTime, t.AssignedToId, t.AssignedById, t.ClinicId,
                       t.CompletedDate, t.CompletedById, t.Notes, t.Tags,
                       t.IsRecurring, t.RecurrenceRule, t.CreatedDate, t.ModifiedDate,
                       u.FirstName + ' ' + ISNULL(u.LastName, '') AS AssignedToName,
                       ab.FirstName + ' ' + ISNULL(ab.LastName, '') AS AssignedByName,
                       c.Name AS ClinicName
                FROM Tasks t
                LEFT JOIN Users u ON t.AssignedToId = u.Id
                LEFT JOIN Users ab ON t.AssignedById = ab.Id
                LEFT JOIN Clinics c ON t.ClinicId = c.Id
                WHERE t.Id = @id
            `, { id });
            
            if (result.recordset.length === 0) {
                return errorResponse('Task not found', 404);
            }
            return successResponse(result.recordset[0]);
        } catch (err) {
            context.error('Error fetching task:', err);
            return errorResponse('Failed to fetch task', 500);
        }
    }
});

// POST create task
app.http('createTask', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'tasks',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, 
                    AssignedToId, AssignedById, ClinicId, Notes, Tags, IsRecurring, RecurrenceRule)
                OUTPUT INSERTED.Id
                VALUES (@title, @description, @category, @priority, @status, @dueDate, @dueTime,
                    @assignedToId, @assignedById, @clinicId, @notes, @tags, @isRecurring, @recurrenceRule)
            `, {
                title: body.title,
                description: body.description || null,
                category: body.category || 'Administrative',
                priority: body.priority || 'Medium',
                status: body.status || 'Pending',
                dueDate: body.dueDate || null,
                dueTime: body.dueTime || null,
                assignedToId: body.assignedToId || null,
                assignedById: body.assignedById || null,
                clinicId: body.clinicId || null,
                notes: body.notes || null,
                tags: body.tags ? JSON.stringify(body.tags) : null,
                isRecurring: body.isRecurring || false,
                recurrenceRule: body.recurrenceRule || null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating task:', err);
            return errorResponse('Failed to create task', 500);
        }
    }
});

// PUT update task
app.http('updateTask', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'tasks/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            // Check if task is being marked as completed
            let completedDate = null;
            let completedById = null;
            if (body.status === 'Completed' && body.completedById) {
                completedDate = new Date().toISOString();
                completedById = body.completedById;
            }
            
            await execute(`
                UPDATE Tasks SET
                    Title = @title, Description = @description, Category = @category,
                    Priority = @priority, Status = @status, DueDate = @dueDate, DueTime = @dueTime,
                    AssignedToId = @assignedToId, AssignedById = @assignedById, ClinicId = @clinicId,
                    CompletedDate = @completedDate, CompletedById = @completedById,
                    Notes = @notes, Tags = @tags, IsRecurring = @isRecurring, RecurrenceRule = @recurrenceRule,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                title: body.title,
                description: body.description || null,
                category: body.category || 'Administrative',
                priority: body.priority || 'Medium',
                status: body.status || 'Pending',
                dueDate: body.dueDate || null,
                dueTime: body.dueTime || null,
                assignedToId: body.assignedToId || null,
                assignedById: body.assignedById || null,
                clinicId: body.clinicId || null,
                completedDate: completedDate,
                completedById: completedById,
                notes: body.notes || null,
                tags: body.tags ? JSON.stringify(body.tags) : null,
                isRecurring: body.isRecurring || false,
                recurrenceRule: body.recurrenceRule || null
            });
            
            return successResponse({ message: 'Task updated successfully' });
        } catch (err) {
            context.error('Error updating task:', err);
            return errorResponse('Failed to update task', 500);
        }
    }
});

// DELETE task
app.http('deleteTask', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'tasks/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`DELETE FROM Tasks WHERE Id = @id`, { id });
            return successResponse({ message: 'Task deleted successfully' });
        } catch (err) {
            context.error('Error deleting task:', err);
            return errorResponse('Failed to delete task', 500);
        }
    }
});

// GET task stats
app.http('getTaskStats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'tasks/stats/summary',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const result = await execute(`
                SELECT
                    SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS Pending,
                    SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgress,
                    SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS Completed,
                    SUM(CASE WHEN Status != 'Completed' AND DueDate < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS Overdue
                FROM Tasks
            `);
            
            return successResponse(result.recordset[0]);
        } catch (err) {
            context.error('Error fetching task stats:', err);
            return errorResponse('Failed to fetch task stats', 500);
        }
    }
});
