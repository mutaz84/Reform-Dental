const { execute } = require('../shared/database');
const { successResponse, errorResponse, handleOptions } = require('../shared/response');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function parseIntOrNull(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNullableString(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

function toBitValue(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return 1;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return 0;
    return fallback;
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

function mapShiftRowsToHierarchy(rows) {
    const shiftMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const shiftId = parseIntOrNull(row?.ShiftId);
        if (!shiftId) return;

        if (!shiftMap.has(shiftId)) {
            shiftMap.set(shiftId, {
                id: shiftId,
                shiftDate: row.ShiftDate || null,
                title: row.ShiftTitle || 'Open Shift',
                status: row.ShiftStatus || 'open',
                useClinicDefaultTime: !!row.UseClinicDefaultTime,
                linkMainCalendar: !!row.LinkMainCalendar,
                linkMySchedule: !!row.LinkMySchedule,
                notes: row.ShiftNotes || null,
                createdByUserId: parseIntOrNull(row.CreatedByUserId),
                createdDate: row.ShiftCreatedDate || null,
                modifiedDate: row.ShiftModifiedDate || null,
                employees: [],
                _employeeMap: new Map()
            });
        }

        const shift = shiftMap.get(shiftId);
        const employeeRowId = parseIntOrNull(row?.EmployeeRowId);
        if (!employeeRowId) return;

        if (!shift._employeeMap.has(employeeRowId)) {
            const employeeEntry = {
                id: employeeRowId,
                shiftId,
                employeeId: parseIntOrNull(row.EmployeeId),
                employeeName: row.EmployeeName || null,
                roleId: parseIntOrNull(row.RoleId),
                roleName: row.RoleName || row.RoleDisplayName || null,
                providerId: parseIntOrNull(row.ProviderId),
                providerName: row.ProviderName || null,
                clinicId: parseIntOrNull(row.EmployeeClinicId),
                clinicName: row.EmployeeClinicName || null,
                roomId: parseIntOrNull(row.EmployeeRoomId),
                roomName: row.EmployeeRoomName || null,
                assistantUserId: parseIntOrNull(row.AssistantUserId),
                assistantName: row.AssistantName || null,
                sortOrder: Number.parseInt(row.EmployeeSortOrder, 10) || 0,
                notes: row.EmployeeNotes || null,
                createdDate: row.EmployeeCreatedDate || null,
                modifiedDate: row.EmployeeModifiedDate || null,
                items: []
            };
            shift._employeeMap.set(employeeRowId, employeeEntry);
            shift.employees.push(employeeEntry);
        }

        const employeeEntry = shift._employeeMap.get(employeeRowId);
        const rowItemId = parseIntOrNull(row?.RowItemId);
        if (!rowItemId) return;

        employeeEntry.items.push({
            id: rowItemId,
            employeeShiftId: employeeRowId,
            itemType: row.ItemType || null,
            itemId: parseIntOrNull(row.ItemId),
            itemName: row.ItemName || null,
            payloadJson: row.PayloadJson || null,
            sortOrder: Number.parseInt(row.ItemSortOrder, 10) || 0,
            createdDate: row.ItemCreatedDate || null,
            modifiedDate: row.ItemModifiedDate || null
        });
    });

    return Array.from(shiftMap.values()).map((shift) => {
        delete shift._employeeMap;
        return shift;
    });
}

async function getShifts({ id = null, shiftDate = null, startDate = null, endDate = null, includeInactive = false, tenantUserId = null } = {}) {
    const result = await execute(`
        SELECT
            sh.Id AS ShiftId,
            sh.ShiftDate,
            sh.Title AS ShiftTitle,
            sh.Status AS ShiftStatus,
            sh.UseClinicDefaultTime,
            sh.LinkMainCalendar,
            sh.LinkMySchedule,
            sh.Notes AS ShiftNotes,
            sh.CreatedByUserId,
            sh.CreatedDate AS ShiftCreatedDate,
            sh.ModifiedDate AS ShiftModifiedDate,

            ser.Id AS EmployeeRowId,
            ser.EmployeeId,
            ser.RoleId,
            ser.RoleName,
            ser.ProviderId,
            ser.ClinicId AS EmployeeClinicId,
            ser.RoomId AS EmployeeRoomId,
            ser.AssistantUserId,
            ser.SortOrder AS EmployeeSortOrder,
            ser.Notes AS EmployeeNotes,
            ser.CreatedDate AS EmployeeCreatedDate,
            ser.ModifiedDate AS EmployeeModifiedDate,

            emp.FirstName + ' ' + ISNULL(emp.LastName, '') AS EmployeeName,
            pro.FirstName + ' ' + ISNULL(pro.LastName, '') AS ProviderName,
            ast.FirstName + ' ' + ISNULL(ast.LastName, '') AS AssistantName,
            c.Name AS EmployeeClinicName,
            r.Name AS EmployeeRoomName,
            ser.RoleName AS RoleDisplayName,

            ri.Id AS RowItemId,
            ri.ItemType,
            ri.ItemId,
            ri.ItemName,
            ri.PayloadJson,
            ri.SortOrder AS ItemSortOrder,
            ri.CreatedDate AS ItemCreatedDate,
            ri.ModifiedDate AS ItemModifiedDate
        FROM ShiftBuilderShifts sh
        LEFT JOIN ShiftBuilderEmployeeRows ser
            ON ser.ShiftId = sh.Id
            AND ser.IsActive = 1
        LEFT JOIN Users emp
            ON emp.Id = ser.EmployeeId
        LEFT JOIN Users pro
            ON pro.Id = ser.ProviderId
        LEFT JOIN Users ast
            ON ast.Id = ser.AssistantUserId
        LEFT JOIN Clinics c
            ON c.Id = ser.ClinicId
        LEFT JOIN Rooms r
            ON r.Id = ser.RoomId
        LEFT JOIN ShiftBuilderRowItems ri
            ON ri.EmployeeShiftId = ser.Id
            AND ri.IsActive = 1
        WHERE (@id IS NULL OR sh.Id = @id)
          AND (@includeInactive = 1 OR sh.IsActive = 1)
          AND (@shiftDate IS NULL OR sh.ShiftDate = @shiftDate)
          AND (@startDate IS NULL OR sh.ShiftDate IS NULL OR sh.ShiftDate >= @startDate)
                    AND (@endDate IS NULL OR sh.ShiftDate IS NULL OR sh.ShiftDate <= @endDate)
                    AND (ser.ClinicId IS NULL OR ${tenantClinicScopeSql('ser.ClinicId')})
        ORDER BY sh.ShiftDate, sh.Id, ser.SortOrder, ser.Id, ri.SortOrder, ri.Id
    `, {
        id: parseIntOrNull(id),
        includeInactive: includeInactive ? 1 : 0,
        shiftDate: toNullableString(shiftDate),
        startDate: toNullableString(startDate),
        endDate: toNullableString(endDate),
        _tenantUserId: tenantUserId
    });

    return mapShiftRowsToHierarchy(result.recordset || []);
}

async function shiftExists(shiftId) {
    const parsedId = parseIntOrNull(shiftId);
    if (!parsedId) return false;
    const result = await execute(`
        SELECT TOP 1 Id
        FROM ShiftBuilderShifts
        WHERE Id = @id
          AND IsActive = 1
    `, { id: parsedId });
    return !!(result.recordset && result.recordset[0] && result.recordset[0].Id);
}

async function employeeRowExists(employeeRowId) {
    const parsedId = parseIntOrNull(employeeRowId);
    if (!parsedId) return false;
    const result = await execute(`
        SELECT TOP 1 Id
        FROM ShiftBuilderEmployeeRows
        WHERE Id = @id
          AND IsActive = 1
    `, { id: parsedId });
    return !!(result.recordset && result.recordset[0] && result.recordset[0].Id);
}

module.exports = async function (context, req) {
    if (req.method === 'OPTIONS') {
        context.res = handleOptions();
        return;
    }

    const entity = String(req.params?.entity || '').trim().toLowerCase();
    const id = parseIntOrNull(req.params?.id);
    const tenantUserId = getRequestUserId(req);
    const tenantClause = `(ser.ClinicId IS NULL OR ${tenantClinicScopeSql('ser.ClinicId')})`;
    const tenantClauseSer2 = `(ser2.ClinicId IS NULL OR ${tenantClinicScopeSql('ser2.ClinicId')})`;

    if (req.method === 'GET' && !tenantUserId) {
        context.res = successResponse(id ? null : []);
        return;
    }

    try {
        if (req.method === 'GET' && entity === 'shifts') {
            const shiftDate = req.query?.get ? req.query.get('shiftDate') : req.query?.shiftDate;
            const startDate = req.query?.get ? req.query.get('startDate') : req.query?.startDate;
            const endDate = req.query?.get ? req.query.get('endDate') : req.query?.endDate;
            const includeInactiveRaw = req.query?.get ? req.query.get('includeInactive') : req.query?.includeInactive;
            const includeInactive = toBitValue(includeInactiveRaw, 0) === 1;

            const shifts = await getShifts({
                id,
                shiftDate,
                startDate,
                endDate,
                includeInactive,
                tenantUserId
            });

            if (id) {
                if (!shifts.length) {
                    context.res = errorResponse('Shift not found', 404);
                    return;
                }
                context.res = successResponse(shifts[0]);
                return;
            }

            context.res = successResponse(shifts);
            return;
        }

        if (req.method === 'GET' && entity === 'employees' && id) {
            const result = await execute(`
                SELECT
                    ser.Id,
                    ser.ShiftId,
                    ser.EmployeeId,
                    ser.RoleId,
                    ser.RoleName,
                    ser.ProviderId,
                    ser.ClinicId,
                    ser.RoomId,
                    ser.AssistantUserId,
                    ser.SortOrder,
                    ser.Notes,
                    ser.CreatedDate,
                    ser.ModifiedDate,
                    emp.FirstName + ' ' + ISNULL(emp.LastName, '') AS EmployeeName,
                    pro.FirstName + ' ' + ISNULL(pro.LastName, '') AS ProviderName,
                    ast.FirstName + ' ' + ISNULL(ast.LastName, '') AS AssistantName,
                    c.Name AS ClinicName,
                    r.Name AS RoomName,
                                        ser.RoleName AS RoleDisplayName
                FROM ShiftBuilderEmployeeRows ser
                LEFT JOIN Users emp ON emp.Id = ser.EmployeeId
                LEFT JOIN Users pro ON pro.Id = ser.ProviderId
                LEFT JOIN Users ast ON ast.Id = ser.AssistantUserId
                LEFT JOIN Clinics c ON c.Id = ser.ClinicId
                LEFT JOIN Rooms r ON r.Id = ser.RoomId
                WHERE ser.Id = @id
                  AND ser.IsActive = 1
                  AND ${tenantClause}
            `, { id, [TENANT_PARAM]: tenantUserId });

            const row = result.recordset?.[0] || null;
            if (!row) {
                context.res = errorResponse('Shift employee row not found', 404);
                return;
            }
            context.res = successResponse(row);
            return;
        }

        if (req.method === 'GET' && entity === 'employees' && !id) {
            const shiftIdRaw = req.query?.get ? req.query.get('shiftId') : req.query?.shiftId;
            const shiftId = parseIntOrNull(shiftIdRaw);
            const includeInactiveRaw = req.query?.get ? req.query.get('includeInactive') : req.query?.includeInactive;
            const includeInactive = toBitValue(includeInactiveRaw, 0) === 1;

            const result = await execute(`
                SELECT
                    ser.Id,
                    ser.ShiftId,
                    ser.EmployeeId,
                    ser.RoleId,
                    ser.RoleName,
                    ser.ProviderId,
                    ser.ClinicId,
                    ser.RoomId,
                    ser.AssistantUserId,
                    ser.SortOrder,
                    ser.Notes,
                    ser.IsActive,
                    ser.CreatedDate,
                    ser.ModifiedDate,
                    emp.FirstName + ' ' + ISNULL(emp.LastName, '') AS EmployeeName,
                    pro.FirstName + ' ' + ISNULL(pro.LastName, '') AS ProviderName,
                    ast.FirstName + ' ' + ISNULL(ast.LastName, '') AS AssistantName,
                    c.Name AS ClinicName,
                    r.Name AS RoomName
                FROM ShiftBuilderEmployeeRows ser
                LEFT JOIN Users emp ON emp.Id = ser.EmployeeId
                LEFT JOIN Users pro ON pro.Id = ser.ProviderId
                LEFT JOIN Users ast ON ast.Id = ser.AssistantUserId
                LEFT JOIN Clinics c ON c.Id = ser.ClinicId
                LEFT JOIN Rooms r ON r.Id = ser.RoomId
                WHERE (@shiftId IS NULL OR ser.ShiftId = @shiftId)
                  AND (@includeInactive = 1 OR ser.IsActive = 1)
                  AND ${tenantClause}
                ORDER BY ser.ShiftId, ser.SortOrder, ser.Id
            `, {
                shiftId,
                includeInactive: includeInactive ? 1 : 0,
                [TENANT_PARAM]: tenantUserId
            });

            context.res = successResponse(result.recordset || []);
            return;
        }

        if (req.method === 'GET' && entity === 'items' && id) {
            const result = await execute(`
                SELECT
                    ri.Id,
                    ri.EmployeeShiftId,
                    ri.ItemType,
                    ri.ItemId,
                    ri.ItemName,
                    ri.PayloadJson,
                    ri.SortOrder,
                    ri.CreatedDate,
                    ri.ModifiedDate
                FROM ShiftBuilderRowItems ri
                INNER JOIN ShiftBuilderEmployeeRows ser2 ON ser2.Id = ri.EmployeeShiftId
                WHERE ri.Id = @id
                  AND ri.IsActive = 1
                  AND ${tenantClauseSer2}
            `, { id, [TENANT_PARAM]: tenantUserId });

            const row = result.recordset?.[0] || null;
            if (!row) {
                context.res = errorResponse('Shift row item not found', 404);
                return;
            }
            context.res = successResponse(row);
            return;
        }

        if (req.method === 'GET' && entity === 'items' && !id) {
            const employeeShiftIdRaw = req.query?.get ? req.query.get('employeeShiftId') : req.query?.employeeShiftId;
            const employeeShiftId = parseIntOrNull(employeeShiftIdRaw);
            const shiftIdRaw = req.query?.get ? req.query.get('shiftId') : req.query?.shiftId;
            const shiftId = parseIntOrNull(shiftIdRaw);
            const includeInactiveRaw = req.query?.get ? req.query.get('includeInactive') : req.query?.includeInactive;
            const includeInactive = toBitValue(includeInactiveRaw, 0) === 1;

            const result = await execute(`
                SELECT
                    ri.Id,
                    ri.EmployeeShiftId,
                    ri.ItemType,
                    ri.ItemId,
                    ri.ItemName,
                    ri.PayloadJson,
                    ri.SortOrder,
                    ri.IsActive,
                    ri.CreatedDate,
                    ri.ModifiedDate,
                    ser.ShiftId
                FROM ShiftBuilderRowItems ri
                INNER JOIN ShiftBuilderEmployeeRows ser
                    ON ser.Id = ri.EmployeeShiftId
                WHERE (@employeeShiftId IS NULL OR ri.EmployeeShiftId = @employeeShiftId)
                  AND (@shiftId IS NULL OR ser.ShiftId = @shiftId)
                  AND (@includeInactive = 1 OR ri.IsActive = 1)
                  AND ${tenantClause}
                ORDER BY ser.ShiftId, ri.EmployeeShiftId, ri.SortOrder, ri.Id
            `, {
                employeeShiftId,
                shiftId,
                includeInactive: includeInactive ? 1 : 0,
                [TENANT_PARAM]: tenantUserId
            });

            context.res = successResponse(result.recordset || []);
            return;
        }

        if (req.method === 'POST' && entity === 'shifts') {
            const body = await readBody(req);
            const result = await execute(`
                INSERT INTO ShiftBuilderShifts (
                    ShiftDate, Title, Status, UseClinicDefaultTime, LinkMainCalendar, LinkMySchedule,
                    Notes, CreatedByUserId
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @shiftDate, @title, @status, @useClinicDefaultTime, @linkMainCalendar, @linkMySchedule,
                    @notes, @createdByUserId
                )
            `, {
                shiftDate: toNullableString(body.shiftDate),
                title: toNullableString(body.title) || 'Open Shift',
                status: toNullableString(body.status) || 'open',
                useClinicDefaultTime: toBitValue(body.useClinicDefaultTime, 1),
                linkMainCalendar: toBitValue(body.linkMainCalendar, 1),
                linkMySchedule: toBitValue(body.linkMySchedule, 1),
                notes: toNullableString(body.notes),
                createdByUserId: parseIntOrNull(body.createdByUserId)
            });

            context.res = successResponse({ id: result.recordset[0].Id }, 201);
            return;
        }

        if (req.method === 'POST' && entity === 'employees') {
            const body = await readBody(req);
            const shiftId = parseIntOrNull(body.shiftId);
            if (!shiftId) {
                context.res = errorResponse('shiftId is required', 400);
                return;
            }

            if (!(await shiftExists(shiftId))) {
                context.res = errorResponse('Shift not found', 404);
                return;
            }

            const result = await execute(`
                INSERT INTO ShiftBuilderEmployeeRows (
                    ShiftId, EmployeeId, RoleId, RoleName, ProviderId, ClinicId,
                    RoomId, AssistantUserId, SortOrder, Notes
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @shiftId, @employeeId, @roleId, @roleName, @providerId, @clinicId,
                    @roomId, @assistantUserId, @sortOrder, @notes
                )
            `, {
                shiftId,
                employeeId: parseIntOrNull(body.employeeId),
                roleId: parseIntOrNull(body.roleId),
                roleName: toNullableString(body.roleName),
                providerId: parseIntOrNull(body.providerId),
                clinicId: parseIntOrNull(body.clinicId),
                roomId: parseIntOrNull(body.roomId),
                assistantUserId: parseIntOrNull(body.assistantUserId),
                sortOrder: Number.parseInt(body.sortOrder, 10) || 0,
                notes: toNullableString(body.notes)
            });

            context.res = successResponse({ id: result.recordset[0].Id }, 201);
            return;
        }

        if (req.method === 'POST' && entity === 'items') {
            const body = await readBody(req);
            const employeeShiftId = parseIntOrNull(body.employeeShiftId);
            const itemType = toNullableString(body.itemType);

            if (!employeeShiftId || !itemType) {
                context.res = errorResponse('employeeShiftId and itemType are required', 400);
                return;
            }

            if (!(await employeeRowExists(employeeShiftId))) {
                context.res = errorResponse('Shift employee row not found', 404);
                return;
            }

            const payloadJson = typeof body.payloadJson === 'string'
                ? body.payloadJson
                : (body.payloadJson ? JSON.stringify(body.payloadJson) : null);

            const result = await execute(`
                INSERT INTO ShiftBuilderRowItems (
                    EmployeeShiftId, ItemType, ItemId, ItemName, PayloadJson, SortOrder
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @employeeShiftId, @itemType, @itemId, @itemName, @payloadJson, @sortOrder
                )
            `, {
                employeeShiftId,
                itemType,
                itemId: parseIntOrNull(body.itemId),
                itemName: toNullableString(body.itemName),
                payloadJson,
                sortOrder: Number.parseInt(body.sortOrder, 10) || 0
            });

            context.res = successResponse({ id: result.recordset[0].Id }, 201);
            return;
        }

        if (req.method === 'PUT' && entity === 'shifts' && id) {
            const body = await readBody(req);

            if (!(await shiftExists(id))) {
                context.res = errorResponse('Shift not found', 404);
                return;
            }

            if (toBitValue(body.moveOnly, 0) === 1 || String(body.updateMode || '').toLowerCase() === 'move-only') {
                if (!hasOwn(body, 'shiftDate')) {
                    context.res = errorResponse('shiftDate is required for move-only updates', 400);
                    return;
                }

                await execute(`
                    UPDATE ShiftBuilderShifts
                    SET ShiftDate = @shiftDate,
                        ModifiedDate = GETUTCDATE()
                    WHERE Id = @id
                `, {
                    id,
                    shiftDate: toNullableString(body.shiftDate)
                });

                context.res = successResponse({ message: 'Shift moved successfully' });
                return;
            }

            const setClauses = [];
            const params = { id };

            if (hasOwn(body, 'shiftDate')) {
                setClauses.push('ShiftDate = @shiftDate');
                params.shiftDate = toNullableString(body.shiftDate);
            }
            if (hasOwn(body, 'title')) {
                setClauses.push('Title = @title');
                params.title = toNullableString(body.title) || 'Open Shift';
            }
            if (hasOwn(body, 'status')) {
                setClauses.push('Status = @status');
                params.status = toNullableString(body.status) || 'open';
            }
            if (hasOwn(body, 'useClinicDefaultTime')) {
                setClauses.push('UseClinicDefaultTime = @useClinicDefaultTime');
                params.useClinicDefaultTime = toBitValue(body.useClinicDefaultTime, 1);
            }
            if (hasOwn(body, 'linkMainCalendar')) {
                setClauses.push('LinkMainCalendar = @linkMainCalendar');
                params.linkMainCalendar = toBitValue(body.linkMainCalendar, 1);
            }
            if (hasOwn(body, 'linkMySchedule')) {
                setClauses.push('LinkMySchedule = @linkMySchedule');
                params.linkMySchedule = toBitValue(body.linkMySchedule, 1);
            }
            if (hasOwn(body, 'notes')) {
                setClauses.push('Notes = @notes');
                params.notes = toNullableString(body.notes);
            }

            if (!setClauses.length) {
                context.res = errorResponse('No fields provided for shift update', 400);
                return;
            }

            setClauses.push('ModifiedDate = GETUTCDATE()');

            await execute(`
                UPDATE ShiftBuilderShifts
                SET ${setClauses.join(', ')}
                WHERE Id = @id
            `, params);

            context.res = successResponse({ message: 'Shift updated successfully' });
            return;
        }

        if (req.method === 'PUT' && entity === 'employees' && id) {
            const body = await readBody(req);

            if (!(await employeeRowExists(id))) {
                context.res = errorResponse('Shift employee row not found', 404);
                return;
            }

            const setClauses = [];
            const params = { id };

            if (hasOwn(body, 'shiftId')) {
                const targetShiftId = parseIntOrNull(body.shiftId);
                if (!targetShiftId || !(await shiftExists(targetShiftId))) {
                    context.res = errorResponse('Target shift not found', 404);
                    return;
                }
                setClauses.push('ShiftId = @shiftId');
                params.shiftId = targetShiftId;
            }
            if (hasOwn(body, 'employeeId')) {
                setClauses.push('EmployeeId = @employeeId');
                params.employeeId = parseIntOrNull(body.employeeId);
            }
            if (hasOwn(body, 'roleId')) {
                setClauses.push('RoleId = @roleId');
                params.roleId = parseIntOrNull(body.roleId);
            }
            if (hasOwn(body, 'roleName')) {
                setClauses.push('RoleName = @roleName');
                params.roleName = toNullableString(body.roleName);
            }
            if (hasOwn(body, 'providerId')) {
                setClauses.push('ProviderId = @providerId');
                params.providerId = parseIntOrNull(body.providerId);
            }
            if (hasOwn(body, 'clinicId')) {
                setClauses.push('ClinicId = @clinicId');
                params.clinicId = parseIntOrNull(body.clinicId);
            }
            if (hasOwn(body, 'roomId')) {
                setClauses.push('RoomId = @roomId');
                params.roomId = parseIntOrNull(body.roomId);
            }
            if (hasOwn(body, 'assistantUserId')) {
                setClauses.push('AssistantUserId = @assistantUserId');
                params.assistantUserId = parseIntOrNull(body.assistantUserId);
            }
            if (hasOwn(body, 'sortOrder')) {
                setClauses.push('SortOrder = @sortOrder');
                params.sortOrder = Number.parseInt(body.sortOrder, 10) || 0;
            }
            if (hasOwn(body, 'notes')) {
                setClauses.push('Notes = @notes');
                params.notes = toNullableString(body.notes);
            }

            if (!setClauses.length) {
                context.res = errorResponse('No fields provided for shift employee update', 400);
                return;
            }

            setClauses.push('ModifiedDate = GETUTCDATE()');

            await execute(`
                UPDATE ShiftBuilderEmployeeRows
                SET ${setClauses.join(', ')}
                WHERE Id = @id
                  AND IsActive = 1
            `, params);

            context.res = successResponse({ message: 'Shift employee row updated successfully' });
            return;
        }

        if (req.method === 'PUT' && entity === 'items' && id) {
            const body = await readBody(req);

            const existingItem = await execute(`
                SELECT TOP 1 Id
                FROM ShiftBuilderRowItems
                WHERE Id = @id
                  AND IsActive = 1
            `, { id });

            if (!(existingItem.recordset && existingItem.recordset[0] && existingItem.recordset[0].Id)) {
                context.res = errorResponse('Shift row item not found', 404);
                return;
            }

            const setClauses = [];
            const params = { id };

            if (hasOwn(body, 'employeeShiftId')) {
                const targetEmployeeShiftId = parseIntOrNull(body.employeeShiftId);
                if (!targetEmployeeShiftId || !(await employeeRowExists(targetEmployeeShiftId))) {
                    context.res = errorResponse('Target shift employee row not found', 404);
                    return;
                }
                setClauses.push('EmployeeShiftId = @employeeShiftId');
                params.employeeShiftId = targetEmployeeShiftId;
            }
            if (hasOwn(body, 'itemType')) {
                setClauses.push('ItemType = @itemType');
                params.itemType = toNullableString(body.itemType);
            }
            if (hasOwn(body, 'itemId')) {
                setClauses.push('ItemId = @itemId');
                params.itemId = parseIntOrNull(body.itemId);
            }
            if (hasOwn(body, 'itemName')) {
                setClauses.push('ItemName = @itemName');
                params.itemName = toNullableString(body.itemName);
            }
            if (hasOwn(body, 'payloadJson')) {
                setClauses.push('PayloadJson = @payloadJson');
                params.payloadJson = typeof body.payloadJson === 'string'
                    ? body.payloadJson
                    : (body.payloadJson ? JSON.stringify(body.payloadJson) : null);
            }
            if (hasOwn(body, 'sortOrder')) {
                setClauses.push('SortOrder = @sortOrder');
                params.sortOrder = Number.parseInt(body.sortOrder, 10) || 0;
            }

            if (!setClauses.length) {
                context.res = errorResponse('No fields provided for shift row item update', 400);
                return;
            }

            setClauses.push('ModifiedDate = GETUTCDATE()');

            await execute(`
                UPDATE ShiftBuilderRowItems
                SET ${setClauses.join(', ')}
                WHERE Id = @id
                  AND IsActive = 1
            `, params);

            context.res = successResponse({ message: 'Shift row item updated successfully' });
            return;
        }

        if (req.method === 'DELETE' && entity === 'shifts' && id) {
            if (!(await shiftExists(id))) {
                context.res = errorResponse('Shift not found', 404);
                return;
            }

            await execute(`
                UPDATE ri
                SET IsActive = 0,
                    ModifiedDate = GETUTCDATE()
                FROM ShiftBuilderRowItems ri
                INNER JOIN ShiftBuilderEmployeeRows ser
                    ON ser.Id = ri.EmployeeShiftId
                WHERE ser.ShiftId = @id
            `, { id });

            await execute(`
                UPDATE ShiftBuilderEmployeeRows
                SET IsActive = 0,
                    ModifiedDate = GETUTCDATE()
                WHERE ShiftId = @id
            `, { id });

            await execute(`
                UPDATE ShiftBuilderShifts
                SET IsActive = 0,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, { id });

            context.res = successResponse({ message: 'Shift deleted successfully' });
            return;
        }

        if (req.method === 'DELETE' && entity === 'employees' && id) {
            if (!(await employeeRowExists(id))) {
                context.res = errorResponse('Shift employee row not found', 404);
                return;
            }

            await execute(`
                UPDATE ShiftBuilderRowItems
                SET IsActive = 0,
                    ModifiedDate = GETUTCDATE()
                WHERE EmployeeShiftId = @id
            `, { id });

            await execute(`
                UPDATE ShiftBuilderEmployeeRows
                SET IsActive = 0,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, { id });

            context.res = successResponse({ message: 'Shift employee row deleted successfully' });
            return;
        }

        if (req.method === 'DELETE' && entity === 'items' && id) {
            const existingItem = await execute(`
                SELECT TOP 1 Id
                FROM ShiftBuilderRowItems
                WHERE Id = @id
                  AND IsActive = 1
            `, { id });

            if (!(existingItem.recordset && existingItem.recordset[0] && existingItem.recordset[0].Id)) {
                context.res = errorResponse('Shift row item not found', 404);
                return;
            }

            await execute(`
                UPDATE ShiftBuilderRowItems
                SET IsActive = 0,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, { id });

            context.res = successResponse({ message: 'Shift row item deleted successfully' });
            return;
        }

        context.res = errorResponse('Route not found', 404);
    } catch (err) {
        context.log.error('Shift Builder API error:', err);
        context.res = errorResponse('Shift Builder API failed', 500, {
            message: err?.message || String(err)
        });
    }
};
