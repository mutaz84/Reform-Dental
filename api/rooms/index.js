const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, getUserClinicIds, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function toIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function bodyValue(obj, names, fallback = '') {
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(obj || {}, name)) return obj[name];
    }
    return fallback;
}

async function linkUserToClinicIfPossible(pool, userId, clinicId) {
    const safeUserId = toIntOrNull(userId);
    const safeClinicId = toIntOrNull(clinicId);
    if (!safeUserId || !safeClinicId) return;

    const userClinicColumns = await getTableColumns(pool, 'UserClinics');
    if (!hasColumn(userClinicColumns, 'UserId') || !hasColumn(userClinicColumns, 'ClinicId')) return;

    try {
        await pool.request()
            .input('userId', sql.Int, safeUserId)
            .input('clinicId', sql.Int, safeClinicId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM UserClinics WHERE UserId = @userId AND ClinicId = @clinicId)
                BEGIN
                    INSERT INTO UserClinics (UserId, ClinicId) VALUES (@userId, @clinicId)
                END
            `);
    } catch (_) {
        // Room saving can still proceed for platform admin or unscoped fallback rows.
    }
}

async function createLocalClinicFromRoomPayload(pool, clinicName, tenantUserId) {
    const name = String(clinicName || '').trim();
    if (!name) return null;

    const clinicColumns = await getTableColumns(pool, 'Clinics');
    if (!hasColumn(clinicColumns, 'Name')) return null;

    const request = pool.request().input('name', sql.NVarChar, name);
    const columns = ['Name'];
    const values = ['@name'];
    if (hasColumn(clinicColumns, 'IsActive')) {
        columns.push('IsActive');
        values.push('1');
    }
    if (hasColumn(clinicColumns, 'CreatedDate')) {
        columns.push('CreatedDate');
        values.push('GETUTCDATE()');
    }

    const result = await request.query(`INSERT INTO Clinics (${columns.join(', ')}) OUTPUT INSERTED.Id VALUES (${values.join(', ')})`);
    const clinicId = result.recordset[0]?.Id || null;
    await linkUserToClinicIfPossible(pool, tenantUserId, clinicId);
    return clinicId;
}

async function resolveRoomClinicId(pool, body, tenantUserId) {
    const requestedClinicId = toIntOrNull(body?.clinicId ?? body?.ClinicId ?? body?.officeID ?? body?.officeId);
    if (requestedClinicId) {
        const exact = await pool.request()
            .input('clinicId', sql.Int, requestedClinicId)
            .query('SELECT TOP 1 Id FROM Clinics WHERE Id = @clinicId');
        if (exact.recordset[0]?.Id) return exact.recordset[0].Id;
    }

    const clinicName = String(body?.clinicName || body?.ClinicName || body?.officeName || body?.OfficeName || '').trim();
    if (clinicName) {
        const request = pool.request().input('clinicName', sql.NVarChar, clinicName);
        const where = ['LOWER(Name) = LOWER(@clinicName)'];
        if (tenantUserId) {
            request.input(TENANT_PARAM, sql.Int, tenantUserId);
            where.push(tenantClinicScopeSql('Id'));
        }
        const byName = await request.query(`SELECT TOP 1 Id FROM Clinics WHERE ${where.join(' AND ')} ORDER BY Id`);
        if (byName.recordset[0]?.Id) return byName.recordset[0].Id;

        const anyByName = await pool.request()
            .input('clinicName', sql.NVarChar, clinicName)
            .query('SELECT TOP 1 Id FROM Clinics WHERE LOWER(Name) = LOWER(@clinicName) ORDER BY Id');
        if (anyByName.recordset[0]?.Id) {
            await linkUserToClinicIfPossible(pool, tenantUserId, anyByName.recordset[0].Id);
            return anyByName.recordset[0].Id;
        }
    }

    const visibleClinicIds = await getUserClinicIds(pool, tenantUserId);
    if (visibleClinicIds.length === 1) return visibleClinicIds[0];
    return createLocalClinicFromRoomPayload(pool, clinicName, tenantUserId);
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        const roomColumns = await getTableColumns(pool, 'Rooms');
        if (roomColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Rooms table not found.' } };
            return;
        }
        if (!hasColumn(roomColumns, 'SortOrder')) {
            try {
                await pool.request().query('ALTER TABLE Rooms ADD SortOrder INT NULL');
                roomColumns.add('sortorder');
            } catch (_) {}
        }
        const hasSortOrder = hasColumn(roomColumns, 'SortOrder');

        const clinicColumns = await getTableColumns(pool, 'Clinics');
        const hasClinicCol = hasColumn(roomColumns, 'ClinicId');
        const hasClinicJoin = hasClinicCol && hasColumn(clinicColumns, 'Id') && hasColumn(clinicColumns, 'Name');
        const hasRoomIsActive = hasColumn(roomColumns, 'IsActive');
        const hasClinicIsActive = hasColumn(clinicColumns, 'IsActive');
        const roomOrder = hasSortOrder
            ? `CASE WHEN r.SortOrder IS NULL THEN 1 ELSE 0 END, r.SortOrder, ${hasColumn(roomColumns, 'Name') ? 'r.Name' : 'r.Id'}`
            : (hasColumn(roomColumns, 'Name') ? 'r.Name' : 'r.Id');
        const id = req.params.id;
        const tenantUserId = getRequestUserId(req);

        if (req.method === 'GET') {
            if (hasClinicCol && !tenantUserId) {
                context.res = { status: 200, headers, body: id ? null : [] };
                return;
            }
            if (id) {
                const where = ['Id = @id'];
                if (hasRoomIsActive) {
                    where.push('IsActive = 1');
                }
                if (hasClinicCol) {
                    where.push(tenantClinicScopeSql('ClinicId'));
                }
                const reqBuilder = pool.request().input('id', sql.Int, id);
                if (hasClinicCol) reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                const result = await reqBuilder.query(`SELECT * FROM Rooms WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                let query;
                const reqBuilder = pool.request();
                if (hasClinicJoin) {
                    const where = [];
                    if (hasRoomIsActive) {
                        where.push('r.IsActive = 1');
                    }
                    if (hasClinicIsActive) {
                        where.push('(c.IsActive = 1 OR c.Id IS NULL)');
                    }
                    where.push(tenantClinicScopeSql('r.ClinicId'));
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    const whereClause = `WHERE ${where.join(' AND ')}`;
                    query = `SELECT r.*, c.Name as ClinicName FROM Rooms r LEFT JOIN Clinics c ON r.ClinicId = c.Id ${whereClause} ORDER BY c.Name, ${roomOrder}`;
                } else if (hasClinicCol) {
                    const where = [];
                    if (hasRoomIsActive) where.push('IsActive = 1');
                    where.push(tenantClinicScopeSql('ClinicId'));
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    query = `SELECT * FROM Rooms WHERE ${where.join(' AND ')} ORDER BY ${hasSortOrder ? 'CASE WHEN SortOrder IS NULL THEN 1 ELSE 0 END, SortOrder, ' : ''}${hasColumn(roomColumns, 'Name') ? 'Name' : 'Id'}`;
                } else {
                    const whereClause = hasRoomIsActive ? 'WHERE IsActive = 1' : '';
                    query = `SELECT * FROM Rooms ${whereClause} ORDER BY ${hasSortOrder ? 'CASE WHEN SortOrder IS NULL THEN 1 ELSE 0 END, SortOrder, ' : ''}${hasColumn(roomColumns, 'Name') ? 'Name' : 'Id'}`;
                }

                const result = await reqBuilder.query(query);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const clinicId = hasClinicCol ? await resolveRoomClinicId(pool, body, tenantUserId) : null;
            if (hasClinicCol && !clinicId) {
                context.res = { status: 400, headers, body: { error: 'Selected clinic could not be matched to a local clinic record. Please refresh clinics and try again.' } };
                return;
            }
            const insertColumns = ['Name', 'ClinicId', 'RoomType', 'Description', 'Color'];
            const insertValues = ['@name', '@clinicId', '@roomType', '@description', '@color'];
            if (hasColumn(roomColumns, 'RoomCategory')) {
                insertColumns.push('RoomCategory');
                insertValues.push('@roomCategory');
            }
            if (hasColumn(roomColumns, 'Category')) {
                insertColumns.push('Category');
                insertValues.push('@roomCategory');
            }
            if (hasSortOrder) {
                insertColumns.push('SortOrder');
                insertValues.push('COALESCE(@sortOrder, (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM Rooms WHERE ClinicId = @clinicId))');
            }
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('clinicId', sql.Int, clinicId)
                .input('roomType', sql.NVarChar, body.roomType)
                .input('roomCategory', sql.NVarChar, bodyValue(body, ['roomCategory', 'RoomCategory', 'category', 'Category'], ''))
                .input('description', sql.NVarChar, body.description)
                .input('color', sql.NVarChar, body.color)
                .input('sortOrder', sql.Int, toIntOrNull(body.sortOrder ?? body.SortOrder))
                .query(`INSERT INTO Rooms (${insertColumns.join(', ')}) OUTPUT INSERTED.Id VALUES (${insertValues.join(', ')})`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            const setClauses = ['Name=@name', 'RoomType=@roomType', 'Description=@description', 'Color=@color', 'ModifiedDate=GETUTCDATE()'];
            if (hasColumn(roomColumns, 'RoomCategory')) {
                setClauses.push('RoomCategory=@roomCategory');
            }
            if (hasColumn(roomColumns, 'Category')) {
                setClauses.push('Category=@roomCategory');
            }
            if (hasSortOrder && (body.sortOrder !== undefined || body.SortOrder !== undefined)) {
                setClauses.push('SortOrder=@sortOrder');
            }
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('roomType', sql.NVarChar, body.roomType)
                .input('roomCategory', sql.NVarChar, bodyValue(body, ['roomCategory', 'RoomCategory', 'category', 'Category'], ''))
                .input('description', sql.NVarChar, body.description)
                .input('color', sql.NVarChar, body.color)
                .input('sortOrder', sql.Int, toIntOrNull(body.sortOrder ?? body.SortOrder))
                .query(`UPDATE Rooms SET ${setClauses.join(', ')} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Room updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query(hasRoomIsActive ? 'UPDATE Rooms SET IsActive = 0 WHERE Id = @id' : 'DELETE FROM Rooms WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Room deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
