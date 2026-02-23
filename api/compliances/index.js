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

async function ensureComplianceTables(pool) {
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

IF OBJECT_ID('dbo.Compliances', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Compliances (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        ComplianceTypeId INT NULL,
        Description NVARCHAR(MAX) NULL,
        UserId INT NULL,
        ClinicId INT NULL,
        IssueDate DATE NULL,
        ExpiryDate DATE NULL,
        ReminderDate DATE NULL,
        Status NVARCHAR(50) NULL,
        AttachmentData NVARCHAR(MAX) NULL,
        AttachmentName NVARCHAR(255) NULL,
        AttachmentType NVARCHAR(255) NULL,
        DocumentType NVARCHAR(255) NULL,
        ReferenceNumber NVARCHAR(255) NULL,
        IssuingAuthority NVARCHAR(255) NULL,
        Cost DECIMAL(18,2) NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedById INT NULL,
        ModifiedById INT NULL,
        IsActive BIT NOT NULL DEFAULT(1),
        CreatedDate DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
        ModifiedDate DATETIME2 NULL
    );
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
        await ensureComplianceTables(pool);

        const id = req.params.id ? Number.parseInt(req.params.id, 10) : null;

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`
SELECT c.*, ct.Name AS ComplianceTypeName
FROM Compliances c
LEFT JOIN ComplianceTypes ct ON ct.Id = c.ComplianceTypeId
WHERE c.Id = @id AND c.IsActive = 1`);

                context.res = {
                    status: result.recordset.length ? 200 : 404,
                    headers,
                    body: result.recordset.length ? result.recordset[0] : { error: 'Compliance not found' }
                };
                return;
            }

            const userId = req.query.userId ? Number.parseInt(req.query.userId, 10) : null;
            const clinicId = req.query.clinicId ? Number.parseInt(req.query.clinicId, 10) : null;

            const request = pool.request();
            const where = ['c.IsActive = 1'];
            if (Number.isInteger(userId) && userId > 0) {
                request.input('userId', sql.Int, userId);
                where.push('c.UserId = @userId');
            }
            if (Number.isInteger(clinicId) && clinicId > 0) {
                request.input('clinicId', sql.Int, clinicId);
                where.push('c.ClinicId = @clinicId');
            }

            const result = await request.query(`
SELECT c.*, ct.Name AS ComplianceTypeName
FROM Compliances c
LEFT JOIN ComplianceTypes ct ON ct.Id = c.ComplianceTypeId
WHERE ${where.join(' AND ')}
ORDER BY c.ExpiryDate ASC, c.CreatedDate DESC`);

            context.res = { status: 200, headers, body: result.recordset };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const result = await pool.request()
                .input('title', sql.NVarChar(255), body.title || '')
                .input('complianceTypeId', sql.Int, Number.isFinite(Number(body.complianceTypeId)) ? Number(body.complianceTypeId) : null)
                .input('description', sql.NVarChar(sql.MAX), body.description || null)
                .input('userId', sql.Int, Number.isFinite(Number(body.userId)) ? Number(body.userId) : null)
                .input('clinicId', sql.Int, Number.isFinite(Number(body.clinicId)) ? Number(body.clinicId) : null)
                .input('issueDate', sql.Date, body.issueDate || null)
                .input('expiryDate', sql.Date, body.expiryDate || null)
                .input('reminderDate', sql.Date, body.reminderDate || null)
                .input('status', sql.NVarChar(50), body.status || 'active')
                .input('attachmentData', sql.NVarChar(sql.MAX), body.attachmentData || null)
                .input('attachmentName', sql.NVarChar(255), body.attachmentName || null)
                .input('attachmentType', sql.NVarChar(255), body.attachmentType || null)
                .input('documentType', sql.NVarChar(255), body.documentType || null)
                .input('referenceNumber', sql.NVarChar(255), body.referenceNumber || null)
                .input('issuingAuthority', sql.NVarChar(255), body.issuingAuthority || null)
                .input('cost', sql.Decimal(18, 2), body.cost || 0)
                .input('notes', sql.NVarChar(sql.MAX), body.notes || null)
                .input('createdById', sql.Int, Number.isFinite(Number(body.createdById)) ? Number(body.createdById) : null)
                .input('modifiedById', sql.Int, Number.isFinite(Number(body.modifiedById)) ? Number(body.modifiedById) : null)
                .query(`
INSERT INTO Compliances (
    Title, ComplianceTypeId, Description, UserId, ClinicId, IssueDate, ExpiryDate, ReminderDate,
    Status, AttachmentData, AttachmentName, AttachmentType, DocumentType, ReferenceNumber,
    IssuingAuthority, Cost, Notes, CreatedById, ModifiedById
)
OUTPUT INSERTED.*
VALUES (
    @title, @complianceTypeId, @description, @userId, @clinicId, @issueDate, @expiryDate, @reminderDate,
    @status, @attachmentData, @attachmentName, @attachmentType, @documentType, @referenceNumber,
    @issuingAuthority, @cost, @notes, @createdById, @modifiedById
)`);

            context.res = { status: 201, headers, body: result.recordset[0] };
            return;
        }

        if (req.method === 'PUT' && id) {
            const body = req.body || {};
            await pool.request()
                .input('id', sql.Int, id)
                .input('title', sql.NVarChar(255), body.title || '')
                .input('complianceTypeId', sql.Int, Number.isFinite(Number(body.complianceTypeId)) ? Number(body.complianceTypeId) : null)
                .input('description', sql.NVarChar(sql.MAX), body.description || null)
                .input('userId', sql.Int, Number.isFinite(Number(body.userId)) ? Number(body.userId) : null)
                .input('clinicId', sql.Int, Number.isFinite(Number(body.clinicId)) ? Number(body.clinicId) : null)
                .input('issueDate', sql.Date, body.issueDate || null)
                .input('expiryDate', sql.Date, body.expiryDate || null)
                .input('reminderDate', sql.Date, body.reminderDate || null)
                .input('status', sql.NVarChar(50), body.status || 'active')
                .input('attachmentData', sql.NVarChar(sql.MAX), body.attachmentData || null)
                .input('attachmentName', sql.NVarChar(255), body.attachmentName || null)
                .input('attachmentType', sql.NVarChar(255), body.attachmentType || null)
                .input('documentType', sql.NVarChar(255), body.documentType || null)
                .input('referenceNumber', sql.NVarChar(255), body.referenceNumber || null)
                .input('issuingAuthority', sql.NVarChar(255), body.issuingAuthority || null)
                .input('cost', sql.Decimal(18, 2), body.cost || 0)
                .input('notes', sql.NVarChar(sql.MAX), body.notes || null)
                .input('modifiedById', sql.Int, Number.isFinite(Number(body.modifiedById)) ? Number(body.modifiedById) : null)
                .query(`
UPDATE Compliances
SET
    Title = @title,
    ComplianceTypeId = @complianceTypeId,
    Description = @description,
    UserId = @userId,
    ClinicId = @clinicId,
    IssueDate = @issueDate,
    ExpiryDate = @expiryDate,
    ReminderDate = @reminderDate,
    Status = @status,
    AttachmentData = @attachmentData,
    AttachmentName = @attachmentName,
    AttachmentType = @attachmentType,
    DocumentType = @documentType,
    ReferenceNumber = @referenceNumber,
    IssuingAuthority = @issuingAuthority,
    Cost = @cost,
    Notes = @notes,
    ModifiedById = @modifiedById,
    ModifiedDate = SYSUTCDATETIME()
WHERE Id = @id AND IsActive = 1`);

            context.res = { status: 200, headers, body: { message: 'Compliance updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE Compliances SET IsActive = 0, ModifiedDate = SYSUTCDATETIME() WHERE Id = @id');

            context.res = { status: 200, headers, body: { message: 'Compliance deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Compliance API error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
};
