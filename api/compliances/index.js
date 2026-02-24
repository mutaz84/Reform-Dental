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

function parsePositiveIntList(rawValue, fallback = []) {
    const source = Array.isArray(rawValue) ? rawValue.join(',') : String(rawValue || '');
    const values = source
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((num) => Number.isInteger(num) && num > 0);

    if (values.length === 0) {
        return Array.from(new Set(fallback.filter((num) => Number.isInteger(num) && num > 0)));
    }

    return Array.from(new Set(values));
}

function parseBoolean(rawValue, fallback = false) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return fallback;
    const value = String(rawValue).trim().toLowerCase();
    if (value === 'true' || value === '1' || value === 'yes') return true;
    if (value === 'false' || value === '0' || value === 'no') return false;
    return fallback;
}

function normalizeComplianceRow(row) {
    if (!row || typeof row !== 'object') {
        return row;
    }

    const pick = (camel, pascal, fallback = null) => {
        if (row[camel] !== undefined && row[camel] !== null) return row[camel];
        if (row[pascal] !== undefined && row[pascal] !== null) return row[pascal];
        return fallback;
    };

    return {
        ...row,
        id: pick('id', 'Id'),
        complianceTypeId: pick('complianceTypeId', 'ComplianceTypeId'),
        complianceTypeName: pick('complianceTypeName', 'ComplianceTypeName', ''),
        title: pick('title', 'Title', ''),
        description: pick('description', 'Description', ''),
        userId: pick('userId', 'UserId'),
        clinicId: pick('clinicId', 'ClinicId'),
        issueDate: pick('issueDate', 'IssueDate'),
        expiryDate: pick('expiryDate', 'ExpiryDate'),
        reminderDate: pick('reminderDate', 'ReminderDate'),
        status: pick('status', 'Status', 'active'),
        priority: pick('priority', 'Priority', ''),
        attachmentUrl: pick('attachmentUrl', 'AttachmentUrl'),
        attachmentName: pick('attachmentName', 'AttachmentName', ''),
        documentType: pick('documentType', 'DocumentType', ''),
        referenceNumber: pick('referenceNumber', 'ReferenceNumber', ''),
        issuingAuthority: pick('issuingAuthority', 'IssuingAuthority', ''),
        cost: pick('cost', 'Cost'),
        daysUntilDue: pick('daysUntilDue', 'DaysUntilDue'),
        notes: pick('notes', 'Notes', ''),
        createdById: pick('createdById', 'CreatedById'),
        createdDate: pick('createdDate', 'CreatedDate'),
        modifiedById: pick('modifiedById', 'ModifiedById'),
        modifiedDate: pick('modifiedDate', 'ModifiedDate')
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
            const viewMode = String(req.query.view || '').trim().toLowerCase();

            if (viewMode === 'summary-by-user') {
                if (!hasColumn(complianceColumns, 'UserId')) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }

                const userColumns = await getTableColumns(pool, 'Users');
                const hasUsersTable = userColumns.size > 0 && hasColumn(userColumns, 'Id');
                const hasStatus = hasColumn(complianceColumns, 'Status');
                const hasExpiryDate = hasColumn(complianceColumns, 'ExpiryDate');
                const statusExpr = hasStatus
                    ? "LOWER(LTRIM(RTRIM(ISNULL(c.Status, ''))))"
                    : "''";
                const employeeNameExpr = hasUsersTable
                    ? "COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName, ''), ' ', ISNULL(u.LastName, '')))), ''), NULLIF(LTRIM(RTRIM(ISNULL(u.Username, ''))), ''), CONCAT('User #', CAST(c.UserId AS NVARCHAR(20))))"
                    : "CONCAT('User #', CAST(c.UserId AS NVARCHAR(20)))";
                const joinUsersClause = hasUsersTable ? 'LEFT JOIN Users u ON u.Id = c.UserId' : '';

                const whereParts = ['c.UserId IS NOT NULL'];
                if (hasIsActive) {
                    whereParts.push('c.IsActive = 1');
                }

                const overdueExpr = hasExpiryDate
                    ? `SUM(CASE WHEN CAST(c.ExpiryDate AS DATE) < CAST(SYSUTCDATETIME() AS DATE) AND ${statusExpr} <> 'completed' THEN 1 ELSE 0 END) AS OverdueCount`
                    : 'CAST(0 AS INT) AS OverdueCount';

                const result = await pool.request().query(`
SELECT
    c.UserId,
    ${employeeNameExpr} AS EmployeeName,
    COUNT(1) AS TotalCount,
    SUM(CASE WHEN ${statusExpr} = 'completed' THEN 1 ELSE 0 END) AS CompletedCount,
    SUM(CASE WHEN ${statusExpr} = 'in_progress' THEN 1 ELSE 0 END) AS InProgressCount,
    SUM(CASE WHEN ${statusExpr} IN ('pending', '', 'active') THEN 1 ELSE 0 END) AS PendingCount,
    ${overdueExpr}
FROM Compliances c
${joinUsersClause}
WHERE ${whereParts.join(' AND ')}
GROUP BY c.UserId, ${employeeNameExpr}
ORDER BY EmployeeName`);

                context.res = { status: 200, headers, body: result.recordset || [] };
                return;
            }

            if (viewMode === 'due-soon') {
                if (!hasColumn(complianceColumns, 'ExpiryDate')) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }

                const request = pool.request();
                const whereParts = ['c.ExpiryDate IS NOT NULL'];
                if (hasIsActive) {
                    whereParts.push('c.IsActive = 1');
                }
                if (hasColumn(complianceColumns, 'Status')) {
                    whereParts.push("LOWER(LTRIM(RTRIM(ISNULL(c.Status, '')))) <> 'completed'");
                }

                const userIdFilter = toNullableInt(req.query.userId);
                if (Number.isInteger(userIdFilter) && userIdFilter > 0 && hasColumn(complianceColumns, 'UserId')) {
                    request.input('userId', sql.Int, userIdFilter);
                    whereParts.push('c.UserId = @userId');
                }

                const dueDays = parsePositiveIntList(req.query.days, [7, 3, 1]);
                const includeOverdue = parseBoolean(req.query.includeOverdue, false);
                const dayClause = dueDays.length
                    ? `DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(c.ExpiryDate AS DATE)) IN (${dueDays.join(', ')})`
                    : '1 = 0';
                if (includeOverdue) {
                    whereParts.push(`(${dayClause} OR DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(c.ExpiryDate AS DATE)) < 0)`);
                } else {
                    whereParts.push(dayClause);
                }

                const selectTypeName = hasComplianceTypeJoin
                    ? 'ct.Name AS ComplianceTypeName'
                    : 'CAST(NULL AS NVARCHAR(200)) AS ComplianceTypeName';
                const fromClause = hasComplianceTypeJoin
                    ? 'FROM Compliances c LEFT JOIN ComplianceTypes ct ON ct.Id = c.ComplianceTypeId'
                    : 'FROM Compliances c';

                const result = await request.query(`
SELECT c.*, ${selectTypeName}, DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(c.ExpiryDate AS DATE)) AS DaysUntilDue
${fromClause}
WHERE ${whereParts.join(' AND ')}
ORDER BY DaysUntilDue ASC, c.ExpiryDate ASC`);

                context.res = { status: 200, headers, body: (result.recordset || []).map(normalizeComplianceRow) };
                return;
            }

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

                const normalizedRow = result.recordset.length ? normalizeComplianceRow(result.recordset[0]) : null;

                context.res = {
                    status: normalizedRow ? 200 : 404,
                    headers,
                    body: normalizedRow || { error: 'Compliance not found' }
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

            context.res = { status: 200, headers, body: (result.recordset || []).map(normalizeComplianceRow) };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const attachmentUrl = body.attachmentUrl || body.AttachmentUrl || body.attachmentData || body.AttachmentData || null;
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
                { column: 'Status', param: 'status', type: sql.NVarChar(50), value: body.status || 'pending' },
                { column: 'AttachmentUrl', param: 'attachmentUrl', type: sql.NVarChar(sql.MAX), value: attachmentUrl },
                { column: 'AttachmentName', param: 'attachmentName', type: sql.NVarChar(255), value: body.attachmentName || null },
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
            const attachmentUrl = body.attachmentUrl || body.AttachmentUrl || body.attachmentData || body.AttachmentData || null;

            const updateDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: body.title || '' },
                { column: 'ComplianceTypeId', param: 'complianceTypeId', type: sql.Int, value: toNullableInt(body.complianceTypeId) },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: body.description || null },
                { column: 'UserId', param: 'userId', type: sql.Int, value: toNullableInt(body.userId) },
                { column: 'ClinicId', param: 'clinicId', type: sql.Int, value: toNullableInt(body.clinicId) },
                { column: 'IssueDate', param: 'issueDate', type: sql.Date, value: body.issueDate || null },
                { column: 'ExpiryDate', param: 'expiryDate', type: sql.Date, value: body.expiryDate || null },
                { column: 'ReminderDate', param: 'reminderDate', type: sql.Date, value: body.reminderDate || null },
                { column: 'Status', param: 'status', type: sql.NVarChar(50), value: body.status || 'pending' },
                { column: 'AttachmentUrl', param: 'attachmentUrl', type: sql.NVarChar(sql.MAX), value: attachmentUrl },
                { column: 'AttachmentName', param: 'attachmentName', type: sql.NVarChar(255), value: body.attachmentName || null },
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
