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

async function ensureComplianceTypesTable(pool) {
    await pool.request().query(`
IF OBJECT_ID('dbo.ComplianceTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ComplianceTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        SortOrder INT NOT NULL DEFAULT(0),
        IsActive BIT NOT NULL DEFAULT(1),
        CreatedDate DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
        ModifiedDate DATETIME2 NULL
    );
END

IF NOT EXISTS (SELECT 1 FROM ComplianceTypes)
BEGIN
    INSERT INTO ComplianceTypes (Name, SortOrder) VALUES
    ('CPR Certification', 1),
    ('BLS Certification', 2),
    ('HIPAA Training', 3),
    ('OSHA Training', 4),
    ('Infection Control', 5),
    ('DEA License', 6),
    ('State Dental License', 7),
    ('Malpractice Insurance', 8),
    ('Business License', 9),
    ('Fire Safety Inspection', 10),
    ('X-Ray Machine Registration', 11),
    ('Waste Disposal License', 12),
    ('Water Quality Test', 13),
    ('HVAC Maintenance', 14);
END
`);
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
        await ensureComplianceTypesTable(pool);

        const id = req.params.id ? Number.parseInt(req.params.id, 10) : null;

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM ComplianceTypes WHERE Id = @id AND IsActive = 1');

                context.res = {
                    status: result.recordset.length ? 200 : 404,
                    headers,
                    body: result.recordset.length ? result.recordset[0] : { error: 'Compliance type not found' }
                };
                return;
            }

            const result = await pool.request()
                .query('SELECT * FROM ComplianceTypes WHERE IsActive = 1 ORDER BY SortOrder, Name');
            context.res = { status: 200, headers, body: result.recordset };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const result = await pool.request()
                .input('name', sql.NVarChar(200), body.name || '')
                .input('sortOrder', sql.Int, Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0)
                .query('INSERT INTO ComplianceTypes (Name, SortOrder) OUTPUT INSERTED.* VALUES (@name, @sortOrder)');

            context.res = { status: 201, headers, body: result.recordset[0] };
            return;
        }

        if (req.method === 'PUT' && id) {
            const body = req.body || {};
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar(200), body.name || '')
                .input('sortOrder', sql.Int, Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0)
                .input('isActive', sql.Bit, body.isActive === false ? 0 : 1)
                .query('UPDATE ComplianceTypes SET Name=@name, SortOrder=@sortOrder, IsActive=@isActive, ModifiedDate=SYSUTCDATETIME() WHERE Id=@id');

            context.res = { status: 200, headers, body: { message: 'Compliance type updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE ComplianceTypes SET IsActive = 0, ModifiedDate = SYSUTCDATETIME() WHERE Id = @id');

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
