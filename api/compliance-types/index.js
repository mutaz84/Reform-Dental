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

    return {
        server: process.env.SQL_SERVER || '',
        database: process.env.SQL_DATABASE || '',
        user: process.env.SQL_USER || '',
        password: process.env.SQL_PASSWORD || '',
        options: { encrypt: true, trustServerCertificate: false }
    };
}

const DEFAULT_TYPES = [
    { Id: 1, Name: 'CPR Certification', SortOrder: 1 },
    { Id: 2, Name: 'BLS Certification', SortOrder: 2 },
    { Id: 3, Name: 'HIPAA Training', SortOrder: 3 },
    { Id: 4, Name: 'OSHA Training', SortOrder: 4 },
    { Id: 5, Name: 'Infection Control', SortOrder: 5 },
    { Id: 6, Name: 'DEA License', SortOrder: 6 },
    { Id: 7, Name: 'State Dental License', SortOrder: 7 },
    { Id: 8, Name: 'Malpractice Insurance', SortOrder: 8 },
    { Id: 9, Name: 'Business License', SortOrder: 9 },
    { Id: 10, Name: 'Fire Safety Inspection', SortOrder: 10 },
    { Id: 11, Name: 'X-Ray Machine Registration', SortOrder: 11 },
    { Id: 12, Name: 'Waste Disposal License', SortOrder: 12 },
    { Id: 13, Name: 'Water Quality Test', SortOrder: 13 },
    { Id: 14, Name: 'HVAC Maintenance', SortOrder: 14 }
];

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query(`
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = @tableName`);

    return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function normalizeTypeRecord(row) {
    if (!row || typeof row !== 'object') {
        return row;
    }

    return {
        ...row,
        id: row.id ?? row.Id,
        name: row.name ?? row.Name,
        sortOrder: row.sortOrder ?? row.SortOrder,
        isActive: row.isActive ?? row.IsActive
    };
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    let pool;
    try {
        pool = await sql.connect(getConfig());

        const typeColumns = await getTableColumns(pool, 'ComplianceTypes');
        const hasTypesTable = typeColumns.size > 0;

        const id = req.params.id ? Number.parseInt(req.params.id, 10) : null;

        if (req.method === 'GET') {
            if (!hasTypesTable) {
                context.res = { status: 200, headers, body: DEFAULT_TYPES.map(normalizeTypeRecord) };
                return;
            }

            const hasIsActive = hasColumn(typeColumns, 'IsActive');
            const whereActive = hasIsActive ? ' AND IsActive = 1' : '';

            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT * FROM ComplianceTypes WHERE Id = @id${whereActive}`);

                context.res = {
                    status: result.recordset.length ? 200 : 404,
                    headers,
                    body: result.recordset.length ? normalizeTypeRecord(result.recordset[0]) : { error: 'Compliance type not found' }
                };
                return;
            }

            const result = await pool.request()
                .query(`SELECT * FROM ComplianceTypes ${hasIsActive ? 'WHERE IsActive = 1' : ''} ORDER BY ${hasColumn(typeColumns, 'SortOrder') ? 'SortOrder, ' : ''}Name`);
            context.res = { status: 200, headers, body: (result.recordset || []).map(normalizeTypeRecord) };
            return;
        }

        if (req.method === 'POST') {
            if (!hasTypesTable) {
                context.res = { status: 501, headers, body: { error: 'ComplianceTypes table does not exist in database.' } };
                return;
            }
            const body = req.body || {};
            const request = pool.request()
                .input('name', sql.NVarChar(200), body.name || '')
                .input('sortOrder', sql.Int, Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0);

            if (hasColumn(typeColumns, 'Category')) {
                request.input('category', sql.NVarChar(100), body.category || 'General');
            }

            const insertColumns = ['Name'];
            const insertValues = ['@name'];
            if (hasColumn(typeColumns, 'Category')) {
                insertColumns.push('Category');
                insertValues.push('@category');
            }
            if (hasColumn(typeColumns, 'SortOrder')) {
                insertColumns.push('SortOrder');
                insertValues.push('@sortOrder');
            }

            const result = await request.query(`
INSERT INTO ComplianceTypes (${insertColumns.join(', ')})
OUTPUT INSERTED.*
VALUES (${insertValues.join(', ')})`);

            context.res = { status: 201, headers, body: normalizeTypeRecord(result.recordset[0]) };
            return;
        }

        if (req.method === 'PUT' && id) {
            if (!hasTypesTable) {
                context.res = { status: 501, headers, body: { error: 'ComplianceTypes table does not exist in database.' } };
                return;
            }
            const body = req.body || {};
            const request = pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar(200), body.name || '');

            const updates = ['Name=@name'];
            if (hasColumn(typeColumns, 'Category')) {
                request.input('category', sql.NVarChar(100), body.category || 'General');
                updates.push('Category=@category');
            }
            if (hasColumn(typeColumns, 'SortOrder')) {
                request.input('sortOrder', sql.Int, Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0);
                updates.push('SortOrder=@sortOrder');
            }
            if (hasColumn(typeColumns, 'IsActive')) {
                request.input('isActive', sql.Bit, body.isActive === false ? 0 : 1);
                updates.push('IsActive=@isActive');
            }
            if (hasColumn(typeColumns, 'ModifiedDate')) {
                updates.push('ModifiedDate=SYSUTCDATETIME()');
            }

            await request.query(`UPDATE ComplianceTypes SET ${updates.join(', ')} WHERE Id=@id`);

            context.res = { status: 200, headers, body: { message: 'Compliance type updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            if (!hasTypesTable) {
                context.res = { status: 501, headers, body: { error: 'ComplianceTypes table does not exist in database.' } };
                return;
            }

            const request = pool.request().input('id', sql.Int, id);
            if (hasColumn(typeColumns, 'IsActive')) {
                const setParts = ['IsActive = 0'];
                if (hasColumn(typeColumns, 'ModifiedDate')) {
                    setParts.push('ModifiedDate = SYSUTCDATETIME()');
                }
                await request.query(`UPDATE ComplianceTypes SET ${setParts.join(', ')} WHERE Id = @id`);
            } else {
                await request.query('DELETE FROM ComplianceTypes WHERE Id = @id');
            }

            context.res = { status: 200, headers, body: { message: 'Compliance type deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Compliance type API error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
