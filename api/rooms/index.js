const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
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
        const pool = await getPool();
        const roomColumns = await getTableColumns(pool, 'Rooms');
        if (roomColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Rooms table not found.' } };
            return;
        }

        const clinicColumns = await getTableColumns(pool, 'Clinics');
        const hasClinicCol = hasColumn(roomColumns, 'ClinicId');
        const hasClinicJoin = hasClinicCol && hasColumn(clinicColumns, 'Id') && hasColumn(clinicColumns, 'Name');
        const hasRoomIsActive = hasColumn(roomColumns, 'IsActive');
        const hasClinicIsActive = hasColumn(clinicColumns, 'IsActive');
        const roomOrder = hasColumn(roomColumns, 'Name') ? 'r.Name' : 'r.Id';
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
                    query = `SELECT * FROM Rooms WHERE ${where.join(' AND ')} ORDER BY ${hasColumn(roomColumns, 'Name') ? 'Name' : 'Id'}`;
                } else {
                    const whereClause = hasRoomIsActive ? 'WHERE IsActive = 1' : '';
                    query = `SELECT * FROM Rooms ${whereClause} ORDER BY ${hasColumn(roomColumns, 'Name') ? 'Name' : 'Id'}`;
                }

                const result = await reqBuilder.query(query);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('clinicId', sql.Int, body.clinicId)
                .input('roomType', sql.NVarChar, body.roomType)
                .input('description', sql.NVarChar, body.description)
                .input('color', sql.NVarChar, body.color)
                .query(`INSERT INTO Rooms (Name, ClinicId, RoomType, Description, Color) 
                        OUTPUT INSERTED.Id VALUES (@name, @clinicId, @roomType, @description, @color)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('roomType', sql.NVarChar, body.roomType)
                .input('description', sql.NVarChar, body.description)
                .input('color', sql.NVarChar, body.color)
                .query(`UPDATE Rooms SET Name=@name, RoomType=@roomType, Description=@description, Color=@color, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Room updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Rooms SET IsActive = 0 WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Room deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
