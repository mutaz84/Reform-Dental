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
        .query(`
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = @tableName`);

    return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function toNullableInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toNullableDecimal(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
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

        const complianceColumns = await getTableColumns(pool, 'Compliances');
        if (complianceColumns.size === 0) {
            context.res = {
                status: 500,
                headers,
                body: { error: 'Compliances table not found in database.' }
            };
            return;
        }

        const complianceTypeColumns = await getTableColumns(pool, 'ComplianceTypes');
        const hasComplianceTypesTable = complianceTypeColumns.size > 0;
        const hasComplianceTypeJoin = hasComplianceTypesTable && hasColumn(complianceColumns, 'ComplianceTypeId') && hasColumn(complianceTypeColumns, 'Id') && hasColumn(complianceTypeColumns, 'Name');
        const hasIsActive = hasColumn(complianceColumns, 'IsActive');
        const hasModifiedDate = hasColumn(complianceColumns, 'ModifiedDate');

        const id = req.params.id ? Number.parseInt(req.params.id, 10) : null;

        if (req.method === 'GET') {
            const selectTypeName = hasComplianceTypeJoin
                ? 'ct.Name AS ComplianceTypeName'
                : 'CAST(NULL AS NVARCHAR(200)) AS ComplianceTypeName';
            const fromClause = hasComplianceTypeJoin
                ? 'FROM Compliances c LEFT JOIN ComplianceTypes ct ON ct.Id = c.ComplianceTypeId'
                : 'FROM Compliances c';

            if (id) {
                const idRequest = pool.request()
                    .input('id', sql.Int, id)
                const whereById = ['c.Id = @id'];
                if (hasIsActive) {
                    whereById.push('c.IsActive = 1');
                }

                const result = await idRequest.query(`
SELECT c.*, ${selectTypeName}
${fromClause}
WHERE ${whereById.join(' AND ')}`);

                context.res = {
                    status: result.recordset.length ? 200 : 404,
                    headers,
                    body: result.recordset.length ? result.recordset[0] : { error: 'Compliance not found' }
                };
                return;
            }

            const userId = toNullableInt(req.query.userId);
            const clinicId = toNullableInt(req.query.clinicId);

            const request = pool.request();
            const where = [];
            if (hasIsActive) {
                where.push('c.IsActive = 1');
            }

            if (Number.isInteger(userId) && userId > 0 && hasColumn(complianceColumns, 'UserId')) {
                request.input('userId', sql.Int, userId);
                where.push('c.UserId = @userId');
            }

            if (Number.isInteger(clinicId) && clinicId > 0 && hasColumn(complianceColumns, 'ClinicId')) {
                request.input('clinicId', sql.Int, clinicId);
                where.push('c.ClinicId = @clinicId');
            }

            const orderBy = hasColumn(complianceColumns, 'ExpiryDate')
                ? 'ORDER BY c.ExpiryDate ASC'
                : (hasColumn(complianceColumns, 'CreatedDate') ? 'ORDER BY c.CreatedDate DESC' : 'ORDER BY c.Id DESC');

            const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

            const result = await request.query(`
SELECT c.*, ${selectTypeName}
${fromClause}
${whereClause}
${orderBy}`);

            context.res = { status: 200, headers, body: result.recordset };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            if (!hasColumn(complianceColumns, 'Title')) {
                context.res = { status: 500, headers, body: { error: 'Compliances schema mismatch: Title column is missing.' } };
                return;
            }

            const fieldDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: body.title || '' },
                { column: 'ComplianceTypeId', param: 'complianceTypeId', type: sql.Int, value: toNullableInt(body.complianceTypeId) },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: body.description || null },
                { column: 'UserId', param: 'userId', type: sql.Int, value: toNullableInt(body.userId) },
                { column: 'ClinicId', param: 'clinicId', type: sql.Int, value: toNullableInt(body.clinicId) },
                { column: 'IssueDate', param: 'issueDate', type: sql.Date, value: body.issueDate || null },
                { column: 'ExpiryDate', param: 'expiryDate', type: sql.Date, value: body.expiryDate || null },
                { column: 'ReminderDate', param: 'reminderDate', type: sql.Date, value: body.reminderDate || null },
                { column: 'Status', param: 'status', type: sql.NVarChar(50), value: body.status || 'active' },
                { column: 'AttachmentData', param: 'attachmentData', type: sql.NVarChar(sql.MAX), value: body.attachmentData || null },
                { column: 'AttachmentName', param: 'attachmentName', type: sql.NVarChar(255), value: body.attachmentName || null },
                { column: 'AttachmentType', param: 'attachmentType', type: sql.NVarChar(255), value: body.attachmentType || null },
                { column: 'DocumentType', param: 'documentType', type: sql.NVarChar(255), value: body.documentType || null },
                { column: 'ReferenceNumber', param: 'referenceNumber', type: sql.NVarChar(255), value: body.referenceNumber || null },
                { column: 'IssuingAuthority', param: 'issuingAuthority', type: sql.NVarChar(255), value: body.issuingAuthority || null },
                { column: 'Cost', param: 'cost', type: sql.Decimal(18, 2), value: toNullableDecimal(body.cost) },
                { column: 'Notes', param: 'notes', type: sql.NVarChar(sql.MAX), value: body.notes || null },
                { column: 'CreatedById', param: 'createdById', type: sql.Int, value: toNullableInt(body.createdById) },
                { column: 'ModifiedById', param: 'modifiedById', type: sql.Int, value: toNullableInt(body.modifiedById) }
            ].filter((def) => hasColumn(complianceColumns, def.column));

            const insertRequest = pool.request();
            fieldDefs.forEach((def) => insertRequest.input(def.param, def.type, def.value));

            const insertColumns = fieldDefs.map((def) => `[${def.column}]`).join(', ');
            const insertValues = fieldDefs.map((def) => `@${def.param}`).join(', ');

            const result = await insertRequest.query(`
INSERT INTO Compliances (${insertColumns})
OUTPUT INSERTED.*
VALUES (${insertValues})`);

            context.res = { status: 201, headers, body: result.recordset[0] };
            return;
        }

        if (req.method === 'PUT' && id) {
            const body = req.body || {};

            const updateDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: body.title || '' },
                { column: 'ComplianceTypeId', param: 'complianceTypeId', type: sql.Int, value: toNullableInt(body.complianceTypeId) },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: body.description || null },
                { column: 'UserId', param: 'userId', type: sql.Int, value: toNullableInt(body.userId) },
                { column: 'ClinicId', param: 'clinicId', type: sql.Int, value: toNullableInt(body.clinicId) },
                { column: 'IssueDate', param: 'issueDate', type: sql.Date, value: body.issueDate || null },
                { column: 'ExpiryDate', param: 'expiryDate', type: sql.Date, value: body.expiryDate || null },
                { column: 'ReminderDate', param: 'reminderDate', type: sql.Date, value: body.reminderDate || null },
                { column: 'Status', param: 'status', type: sql.NVarChar(50), value: body.status || 'active' },
                { column: 'AttachmentData', param: 'attachmentData', type: sql.NVarChar(sql.MAX), value: body.attachmentData || null },
                { column: 'AttachmentName', param: 'attachmentName', type: sql.NVarChar(255), value: body.attachmentName || null },
                { column: 'AttachmentType', param: 'attachmentType', type: sql.NVarChar(255), value: body.attachmentType || null },
                { column: 'DocumentType', param: 'documentType', type: sql.NVarChar(255), value: body.documentType || null },
                { column: 'ReferenceNumber', param: 'referenceNumber', type: sql.NVarChar(255), value: body.referenceNumber || null },
                { column: 'IssuingAuthority', param: 'issuingAuthority', type: sql.NVarChar(255), value: body.issuingAuthority || null },
                { column: 'Cost', param: 'cost', type: sql.Decimal(18, 2), value: toNullableDecimal(body.cost) },
                { column: 'Notes', param: 'notes', type: sql.NVarChar(sql.MAX), value: body.notes || null },
                { column: 'ModifiedById', param: 'modifiedById', type: sql.Int, value: toNullableInt(body.modifiedById) }
            ].filter((def) => hasColumn(complianceColumns, def.column));

            if (updateDefs.length === 0 && !hasModifiedDate) {
                context.res = { status: 500, headers, body: { error: 'No updatable compliance columns found in database schema.' } };
                return;
            }

            const updateRequest = pool.request().input('id', sql.Int, id);
            updateDefs.forEach((def) => updateRequest.input(def.param, def.type, def.value));

            const setClauses = updateDefs.map((def) => `${def.column} = @${def.param}`);
            if (hasModifiedDate) {
                setClauses.push('ModifiedDate = SYSUTCDATETIME()');
            }

            const whereClauses = ['Id = @id'];
            if (hasIsActive) {
                whereClauses.push('IsActive = 1');
            }

            await updateRequest.query(`
UPDATE Compliances
SET ${setClauses.join(', ')}
WHERE ${whereClauses.join(' AND ')}`);

            context.res = { status: 200, headers, body: { message: 'Compliance updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            const deleteRequest = pool.request().input('id', sql.Int, id);

            if (hasIsActive) {
                const setParts = ['IsActive = 0'];
                if (hasModifiedDate) {
                    setParts.push('ModifiedDate = SYSUTCDATETIME()');
                }
                await deleteRequest.query(`UPDATE Compliances SET ${setParts.join(', ')} WHERE Id = @id`);
            } else {
                await deleteRequest.query('DELETE FROM Compliances WHERE Id = @id');
            }

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
