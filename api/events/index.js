const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName`);

    return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function normalizeNullableString(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str || null;
}

function toNullableInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toIsoDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function toIsoTime(value, fallback = '00:00') {
    if (!value) return fallback;
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    const hh = String(Math.max(0, Math.min(23, Number.parseInt(match[1], 10) || 0))).padStart(2, '0');
    const mm = String(Math.max(0, Math.min(59, Number.parseInt(match[2], 10) || 0))).padStart(2, '0');
    return `${hh}:${mm}`;
}

function toDateTime(value, fallback = null) {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date;
}

async function resolveUserId(pool, key) {
    if (key === null || key === undefined) return null;
    const keyStr = String(key).trim();
    if (!keyStr) return null;
    const numericId = Number(keyStr);
    if (Number.isFinite(numericId) && Number.isInteger(numericId)) return numericId;

    const result = await pool.request()
        .input('key', sql.NVarChar, keyStr)
        .query(`
            SELECT TOP 1 Id
            FROM Users
            WHERE IsActive = 1 AND (
                Username = @key OR
                WorkEmail = @key OR
                PersonalEmail = @key OR
                LTRIM(RTRIM(CONCAT(FirstName, ' ', LastName))) = @key
            )
        `);

    return result.recordset[0]?.Id || null;
}

function normalizeAttendees(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                const raw = item.trim();
                if (!raw) return null;
                return { userId: null, displayName: raw, email: null, status: 'invited' };
            }

            const userId = toNullableInt(item.userId || item.id);
            const displayName = normalizeNullableString(item.displayName || item.name || item.username);
            const email = normalizeNullableString(item.email || item.workEmail || item.personalEmail);
            const status = normalizeNullableString(item.status) || 'invited';

            if (!userId && !displayName && !email) return null;
            return { userId, displayName, email, status };
        })
        .filter(Boolean);
}

async function upsertEventAttendees(pool, eventId, attendees, hasEventAttendeesTable) {
    if (!hasEventAttendeesTable) return;

    await pool.request()
        .input('eventId', sql.Int, eventId)
        .query('DELETE FROM EventAttendees WHERE EventId = @eventId');

    for (const attendee of attendees) {
        await pool.request()
            .input('eventId', sql.Int, eventId)
            .input('userId', sql.Int, attendee.userId)
            .input('displayName', sql.NVarChar(255), attendee.displayName)
            .input('email', sql.NVarChar(255), attendee.email)
            .input('status', sql.NVarChar(50), attendee.status || 'invited')
            .query(`
                INSERT INTO EventAttendees (EventId, UserId, DisplayName, Email, Status)
                VALUES (@eventId, @userId, @displayName, @email, @status)
            `);
    }
}

async function getAttendeesMap(pool, eventIds, hasEventAttendeesTable) {
    const map = new Map();
    if (!hasEventAttendeesTable || !Array.isArray(eventIds) || !eventIds.length) return map;

    const idList = eventIds.filter((id) => Number.isInteger(Number(id))).map((id) => Number(id));
    if (!idList.length) return map;

    const inClause = idList.join(',');
    const result = await pool.request().query(`
        SELECT
            ea.EventId,
            ea.UserId,
            ea.DisplayName,
            ea.Email,
            ea.Status,
            u.Username,
            LTRIM(RTRIM(CONCAT(COALESCE(u.FirstName, ''), ' ', COALESCE(u.LastName, '')))) AS UserFullName
        FROM EventAttendees ea
        LEFT JOIN Users u ON u.Id = ea.UserId
        WHERE ea.EventId IN (${inClause})
        ORDER BY ea.Id ASC
    `);

    (result.recordset || []).forEach((row) => {
        const key = Number(row.EventId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({
            userId: row.UserId || null,
            displayName: row.DisplayName || row.UserFullName || row.Username || null,
            email: row.Email || null,
            status: row.Status || 'invited'
        });
    });

    return map;
}

function mapEventRow(row, attendees = []) {
    const startDateTime = row.StartDateTime || row.startDateTime || null;
    const endDateTime = row.EndDateTime || row.endDateTime || null;
    const eventDate = row.EventDate || row.eventDate || toIsoDate(startDateTime);
    const startTime = row.StartTime || row.startTime || toIsoTime(startDateTime);
    const endTime = row.EndTime || row.endTime || toIsoTime(endDateTime, startTime);

    const organizerName = row.OrganizerName || row.organizerName || row.CreatedByName || null;

    return {
        id: row.Id,
        title: row.Title,
        description: row.Description || '',
        eventType: row.EventType || 'other',
        eventCategory: row.EventCategory || null,
        startDateTime: startDateTime ? new Date(startDateTime).toISOString() : null,
        endDateTime: endDateTime ? new Date(endDateTime).toISOString() : null,
        eventDate,
        startTime,
        endTime,
        allDay: !!row.AllDay,
        clinicId: row.ClinicId || null,
        roomId: row.RoomId || null,
        location: row.Location || null,
        color: row.Color || null,
        priority: row.Priority || 'medium',
        status: row.Status || 'scheduled',
        organizerUserId: row.OrganizerUserId || null,
        organizerName,
        attendees: Array.isArray(attendees) ? attendees : []
    };
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

    let pool;
    try {
        pool = await getPool();
        const id = toNullableInt(req.params.id);
        const eventColumns = await getTableColumns(pool, 'Events');
        const attendeesColumns = await getTableColumns(pool, 'EventAttendees').catch(() => new Set());
        const hasEventAttendeesTable = attendeesColumns.size > 0;

        const hasEventCategory = hasColumn(eventColumns, 'EventCategory');
        const hasLocation = hasColumn(eventColumns, 'Location');
        const hasOrganizerUserId = hasColumn(eventColumns, 'OrganizerUserId');
        const hasCreatedBy = hasColumn(eventColumns, 'CreatedBy');
        const hasOrganizerName = hasColumn(eventColumns, 'OrganizerName');
        const hasEventDate = hasColumn(eventColumns, 'EventDate');
        const hasStartTime = hasColumn(eventColumns, 'StartTime');
        const hasEndTime = hasColumn(eventColumns, 'EndTime');
        const hasModifiedDate = hasColumn(eventColumns, 'ModifiedDate');
        const hasClinicCol = hasColumn(eventColumns, 'ClinicId');
        const organizerJoinColumn = hasOrganizerUserId ? 'e.OrganizerUserId' : (hasCreatedBy ? 'e.CreatedBy' : 'NULL');
        const tenantUserId = getRequestUserId(req);

        if (req.method === 'GET') {
            if (hasClinicCol && !tenantUserId) {
                context.res = { status: 200, headers, body: id ? null : [] };
                return;
            }
            if (id) {
                const tenantClause = hasClinicCol ? ` AND ${tenantClinicScopeSql('e.ClinicId')}` : '';
                const query = `
                    SELECT
                        e.*,
                        u.Username AS CreatedByName,
                        LTRIM(RTRIM(CONCAT(COALESCE(u.FirstName, ''), ' ', COALESCE(u.LastName, '')))) AS CreatedByFullName
                    FROM Events e
                    LEFT JOIN Users u ON u.Id = ${organizerJoinColumn}
                    WHERE e.Id = @id${tenantClause}
                `;
                const reqBuilder = pool.request().input('id', sql.Int, id);
                if (hasClinicCol) reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                const result = await reqBuilder.query(query);
                const row = result.recordset[0] || null;
                if (!row) {
                    context.res = { status: 404, headers, body: { error: 'Event not found' } };
                    return;
                }

                const attendeesMap = await getAttendeesMap(pool, [row.Id], hasEventAttendeesTable);
                const mapped = mapEventRow(row, attendeesMap.get(Number(row.Id)) || []);
                context.res = { status: 200, headers, body: mapped };
                return;
            }

            const startQuery = normalizeNullableString(req.query?.start);
            const endQuery = normalizeNullableString(req.query?.end);

            const request = pool.request();
            let whereClause = '';
            if (startQuery) {
                request.input('startQuery', sql.DateTime2, toDateTime(startQuery));
                whereClause += ` AND e.EndDateTime >= @startQuery`;
            }
            if (endQuery) {
                request.input('endQuery', sql.DateTime2, toDateTime(endQuery));
                whereClause += ` AND e.StartDateTime <= @endQuery`;
            }
            if (hasClinicCol) {
                request.input(TENANT_PARAM, sql.Int, tenantUserId);
                whereClause += ` AND ${tenantClinicScopeSql('e.ClinicId')}`;
            }

            const query = `
                SELECT
                    e.*,
                    u.Username AS CreatedByName,
                    LTRIM(RTRIM(CONCAT(COALESCE(u.FirstName, ''), ' ', COALESCE(u.LastName, '')))) AS CreatedByFullName
                FROM Events e
                LEFT JOIN Users u ON u.Id = ${organizerJoinColumn}
                WHERE 1=1 ${whereClause}
                ORDER BY e.StartDateTime, e.Title
            `;

            const result = await request.query(query);
            const rows = result.recordset || [];
            const attendeesMap = await getAttendeesMap(pool, rows.map((r) => r.Id), hasEventAttendeesTable);
            const mapped = rows.map((row) => mapEventRow(row, attendeesMap.get(Number(row.Id)) || []));
            context.res = { status: 200, headers, body: mapped };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const title = normalizeNullableString(body.title);
            if (!title) {
                context.res = { status: 400, headers, body: { error: 'title is required' } };
                return;
            }

            const eventType = normalizeNullableString(body.eventType) || 'other';
            const startDateTime = toDateTime(body.startDateTime || `${body.eventDate || ''}T${toIsoTime(body.startTime)}:00`);
            const endDateTime = toDateTime(body.endDateTime || `${body.eventDate || ''}T${toIsoTime(body.endTime, toIsoTime(body.startTime))}:00`, startDateTime);
            if (!startDateTime || !endDateTime) {
                context.res = { status: 400, headers, body: { error: 'Valid startDateTime and endDateTime are required' } };
                return;
            }

            const providedOrganizerId = toNullableInt(body.organizerUserId || body.createdBy);
            const organizerLookup = body.organizerName || body.organizer || body.organizerUsername || null;
            const organizerUserId = providedOrganizerId || await resolveUserId(pool, organizerLookup);
            const attendees = normalizeAttendees(body.attendees);

            const insertDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: title },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: normalizeNullableString(body.description) },
                { column: 'EventType', param: 'eventType', type: sql.NVarChar(50), value: eventType },
                { column: 'StartDateTime', param: 'startDateTime', type: sql.DateTime2, value: startDateTime },
                { column: 'EndDateTime', param: 'endDateTime', type: sql.DateTime2, value: endDateTime },
                { column: 'AllDay', param: 'allDay', type: sql.Bit, value: !!body.allDay },
                { column: 'ClinicId', param: 'clinicId', type: sql.Int, value: toNullableInt(body.clinicId) },
                { column: 'RoomId', param: 'roomId', type: sql.Int, value: toNullableInt(body.roomId) },
                { column: 'Color', param: 'color', type: sql.NVarChar(20), value: normalizeNullableString(body.color) },
                { column: 'Priority', param: 'priority', type: sql.NVarChar(20), value: normalizeNullableString(body.priority) || 'medium' },
                { column: 'Status', param: 'status', type: sql.NVarChar(50), value: normalizeNullableString(body.status) || 'scheduled' },
                { column: 'CreatedBy', param: 'createdBy', type: sql.Int, value: organizerUserId }
            ];

            if (hasEventCategory) {
                insertDefs.push({ column: 'EventCategory', param: 'eventCategory', type: sql.NVarChar(50), value: normalizeNullableString(body.eventCategory) || 'event' });
            }
            if (hasLocation) {
                insertDefs.push({ column: 'Location', param: 'location', type: sql.NVarChar(255), value: normalizeNullableString(body.location) });
            }
            if (hasOrganizerUserId) {
                insertDefs.push({ column: 'OrganizerUserId', param: 'organizerUserId', type: sql.Int, value: organizerUserId });
            }
            if (hasOrganizerName) {
                insertDefs.push({ column: 'OrganizerName', param: 'organizerName', type: sql.NVarChar(255), value: normalizeNullableString(body.organizerName || body.organizer) });
            }
            if (hasEventDate) {
                insertDefs.push({ column: 'EventDate', param: 'eventDate', type: sql.Date, value: toIsoDate(startDateTime) });
            }
            if (hasStartTime) {
                insertDefs.push({ column: 'StartTime', param: 'startTime', type: sql.NVarChar(20), value: toIsoTime(startDateTime) });
            }
            if (hasEndTime) {
                insertDefs.push({ column: 'EndTime', param: 'endTime', type: sql.NVarChar(20), value: toIsoTime(endDateTime) });
            }

            const filteredDefs = insertDefs.filter((def) => hasColumn(eventColumns, def.column));
            const request = pool.request();
            filteredDefs.forEach((def) => request.input(def.param, def.type, def.value));

            const insertColumns = filteredDefs.map((def) => def.column).join(', ');
            const insertValues = filteredDefs.map((def) => `@${def.param}`).join(', ');
            const result = await request.query(`INSERT INTO Events (${insertColumns}) OUTPUT INSERTED.Id VALUES (${insertValues})`);
            const newId = result.recordset[0]?.Id;

            await upsertEventAttendees(pool, newId, attendees, hasEventAttendeesTable);

            context.res = { status: 201, headers, body: { id: newId } };
            return;
        }

        if (req.method === 'PUT') {
            if (!id) {
                context.res = { status: 400, headers, body: { error: 'id is required for update' } };
                return;
            }

            const body = req.body || {};
            const startDateTime = toDateTime(body.startDateTime || `${body.eventDate || ''}T${toIsoTime(body.startTime)}:00`);
            const endDateTime = toDateTime(body.endDateTime || `${body.eventDate || ''}T${toIsoTime(body.endTime, toIsoTime(body.startTime))}:00`, startDateTime);
            const providedOrganizerId = toNullableInt(body.organizerUserId || body.createdBy);
            const organizerLookup = body.organizerName || body.organizer || body.organizerUsername || null;
            const organizerUserId = providedOrganizerId || await resolveUserId(pool, organizerLookup);
            const attendees = normalizeAttendees(body.attendees);

            const updateDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: normalizeNullableString(body.title) },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: normalizeNullableString(body.description) },
                { column: 'EventType', param: 'eventType', type: sql.NVarChar(50), value: normalizeNullableString(body.eventType) || 'other' },
                { column: 'StartDateTime', param: 'startDateTime', type: sql.DateTime2, value: startDateTime },
                { column: 'EndDateTime', param: 'endDateTime', type: sql.DateTime2, value: endDateTime },
                { column: 'AllDay', param: 'allDay', type: sql.Bit, value: !!body.allDay },
                { column: 'ClinicId', param: 'clinicId', type: sql.Int, value: toNullableInt(body.clinicId) },
                { column: 'RoomId', param: 'roomId', type: sql.Int, value: toNullableInt(body.roomId) },
                { column: 'Color', param: 'color', type: sql.NVarChar(20), value: normalizeNullableString(body.color) },
                { column: 'Priority', param: 'priority', type: sql.NVarChar(20), value: normalizeNullableString(body.priority) || 'medium' },
                { column: 'Status', param: 'status', type: sql.NVarChar(50), value: normalizeNullableString(body.status) || 'scheduled' }
            ];

            if (hasEventCategory) {
                updateDefs.push({ column: 'EventCategory', param: 'eventCategory', type: sql.NVarChar(50), value: normalizeNullableString(body.eventCategory) || 'event' });
            }
            if (hasLocation) {
                updateDefs.push({ column: 'Location', param: 'location', type: sql.NVarChar(255), value: normalizeNullableString(body.location) });
            }
            if (hasOrganizerUserId) {
                updateDefs.push({ column: 'OrganizerUserId', param: 'organizerUserId', type: sql.Int, value: organizerUserId });
            }
            if (hasOrganizerName) {
                updateDefs.push({ column: 'OrganizerName', param: 'organizerName', type: sql.NVarChar(255), value: normalizeNullableString(body.organizerName || body.organizer) });
            }
            if (hasEventDate) {
                updateDefs.push({ column: 'EventDate', param: 'eventDate', type: sql.Date, value: toIsoDate(startDateTime) });
            }
            if (hasStartTime) {
                updateDefs.push({ column: 'StartTime', param: 'startTime', type: sql.NVarChar(20), value: toIsoTime(startDateTime) });
            }
            if (hasEndTime) {
                updateDefs.push({ column: 'EndTime', param: 'endTime', type: sql.NVarChar(20), value: toIsoTime(endDateTime) });
            }

            const filteredDefs = updateDefs.filter((def) => hasColumn(eventColumns, def.column));
            const request = pool.request().input('id', sql.Int, id);
            filteredDefs.forEach((def) => request.input(def.param, def.type, def.value));

            const setClauses = filteredDefs.map((def) => `${def.column}=@${def.param}`);
            if (hasModifiedDate) {
                setClauses.push('ModifiedDate=GETUTCDATE()');
            }

            if (!setClauses.length) {
                context.res = { status: 500, headers, body: { error: 'No updatable columns found for Events.' } };
                return;
            }

            await request.query(`UPDATE Events SET ${setClauses.join(', ')} WHERE Id=@id`);
            await upsertEventAttendees(pool, id, attendees, hasEventAttendeesTable);

            context.res = { status: 200, headers, body: { message: 'Event updated' } };
            return;
        }

        if (req.method === 'DELETE') {
            if (!id) {
                context.res = { status: 400, headers, body: { error: 'id is required for delete' } };
                return;
            }

            if (hasEventAttendeesTable) {
                await pool.request()
                    .input('id', sql.Int, id)
                    .query('DELETE FROM EventAttendees WHERE EventId = @id');
            }

            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Events WHERE Id = @id');

            context.res = { status: 200, headers, body: { message: 'Event deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Events API error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
