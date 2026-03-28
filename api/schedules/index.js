const sql = require('mssql');

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
            options: { encrypt: true, trustServerCertificate: false }
        };
    }
    return {};
}

async function readBody(req) {
    if (!req) return {};
    if (typeof req.body === 'object' && req.body !== null) return req.body;
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (_) {
            return {};
        }
    }
    if (typeof req.json === 'function') {
        try {
            return await req.json();
        } catch (_) {
            return {};
        }
    }
    return {};
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await sql.connect(getConfig());
        const id = req.params.id;

        const parseIntOrNull = (value) => {
            const parsed = Number.parseInt(String(value), 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        };

        const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

        const parseOptionalIntField = (body, fieldName) => {
            if (!hasOwn(body, fieldName)) return undefined;
            return parseIntOrNull(body[fieldName]);
        };

        const normalizeName = (value) => String(value || '')
            .toLowerCase()
            .replace(/\b(dr|doctor|dds|dmd)\.?\s*/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const isActiveUserId = async (candidateUserId) => {
            const parsedId = parseIntOrNull(candidateUserId);
            if (!parsedId) return false;
            const check = await pool.request()
                .input('userId', sql.Int, parsedId)
                .query('SELECT TOP 1 Id FROM Users WHERE Id = @userId AND ISNULL(IsActive, 1) = 1');
            return !!(check.recordset && check.recordset[0] && check.recordset[0].Id);
        };

        const resolveActiveUserIdByName = async (rawName) => {
            const target = normalizeName(rawName);
            if (!target) return null;
            const result = await pool.request().query(`
                SELECT Id, Username, FirstName, LastName
                FROM Users
                WHERE ISNULL(IsActive, 1) = 1
            `);
            const matched = (result.recordset || []).find((user) => {
                const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
                return normalizeName(fullName) === target || normalizeName(user.Username) === target;
            });
            return parseIntOrNull(matched?.Id);
        };

        const resolveClinicIdByName = async (rawClinicName) => {
            const target = normalizeName(rawClinicName);
            if (!target) return null;
            const result = await pool.request().query(`
                SELECT Id, Name
                FROM Clinics
                WHERE ISNULL(IsActive, 1) = 1
            `);
            const matched = (result.recordset || []).find((clinic) => normalizeName(clinic.Name) === target);
            return parseIntOrNull(matched?.Id);
        };

        const resolveRoomIdByName = async (rawRoomName, clinicId) => {
            const target = normalizeName(rawRoomName);
            if (!target) return null;
            const request = pool.request();
            let query = `SELECT Id, Name FROM Rooms WHERE ISNULL(IsActive, 1) = 1`;
            if (parseIntOrNull(clinicId)) {
                request.input('clinicId', sql.Int, parseIntOrNull(clinicId));
                query += ' AND ClinicId = @clinicId';
            }
            const result = await request.query(query);
            const matched = (result.recordset || []).find((room) => normalizeName(room.Name) === target);
            return parseIntOrNull(matched?.Id);
        };

        const schemaInfo = await pool.request().query(`
            SELECT
                CASE WHEN COL_LENGTH('Schedules', 'ProviderId') IS NULL THEN 0 ELSE 1 END AS HasProviderId,
                CASE WHEN COL_LENGTH('Schedules', 'EmployeeId') IS NULL THEN 0 ELSE 1 END AS HasEmployeeId,
                CASE WHEN COL_LENGTH('Schedules', 'ShiftBuilderShiftId') IS NULL THEN 0 ELSE 1 END AS HasShiftBuilderShiftId,
                CASE WHEN COL_LENGTH('Schedules', 'ShiftBuilderEmployeeRowId') IS NULL THEN 0 ELSE 1 END AS HasShiftBuilderEmployeeRowId
        `);
        const hasProviderIdColumn = !!Number(schemaInfo.recordset?.[0]?.HasProviderId || 0);
        const hasEmployeeIdColumn = !!Number(schemaInfo.recordset?.[0]?.HasEmployeeId || 0);
        const hasShiftBuilderShiftIdColumn = !!Number(schemaInfo.recordset?.[0]?.HasShiftBuilderShiftId || 0);
        const hasShiftBuilderEmployeeRowIdColumn = !!Number(schemaInfo.recordset?.[0]?.HasShiftBuilderEmployeeRowId || 0);
        const hasProviderEmployeeColumns = hasProviderIdColumn && hasEmployeeIdColumn;
        const hasShiftBuilderLinkColumns = hasShiftBuilderShiftIdColumn && hasShiftBuilderEmployeeRowIdColumn;

        const baseGetSelect = hasProviderEmployeeColumns
            ? `SELECT s.*,
                      u.FirstName + ' ' + u.LastName as EmployeeName,
                      c.Name as ClinicName,
                      r.Name as RoomName,
                      au.FirstName + ' ' + au.LastName as AssistantName,
                      pu.FirstName + ' ' + pu.LastName as ProviderName,
                      eu.FirstName + ' ' + eu.LastName as EmployeeOwnerName
               FROM Schedules s
               LEFT JOIN Users u ON s.UserId = u.Id
               LEFT JOIN Users pu ON s.ProviderId = pu.Id
               LEFT JOIN Users eu ON s.EmployeeId = eu.Id
               LEFT JOIN Users au ON s.AssistantId = au.Id
               LEFT JOIN Clinics c ON s.ClinicId = c.Id
               LEFT JOIN Rooms r ON s.RoomId = r.Id`
            : `SELECT s.*,
                      u.FirstName + ' ' + u.LastName as EmployeeName,
                      c.Name as ClinicName,
                      r.Name as RoomName,
                      au.FirstName + ' ' + au.LastName as AssistantName
               FROM Schedules s
               LEFT JOIN Users u ON s.UserId = u.Id
               LEFT JOIN Users au ON s.AssistantId = au.Id
               LEFT JOIN Clinics c ON s.ClinicId = c.Id
               LEFT JOIN Rooms r ON s.RoomId = r.Id`;

        const activeAndNotSyntheticWhere = `
            s.IsActive = 1
            AND ISNULL(u.IsActive, 1) = 1
            AND LOWER(LTRIM(RTRIM(ISNULL(u.Username, '')))) <> 'schedule_unassigned'
            AND NOT (
                LOWER(LTRIM(RTRIM(ISNULL(u.FirstName, '')))) = 'unassigned'
                AND LOWER(LTRIM(RTRIM(ISNULL(u.LastName, '')))) = 'schedule'
            )`;

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`${baseGetSelect} WHERE s.Id = @id AND ${activeAndNotSyntheticWhere}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query(`${baseGetSelect} WHERE ${activeAndNotSyntheticWhere} ORDER BY s.StartDate, s.StartTime`);
                context.res = { status: 200, headers, body: result.recordset };
            }
            return;
        }

        if (req.method === 'POST') {
            const body = await readBody(req);

            let providerId = parseOptionalIntField(body, 'providerId');
            let employeeId = parseOptionalIntField(body, 'employeeId');
            let assistantId = parseOptionalIntField(body, 'assistantId');
            let legacyUserId = parseOptionalIntField(body, 'userId');
            const shiftBuilderShiftId = parseOptionalIntField(body, 'shiftBuilderShiftId');
            const shiftBuilderEmployeeRowId = parseOptionalIntField(body, 'shiftBuilderEmployeeRowId');

            if (providerId === undefined) providerId = null;
            if (employeeId === undefined) employeeId = null;
            if (assistantId === undefined) assistantId = null;
            if (legacyUserId === undefined) legacyUserId = null;

            if (!providerId) {
                providerId = await resolveActiveUserIdByName(body.providerName || body.provider);
            }
            if (!employeeId) {
                employeeId = await resolveActiveUserIdByName(body.employeeName || body.employee || body.userName || body.name);
            }
            if (!assistantId) {
                assistantId = await resolveActiveUserIdByName(body.assistantName || body.assistant);
            }
            if (!legacyUserId) {
                legacyUserId = await resolveActiveUserIdByName(body.userName || body.employeeName || body.name || body.employee || body.provider);
            }

            let clinicId = parseIntOrNull(body.clinicId);
            if (!clinicId) clinicId = await resolveClinicIdByName(body.clinicName || body.clinic);

            let roomId = parseIntOrNull(body.roomId);
            if (!roomId) roomId = await resolveRoomIdByName(body.roomName || body.room, clinicId);

            const ownerUserId = providerId || employeeId || legacyUserId || assistantId || null;

            if (!clinicId) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Missing required schedule fields', details: { clinicIdResolved: false } }
                };
                return;
            }

            if (!hasProviderEmployeeColumns && !ownerUserId) {
                context.res = {
                    status: 400,
                    headers,
                    body: {
                        error: 'Missing required schedule owner fields',
                        details: {
                            message: 'Apply DB migration to support optional providerId/employeeId/assistantId or provide userId/provider/employee.'
                        }
                    }
                };
                return;
            }

            for (const candidate of [providerId, employeeId, assistantId, ownerUserId]) {
                if (candidate && !(await isActiveUserId(candidate))) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'One or more selected users are inactive or missing.' }
                    };
                    return;
                }
            }

            const normalizeDateOnly = (value) => {
                const text = String(value || '').trim();
                if (!text) return '';
                const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
                if (match && match[1]) return match[1];
                const parsed = new Date(text);
                if (Number.isNaN(parsed.getTime())) return '';
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const d = String(parsed.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            };

            const normalizeTimeOnly = (value) => {
                const text = String(value || '').trim();
                if (!text) return '';

                const hhmm = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
                if (hhmm) {
                    const h = Math.max(0, Math.min(23, Number.parseInt(hhmm[1], 10) || 0));
                    const m = Math.max(0, Math.min(59, Number.parseInt(hhmm[2], 10) || 0));
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }

                const ampm = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (ampm) {
                    let h = Number.parseInt(ampm[1], 10) || 0;
                    const m = Math.max(0, Math.min(59, Number.parseInt(ampm[2], 10) || 0));
                    const meridiem = String(ampm[3] || '').toUpperCase();
                    if (meridiem === 'PM' && h !== 12) h += 12;
                    if (meridiem === 'AM' && h === 12) h = 0;
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }

                return '';
            };

            const splitTimeRange = (value) => {
                const text = String(value || '').trim();
                if (!text) return { start: '', end: '' };
                const parts = text.split(' - ').map((part) => String(part || '').trim());
                if (parts.length !== 2) return { start: '', end: '' };
                return {
                    start: normalizeTimeOnly(parts[0]),
                    end: normalizeTimeOnly(parts[1])
                };
            };

            const dayTokenFromDate = (isoDate) => {
                const text = String(isoDate || '').trim();
                if (!text) return 'Mon';
                const parsed = new Date(`${text}T00:00:00`);
                if (Number.isNaN(parsed.getTime())) return 'Mon';
                return parsed.toLocaleDateString('en-US', { weekday: 'short' });
            };

            const inferredDate = normalizeDateOnly(body.startDate || body.dateKey || body.date || body.targetDate || body.shiftDate);
            const effectiveStartDate = inferredDate || normalizeDateOnly(body.startDate);
            const effectiveEndDate = normalizeDateOnly(body.endDate) || effectiveStartDate;

            if (!effectiveStartDate) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Missing required schedule date field.' }
                };
                return;
            }

            const inferredRange = splitTimeRange(body.timeName || body.timeRange || body.time);
            const effectiveStartTime = normalizeTimeOnly(body.startTime) || inferredRange.start || '08:00';
            const effectiveEndTime = normalizeTimeOnly(body.endTime) || inferredRange.end || '16:00';
            const effectiveDaysOfWeek = String(body.daysOfWeek || '').trim() || dayTokenFromDate(effectiveStartDate);

            const request = pool.request()
                .input('userId', sql.Int, ownerUserId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId || null)
                .input('assistantId', sql.Int, assistantId || null)
                .input('startDate', sql.Date, effectiveStartDate)
                .input('endDate', sql.Date, effectiveEndDate || null)
                .input('startTime', sql.VarChar, effectiveStartTime)
                .input('endTime', sql.VarChar, effectiveEndTime)
                .input('daysOfWeek', sql.NVarChar, effectiveDaysOfWeek)
                .input('color', sql.NVarChar, body.color)
                .input('notes', sql.NVarChar, body.notes);

            let insertSql = `INSERT INTO Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes)
                             OUTPUT INSERTED.Id
                             VALUES (@userId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)`;

            if (hasShiftBuilderLinkColumns) {
                request
                    .input('shiftBuilderShiftId', sql.Int, shiftBuilderShiftId || null)
                    .input('shiftBuilderEmployeeRowId', sql.Int, shiftBuilderEmployeeRowId || null);
                insertSql = `INSERT INTO Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes, ShiftBuilderShiftId, ShiftBuilderEmployeeRowId)
                             OUTPUT INSERTED.Id
                             VALUES (@userId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes, @shiftBuilderShiftId, @shiftBuilderEmployeeRowId)`;
            }

            if (hasProviderEmployeeColumns) {
                request
                    .input('providerId', sql.Int, providerId || null)
                    .input('employeeId', sql.Int, employeeId || null);
                if (hasShiftBuilderLinkColumns) {
                    insertSql = `INSERT INTO Schedules (UserId, ProviderId, EmployeeId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes, ShiftBuilderShiftId, ShiftBuilderEmployeeRowId)
                                 OUTPUT INSERTED.Id
                                 VALUES (@userId, @providerId, @employeeId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes, @shiftBuilderShiftId, @shiftBuilderEmployeeRowId)`;
                } else {
                    insertSql = `INSERT INTO Schedules (UserId, ProviderId, EmployeeId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes)
                                 OUTPUT INSERTED.Id
                                 VALUES (@userId, @providerId, @employeeId, @clinicId, @roomId, @assistantId, @startDate, @endDate, @startTime, @endTime, @daysOfWeek, @color, @notes)`;
                }
            }

            const result = await request.query(insertSql);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
            return;
        }

        if (req.method === 'PUT' && id) {
            const body = await readBody(req);

            if ((body.shiftBuilderLinkOnly === true || String(body.updateMode || '').toLowerCase() === 'shift-builder-link-only') && hasShiftBuilderLinkColumns) {
                await pool.request()
                    .input('id', sql.Int, id)
                    .input('shiftBuilderShiftId', sql.Int, parseOptionalIntField(body, 'shiftBuilderShiftId') || null)
                    .input('shiftBuilderEmployeeRowId', sql.Int, parseOptionalIntField(body, 'shiftBuilderEmployeeRowId') || null)
                    .query(`UPDATE Schedules
                            SET ShiftBuilderShiftId = @shiftBuilderShiftId,
                                ShiftBuilderEmployeeRowId = @shiftBuilderEmployeeRowId,
                                ModifiedDate = GETUTCDATE()
                            WHERE Id = @id`);

                context.res = { status: 200, headers, body: { message: 'Schedule shift-builder link updated' } };
                return;
            }

            if (body.dateOnlyUpdate === true || String(body.updateMode || '').toLowerCase() === 'date-only') {
                const startDate = String(body.startDate || body.targetDate || '').trim();
                const endDate = String(body.endDate || body.targetDate || body.startDate || '').trim() || startDate;
                const daysOfWeek = String(body.daysOfWeek || body.targetDay || '').trim();

                if (!startDate) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'Missing required date field for date-only update.' }
                    };
                    return;
                }

                await pool.request()
                    .input('id', sql.Int, id)
                    .input('startDate', sql.Date, startDate)
                    .input('endDate', sql.Date, endDate)
                    .input('daysOfWeek', sql.NVarChar, daysOfWeek || null)
                    .query(`UPDATE Schedules
                            SET StartDate = @startDate,
                                EndDate = @endDate,
                                DaysOfWeek = COALESCE(@daysOfWeek, DaysOfWeek),
                                ModifiedDate = GETUTCDATE()
                            WHERE Id = @id`);

                context.res = { status: 200, headers, body: { message: 'Schedule date updated' } };
                return;
            }

            let providerId = parseOptionalIntField(body, 'providerId');
            let employeeId = parseOptionalIntField(body, 'employeeId');
            let assistantId = parseOptionalIntField(body, 'assistantId');
            let legacyUserId = parseOptionalIntField(body, 'userId');
            const shiftBuilderShiftId = parseOptionalIntField(body, 'shiftBuilderShiftId');
            const shiftBuilderEmployeeRowId = parseOptionalIntField(body, 'shiftBuilderEmployeeRowId');

            if (providerId === undefined) providerId = null;
            if (employeeId === undefined) employeeId = null;
            if (assistantId === undefined) assistantId = null;
            if (legacyUserId === undefined) legacyUserId = null;

            if (!providerId) providerId = await resolveActiveUserIdByName(body.providerName || body.provider);
            if (!employeeId) employeeId = await resolveActiveUserIdByName(body.employeeName || body.employee || body.userName || body.name);
            if (!assistantId) assistantId = await resolveActiveUserIdByName(body.assistantName || body.assistant);
            if (!legacyUserId) legacyUserId = await resolveActiveUserIdByName(body.userName || body.employeeName || body.name || body.employee || body.provider);

            let clinicId = parseIntOrNull(body.clinicId);
            if (!clinicId && (body.clinicName || body.clinic)) clinicId = await resolveClinicIdByName(body.clinicName || body.clinic);

            let roomId = parseIntOrNull(body.roomId);
            if (!roomId && (body.roomName || body.room)) roomId = await resolveRoomIdByName(body.roomName || body.room, clinicId);

            const ownerUserId = providerId || employeeId || legacyUserId || assistantId || null;

            for (const candidate of [providerId, employeeId, assistantId, ownerUserId]) {
                if (candidate && !(await isActiveUserId(candidate))) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'One or more selected users are inactive or missing.' }
                    };
                    return;
                }
            }

            const request = pool.request()
                .input('id', sql.Int, id)
                .input('userId', sql.Int, ownerUserId)
                .input('clinicId', sql.Int, clinicId)
                .input('roomId', sql.Int, roomId)
                .input('assistantId', sql.Int, assistantId)
                .input('startDate', sql.Date, body.startDate)
                .input('endDate', sql.Date, body.endDate)
                .input('startTime', sql.VarChar, body.startTime)
                .input('endTime', sql.VarChar, body.endTime)
                .input('daysOfWeek', sql.NVarChar, body.daysOfWeek)
                .input('color', sql.NVarChar, body.color || null)
                .input('notes', sql.NVarChar, body.notes);

            let updateSql = `UPDATE Schedules
                             SET UserId = @userId,
                                 ClinicId = COALESCE(@clinicId, ClinicId),
                                 RoomId = @roomId,
                                 AssistantId = @assistantId,
                                 StartDate = @startDate,
                                 EndDate = @endDate,
                                 StartTime = @startTime,
                                 EndTime = @endTime,
                                 DaysOfWeek = @daysOfWeek,
                                 Color = COALESCE(@color, Color),
                                 Notes = @notes,
                                 ModifiedDate = GETUTCDATE()
                             WHERE Id = @id`;

            if (hasShiftBuilderLinkColumns) {
                request
                    .input('shiftBuilderShiftId', sql.Int, shiftBuilderShiftId || null)
                    .input('shiftBuilderEmployeeRowId', sql.Int, shiftBuilderEmployeeRowId || null);
                updateSql = `UPDATE Schedules
                             SET UserId = @userId,
                                 ClinicId = COALESCE(@clinicId, ClinicId),
                                 RoomId = @roomId,
                                 AssistantId = @assistantId,
                                 StartDate = @startDate,
                                 EndDate = @endDate,
                                 StartTime = @startTime,
                                 EndTime = @endTime,
                                 DaysOfWeek = @daysOfWeek,
                                 Color = COALESCE(@color, Color),
                                 Notes = @notes,
                                 ShiftBuilderShiftId = @shiftBuilderShiftId,
                                 ShiftBuilderEmployeeRowId = @shiftBuilderEmployeeRowId,
                                 ModifiedDate = GETUTCDATE()
                             WHERE Id = @id`;
            }

            if (hasProviderEmployeeColumns) {
                request
                    .input('providerId', sql.Int, providerId)
                    .input('employeeId', sql.Int, employeeId);
                if (hasShiftBuilderLinkColumns) {
                    updateSql = `UPDATE Schedules
                                 SET UserId = @userId,
                                     ProviderId = @providerId,
                                     EmployeeId = @employeeId,
                                     ClinicId = COALESCE(@clinicId, ClinicId),
                                     RoomId = @roomId,
                                     AssistantId = @assistantId,
                                     StartDate = @startDate,
                                     EndDate = @endDate,
                                     StartTime = @startTime,
                                     EndTime = @endTime,
                                     DaysOfWeek = @daysOfWeek,
                                     Color = COALESCE(@color, Color),
                                     Notes = @notes,
                                     ShiftBuilderShiftId = @shiftBuilderShiftId,
                                     ShiftBuilderEmployeeRowId = @shiftBuilderEmployeeRowId,
                                     ModifiedDate = GETUTCDATE()
                                 WHERE Id = @id`;
                } else {
                    updateSql = `UPDATE Schedules
                                 SET UserId = @userId,
                                     ProviderId = @providerId,
                                     EmployeeId = @employeeId,
                                     ClinicId = COALESCE(@clinicId, ClinicId),
                                     RoomId = @roomId,
                                     AssistantId = @assistantId,
                                     StartDate = @startDate,
                                     EndDate = @endDate,
                                     StartTime = @startTime,
                                     EndTime = @endTime,
                                     DaysOfWeek = @daysOfWeek,
                                     Color = COALESCE(@color, Color),
                                     Notes = @notes,
                                     ModifiedDate = GETUTCDATE()
                                 WHERE Id = @id`;
                }
            }

            await request.query(updateSql);
            context.res = { status: 200, headers, body: { message: 'Schedule updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            try {
                const hardDelete = await pool.request()
                    .input('id', sql.Int, id)
                    .query('DELETE FROM Schedules WHERE Id = @id');

                const affected = Number(hardDelete?.rowsAffected?.[0] || 0);
                if (affected > 0) {
                    context.res = { status: 200, headers, body: { message: 'Schedule deleted' } };
                } else {
                    context.res = { status: 404, headers, body: { error: 'Schedule not found' } };
                }
            } catch (deleteError) {
                const message = String(deleteError?.message || '').toLowerCase();
                const fkConflict = message.includes('delete statement conflicted') || message.includes('reference constraint');
                if (!fkConflict) throw deleteError;

                await pool.request()
                    .input('id', sql.Int, id)
                    .query('UPDATE Schedules SET IsActive = 0 WHERE Id = @id');
                context.res = { status: 200, headers, body: { message: 'Schedule soft-deleted' } };
            }
            return;
        }

    } catch (err) {
        context.log.error('Database error:', err);
        context.res = {
            status: 500,
            headers,
            body: {
                error: err.message,
                code: err.code || null,
                name: err.name || null
            }
        };
    }
};
