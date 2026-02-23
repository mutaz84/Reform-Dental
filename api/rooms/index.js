const sql = require('mssql');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=tcp:([^,]+)/i);
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
    return {
        server: process.env.SQL_SERVER || '',
        database: process.env.SQL_DATABASE || '',
        user: process.env.SQL_USER || '',
        password: process.env.SQL_PASSWORD || '',
        options: { encrypt: true, trustServerCertificate: false }
    };
}

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
        const pool = await sql.connect(getConfig());
        const roomColumns = await getTableColumns(pool, 'Rooms');
        if (roomColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Rooms table not found.' } };
            return;
        }

        const clinicColumns = await getTableColumns(pool, 'Clinics');
        const hasClinicJoin = hasColumn(roomColumns, 'ClinicId') && hasColumn(clinicColumns, 'Id') && hasColumn(clinicColumns, 'Name');
        const hasRoomIsActive = hasColumn(roomColumns, 'IsActive');
        const hasClinicIsActive = hasColumn(clinicColumns, 'IsActive');
        const roomOrder = hasColumn(roomColumns, 'Name') ? 'r.Name' : 'r.Id';
        const id = req.params.id;

        if (req.method === 'GET') {
            if (id) {
                const where = ['Id = @id'];
                if (hasRoomIsActive) {
                    where.push('IsActive = 1');
                }
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT * FROM Rooms WHERE ${where.join(' AND ')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                let query;
                if (hasClinicJoin) {
                    const where = [];
                    if (hasRoomIsActive) {
                        where.push('r.IsActive = 1');
                    }
                    if (hasClinicIsActive) {
                        where.push('(c.IsActive = 1 OR c.Id IS NULL)');
                    }
                    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
                    query = `SELECT r.*, c.Name as ClinicName FROM Rooms r LEFT JOIN Clinics c ON r.ClinicId = c.Id ${whereClause} ORDER BY c.Name, ${roomOrder}`;
                } else {
                    const whereClause = hasRoomIsActive ? 'WHERE IsActive = 1' : '';
                    query = `SELECT * FROM Rooms ${whereClause} ORDER BY ${hasColumn(roomColumns, 'Name') ? 'Name' : 'Id'}`;
                }

                const result = await pool.request().query(query);
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

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
