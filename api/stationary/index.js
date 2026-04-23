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

function toNullableInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function cleanString(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function serializeElements(elements) {
    if (typeof elements === 'string') {
        return elements;
    }
    if (Array.isArray(elements)) {
        return JSON.stringify(elements);
    }
    return '[]';
}

function parseElements(value) {
    if (!value) return [];
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

async function ensureTable(pool) {
    await pool.request().query(`
IF OBJECT_ID(N'dbo.StationaryTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StationaryTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TemplateKey NVARCHAR(120) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        HeaderLine1 NVARCHAR(MAX) NULL,
        HeaderLine2 NVARCHAR(MAX) NULL,
        FooterText NVARCHAR(MAX) NULL,
        Elements NVARCHAR(MAX) NULL,
        ClinicId INT NULL,
        OwnerUsername NVARCHAR(100) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END

IF COL_LENGTH('dbo.StationaryTemplates', 'TemplateKey') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD TemplateKey NVARCHAR(150) NOT NULL CONSTRAINT DF_StationaryTemplates_TemplateKey DEFAULT ('default');

IF COL_LENGTH('dbo.StationaryTemplates', 'Name') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD Name NVARCHAR(255) NOT NULL CONSTRAINT DF_StationaryTemplates_Name DEFAULT ('Untitled Form');

IF COL_LENGTH('dbo.StationaryTemplates', 'HeaderLine1') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD HeaderLine1 NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'HeaderLine2') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD HeaderLine2 NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'FooterText') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD FooterText NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'Elements') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD Elements NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'ClinicId') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD ClinicId INT NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'OwnerUsername') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD OwnerUsername NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'IsActive') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD IsActive BIT NOT NULL CONSTRAINT DF_StationaryTemplates_IsActive DEFAULT (1);

IF COL_LENGTH('dbo.StationaryTemplates', 'CreatedDate') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_StationaryTemplates_CreatedDate DEFAULT (GETUTCDATE());

IF COL_LENGTH('dbo.StationaryTemplates', 'ModifiedDate') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_StationaryTemplates_ModifiedDate DEFAULT (GETUTCDATE());

IF COL_LENGTH('dbo.StationaryTemplates', 'TemplateName') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD TemplateName NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.StationaryTemplates', 'TemplateJson') IS NULL
    ALTER TABLE dbo.StationaryTemplates ADD TemplateJson NVARCHAR(MAX) NULL;

UPDATE dbo.StationaryTemplates
SET Name = COALESCE(NULLIF(Name, ''), NULLIF(TemplateName, ''), 'Untitled Form')
WHERE Name IS NULL OR LTRIM(RTRIM(Name)) = '';

UPDATE dbo.StationaryTemplates
SET Elements = COALESCE(NULLIF(Elements, ''), NULLIF(TemplateJson, ''), '[]')
WHERE Elements IS NULL OR LTRIM(RTRIM(Elements)) = '';
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
        await ensureTable(pool);

        const routeId = cleanString(req.params?.id || '');

        if (req.method === 'GET') {
            if (routeId) {
                const byNumericId = /^\d+$/.test(routeId);
                const result = byNumericId
                    ? await pool.request()
                        .input('id', sql.Int, Number.parseInt(routeId, 10))
                        .query(`
SELECT Id, TemplateKey,
       COALESCE(NULLIF(Name, ''), NULLIF(TemplateName, ''), 'Untitled Form') AS Name,
       HeaderLine1, HeaderLine2, FooterText,
       COALESCE(NULLIF(Elements, ''), NULLIF(TemplateJson, ''), '[]') AS Elements,
       ClinicId, OwnerUsername, CreatedDate, ModifiedDate
FROM dbo.StationaryTemplates
WHERE Id = @id AND IsActive = 1`)
                    : await pool.request()
                        .input('templateKey', sql.NVarChar(120), routeId)
                        .query(`
SELECT Id, TemplateKey,
       COALESCE(NULLIF(Name, ''), NULLIF(TemplateName, ''), 'Untitled Form') AS Name,
       HeaderLine1, HeaderLine2, FooterText,
       COALESCE(NULLIF(Elements, ''), NULLIF(TemplateJson, ''), '[]') AS Elements,
       ClinicId, OwnerUsername, CreatedDate, ModifiedDate
FROM dbo.StationaryTemplates
WHERE TemplateKey = @templateKey AND IsActive = 1`);

                const row = result.recordset?.[0] || null;
                context.res = {
                    status: 200,
                    headers,
                    body: row ? {
                        id: row.Id,
                        templateKey: row.TemplateKey,
                        name: row.Name,
                        headerLine1: row.HeaderLine1 || '',
                        headerLine2: row.HeaderLine2 || '',
                        footerText: row.FooterText || '',
                        elements: parseElements(row.Elements),
                        clinicId: row.ClinicId,
                        ownerUsername: row.OwnerUsername || '',
                        createdDate: row.CreatedDate,
                        modifiedDate: row.ModifiedDate
                    } : null
                };
                return;
            }

            const clinicId = toNullableInt(req.query?.clinicId);
            const owner = cleanString(req.query?.owner || '');

            const whereParts = ['IsActive = 1'];
            const request = pool.request();

            if (Number.isInteger(clinicId)) {
                whereParts.push('ClinicId = @clinicId');
                request.input('clinicId', sql.Int, clinicId);
            }

            if (owner) {
                whereParts.push('(OwnerUsername = @owner OR OwnerUsername IS NULL OR OwnerUsername = \'\')');
                request.input('owner', sql.NVarChar(100), owner);
            }

            const result = await request.query(`
SELECT Id, TemplateKey,
       COALESCE(NULLIF(Name, ''), NULLIF(TemplateName, ''), 'Untitled Form') AS Name,
       HeaderLine1, HeaderLine2, FooterText,
       COALESCE(NULLIF(Elements, ''), NULLIF(TemplateJson, ''), '[]') AS Elements,
       ClinicId, OwnerUsername, CreatedDate, ModifiedDate
FROM dbo.StationaryTemplates
WHERE ${whereParts.join(' AND ')}
ORDER BY ModifiedDate DESC, Id DESC`);

            context.res = {
                status: 200,
                headers,
                body: (result.recordset || []).map((row) => ({
                    id: row.Id,
                    templateKey: row.TemplateKey,
                    name: row.Name,
                    headerLine1: row.HeaderLine1 || '',
                    headerLine2: row.HeaderLine2 || '',
                    footerText: row.FooterText || '',
                    elements: parseElements(row.Elements),
                    clinicId: row.ClinicId,
                    ownerUsername: row.OwnerUsername || '',
                    createdDate: row.CreatedDate,
                    modifiedDate: row.ModifiedDate
                }))
            };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const templateKey = cleanString(body.templateKey || body.id);
            const name = cleanString(body.name || 'Untitled Form', 'Untitled Form');
            const headerLine1 = cleanString(body.headerLine1 || '');
            const headerLine2 = cleanString(body.headerLine2 || '');
            const footerText = cleanString(body.footerText || '');
            const elements = serializeElements(body.elements);
            const clinicId = toNullableInt(body.clinicId);
            const ownerUsername = cleanString(body.ownerUsername || '');

            if (!templateKey) {
                context.res = { status: 400, headers, body: { error: 'templateKey is required.' } };
                return;
            }

            const existing = await pool.request()
                .input('templateKey', sql.NVarChar(120), templateKey)
                .query('SELECT Id FROM dbo.StationaryTemplates WHERE TemplateKey = @templateKey');

            if (existing.recordset?.length) {
                const existingId = existing.recordset[0].Id;
                await pool.request()
                    .input('id', sql.Int, existingId)
                    .input('name', sql.NVarChar(255), name)
                    .input('headerLine1', sql.NVarChar(sql.MAX), headerLine1)
                    .input('headerLine2', sql.NVarChar(sql.MAX), headerLine2)
                    .input('footerText', sql.NVarChar(sql.MAX), footerText)
                    .input('elements', sql.NVarChar(sql.MAX), elements)
                    .input('clinicId', sql.Int, clinicId)
                    .input('ownerUsername', sql.NVarChar(100), ownerUsername || null)
                    .query(`
UPDATE dbo.StationaryTemplates
SET Name = @name,
    TemplateName = @name,
    HeaderLine1 = @headerLine1,
    HeaderLine2 = @headerLine2,
    FooterText = @footerText,
    Elements = @elements,
    TemplateJson = @elements,
    ClinicId = @clinicId,
    OwnerUsername = @ownerUsername,
    IsActive = 1,
    ModifiedDate = GETUTCDATE()
WHERE Id = @id`);

                context.res = { status: 200, headers, body: { id: existingId, templateKey, updated: true } };
                return;
            }

            const inserted = await pool.request()
                .input('templateKey', sql.NVarChar(120), templateKey)
                .input('name', sql.NVarChar(255), name)
                .input('headerLine1', sql.NVarChar(sql.MAX), headerLine1)
                .input('headerLine2', sql.NVarChar(sql.MAX), headerLine2)
                .input('footerText', sql.NVarChar(sql.MAX), footerText)
                .input('elements', sql.NVarChar(sql.MAX), elements)
                .input('clinicId', sql.Int, clinicId)
                .input('ownerUsername', sql.NVarChar(100), ownerUsername || null)
                .query(`
INSERT INTO dbo.StationaryTemplates (TemplateKey, Name, TemplateName, HeaderLine1, HeaderLine2, FooterText, Elements, TemplateJson, ClinicId, OwnerUsername)
OUTPUT INSERTED.Id
VALUES (@templateKey, @name, @name, @headerLine1, @headerLine2, @footerText, @elements, @elements, @clinicId, @ownerUsername)`);

            context.res = {
                status: 201,
                headers,
                body: { id: inserted.recordset?.[0]?.Id || null, templateKey, created: true }
            };
            return;
        }

        if (req.method === 'PUT' && routeId) {
            const body = req.body || {};
            const name = cleanString(body.name || 'Untitled Form', 'Untitled Form');
            const headerLine1 = cleanString(body.headerLine1 || '');
            const headerLine2 = cleanString(body.headerLine2 || '');
            const footerText = cleanString(body.footerText || '');
            const elements = serializeElements(body.elements);
            const clinicId = toNullableInt(body.clinicId);
            const ownerUsername = cleanString(body.ownerUsername || '');

            const byNumericId = /^\d+$/.test(routeId);
            const request = pool.request()
                .input('name', sql.NVarChar(255), name)
                .input('headerLine1', sql.NVarChar(sql.MAX), headerLine1)
                .input('headerLine2', sql.NVarChar(sql.MAX), headerLine2)
                .input('footerText', sql.NVarChar(sql.MAX), footerText)
                .input('elements', sql.NVarChar(sql.MAX), elements)
                .input('clinicId', sql.Int, clinicId)
                .input('ownerUsername', sql.NVarChar(100), ownerUsername || null);

            if (byNumericId) {
                request.input('id', sql.Int, Number.parseInt(routeId, 10));
            } else {
                request.input('templateKey', sql.NVarChar(120), routeId);
            }

            await request.query(`
UPDATE dbo.StationaryTemplates
SET Name = @name,
    TemplateName = @name,
    HeaderLine1 = @headerLine1,
    HeaderLine2 = @headerLine2,
    FooterText = @footerText,
    Elements = @elements,
    TemplateJson = @elements,
    ClinicId = @clinicId,
    OwnerUsername = @ownerUsername,
    IsActive = 1,
    ModifiedDate = GETUTCDATE()
WHERE ${byNumericId ? 'Id = @id' : 'TemplateKey = @templateKey'}
`);

            context.res = { status: 200, headers, body: { updated: true } };
            return;
        }

        if (req.method === 'DELETE') {
            const templateKey = cleanString(routeId || req.query?.templateKey || req.body?.templateKey || '');
            if (!templateKey) {
                context.res = { status: 400, headers, body: { error: 'template identifier is required.' } };
                return;
            }

            const byNumericId = /^\d+$/.test(templateKey);
            const request = pool.request();
            if (byNumericId) {
                request.input('id', sql.Int, Number.parseInt(templateKey, 10));
            } else {
                request.input('templateKey', sql.NVarChar(120), templateKey);
            }

            await request.query(`
UPDATE dbo.StationaryTemplates
SET IsActive = 0,
    ModifiedDate = GETUTCDATE()
WHERE ${byNumericId ? 'Id = @id' : 'TemplateKey = @templateKey'}
`);

            context.res = { status: 200, headers, body: { deleted: true } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (error) {
        context.log.error('Stationary API error:', error);
        context.res = {
            status: 500,
            headers,
            body: { error: error?.message || 'Unexpected Stationary API error.' }
        };
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (_) {}
        }
    }
};
