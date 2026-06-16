// Schedules API Functions
const { app } = require('@azure/functions');
const { execute } = require('./shared/database');
const { successResponse, errorResponse, handleOptions } = require('./shared/response');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('./shared/tenant');

// GET all schedules
app.http('getSchedules', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'schedules',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const tenantUserId = getRequestUserId(request);
            if (!tenantUserId) return successResponse([]);
            const userId = request.query.get('userId');
            const clinicId = request.query.get('clinicId');
            const startDate = request.query.get('startDate');
            const endDate = request.query.get('endDate');
            
            let query = `
                  SELECT s.Id, s.UserId, s.ProviderId, s.EmployeeId, s.ClinicId, s.RoomId, s.AssistantId,
                      s.ShiftBuilderShiftId, s.ShiftBuilderEmployeeRowId,
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
                WHERE s.IsActive = 1 AND ${tenantClinicScopeSql('s.ClinicId')}
            `;
            
            const params = { [TENANT_PARAM]: tenantUserId };
            
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
            const tenantUserId = getRequestUserId(request);
            if (!tenantUserId) return errorResponse('Schedule not found', 404);
            const result = await execute(`
                  SELECT s.Id, s.UserId, s.ProviderId, s.EmployeeId, s.ClinicId, s.RoomId, s.AssistantId,
                      s.ShiftBuilderShiftId, s.ShiftBuilderEmployeeRowId,
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
                WHERE s.Id = @id AND s.IsActive = 1 AND ${tenantClinicScopeSql('s.ClinicId')}
            `, { id, [TENANT_PARAM]: tenantUserId });
            
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

            const normalizeDateOnly = (value) => {
                const raw = String(value || '').trim();
                if (!raw) return '';
                const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
                if (match && match[1]) return match[1];
                const parsed = new Date(raw);
                if (Number.isNaN(parsed.getTime())) return '';
                return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
            };

            const normalizeTimeOnly = (value) => {
                const raw = String(value || '').trim();
                if (!raw) return '';

                const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
                if (hhmm) {
                    const h = Math.max(0, Math.min(23, Number.parseInt(hhmm[1], 10) || 0));
                    const m = Math.max(0, Math.min(59, Number.parseInt(hhmm[2], 10) || 0));
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }

                const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (ampm) {
                    let h = Number.parseInt(ampm[1], 10) || 0;
                    const m = Math.max(0, Math.min(59, Number.parseInt(ampm[2], 10) || 0));
                    const marker = String(ampm[3] || '').toUpperCase();
                    if (marker === 'PM' && h !== 12) h += 12;
                    if (marker === 'AM' && h === 12) h = 0;
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }

                return '';
            };

            const parseRange = (value) => {
                const raw = String(value || '').trim();
                if (!raw) return { start: '', end: '' };
                const parts = raw.split(' - ').map((part) => String(part || '').trim());
                if (parts.length !== 2) return { start: '', end: '' };
                return {
                    start: normalizeTimeOnly(parts[0]),
                    end: normalizeTimeOnly(parts[1])
                };
            };

            const dateStart = normalizeDateOnly(body.startDate || body.dateKey || body.date || body.targetDate || body.shiftDate);
            const dateEnd = normalizeDateOnly(body.endDate) || dateStart;
            const inferredRange = parseRange(body.timeName || body.timeRange || body.time);
            const timeStart = normalizeTimeOnly(body.startTime) || inferredRange.start || '08:00';
            const timeEnd = normalizeTimeOnly(body.endTime) || inferredRange.end || '16:00';
            const effectiveDays = String(body.daysOfWeek || '').trim() || (dateStart ? new Date(`${dateStart}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }) : 'Mon');

            if (!dateStart) {
                return errorResponse('Missing required schedule date field', 400);
            }
            
            const result = await execute(`
                INSERT INTO Schedules (UserId, ProviderId, EmployeeId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes, ShiftBuilderShiftId, ShiftBuilderEmployeeRowId)
                OUTPUT INSERTED.Id
                VALUES (@userId, @providerId, @employeeId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes, @shiftBuilderShiftId, @shiftBuilderEmployeeRowId)
            `, {
                userId: body.userId,
                providerId: body.providerId || null,
                employeeId: body.employeeId || null,
                clinicId: body.clinicId,
                roomId: body.roomId || null,
                assistantId: body.assistantId || null,
                startDate: dateStart,
                endDate: dateEnd || null,
                startTime: timeStart,
                endTime: timeEnd,
                daysOfWeek: effectiveDays,
                color: body.color || '#10b981',
                notes: body.notes || null,
                shiftBuilderShiftId: body.shiftBuilderShiftId || null,
                shiftBuilderEmployeeRowId: body.shiftBuilderEmployeeRowId || null
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

            if (body.shiftBuilderLinkOnly === true || String(body.updateMode || '').toLowerCase() === 'shift-builder-link-only') {
                await execute(`
                    UPDATE Schedules SET
                        ShiftBuilderShiftId = @shiftBuilderShiftId,
                        ShiftBuilderEmployeeRowId = @shiftBuilderEmployeeRowId,
                        ModifiedDate = GETUTCDATE()
                    WHERE Id = @id
                `, {
                    id,
                    shiftBuilderShiftId: body.shiftBuilderShiftId || null,
                    shiftBuilderEmployeeRowId: body.shiftBuilderEmployeeRowId || null
                });

                return successResponse({ message: 'Schedule shift-builder link updated successfully' });
            }

            if (body.dateOnlyUpdate === true || String(body.updateMode || '').toLowerCase() === 'date-only') {
                const startDate = String(body.startDate || body.targetDate || '').trim();
                const endDate = String(body.endDate || body.targetDate || body.startDate || '').trim() || startDate;
                const daysOfWeek = String(body.daysOfWeek || body.targetDay || '').trim();

                if (!startDate) {
                    return errorResponse('Missing required date field for date-only update', 400);
                }

                await execute(`
                    UPDATE Schedules SET
                        StartDate = @startDate,
                        EndDate = @endDate,
                        DaysOfWeek = COALESCE(@daysOfWeek, DaysOfWeek),
                        ModifiedDate = GETUTCDATE()
                    WHERE Id = @id
                `, {
                    id,
                    startDate,
                    endDate,
                    daysOfWeek: daysOfWeek || null
                });

                return successResponse({ message: 'Schedule date updated successfully' });
            }
            
            await execute(`
                UPDATE Schedules SET
                    UserId = @userId, ProviderId = @providerId, EmployeeId = @employeeId, ClinicId = @clinicId, RoomId = @roomId, AssistantId = @assistantId,
                    StartDate = @startDate, EndDate = @endDate, StartTime = @startTime, EndTime = @endTime,
                    DaysOfWeek = @daysOfWeek, Color = @color, Notes = @notes, ShiftBuilderShiftId = @shiftBuilderShiftId, ShiftBuilderEmployeeRowId = @shiftBuilderEmployeeRowId,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                userId: body.userId,
                providerId: body.providerId || null,
                employeeId: body.employeeId || null,
                clinicId: body.clinicId,
                roomId: body.roomId || null,
                assistantId: body.assistantId || null,
                startDate: body.startDate,
                endDate: body.endDate || null,
                startTime: body.startTime,
                endTime: body.endTime,
                daysOfWeek: body.daysOfWeek || 'Mon,Tue,Wed,Thu,Fri',
                color: body.color || '#10b981',
                notes: body.notes || null,
                shiftBuilderShiftId: body.shiftBuilderShiftId || null,
                shiftBuilderEmployeeRowId: body.shiftBuilderEmployeeRowId || null
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
