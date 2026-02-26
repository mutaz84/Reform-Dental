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
        assignedUserIds: Array.isArray(pick('assignedUserIds', 'AssignedUserIds', []))
            ? pick('assignedUserIds', 'AssignedUserIds', [])
            : [],
        AssignedUserIds: Array.isArray(pick('assignedUserIds', 'AssignedUserIds', []))
            ? pick('assignedUserIds', 'AssignedUserIds', [])
            : [],
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

async function mapComplianceAssignments(pool, compliances, options = {}) {
    const complianceList = Array.isArray(compliances) ? compliances : [];
    const { hasAssignmentTable = false } = options;

    if (!hasAssignmentTable || complianceList.length === 0) {
        return complianceList.map((row) => {
            const firstAssigned = toNullableInt(row?.UserId ?? row?.userId);
            const assignedUserIds = firstAssigned ? [firstAssigned] : [];
            return {
                ...row,
                assignedUserIds,
                AssignedUserIds: assignedUserIds,
                userId: firstAssigned,
                UserId: firstAssigned
            };
        });
    }

    const ids = Array.from(new Set(
        complianceList
            .map((row) => toNullableInt(row?.Id ?? row?.id))
            .filter((value) => Number.isInteger(value) && value > 0)
    ));

    if (ids.length === 0) {
        return complianceList;
    }

    const assignmentResult = await pool.request().query(`
SELECT ComplianceId, UserId
FROM UserComplianceAssignments
WHERE ComplianceId IN (${ids.join(', ')})`);

    const assignmentMap = new Map();
    (assignmentResult.recordset || []).forEach((row) => {
        const complianceId = toNullableInt(row?.ComplianceId);
        const userId = toNullableInt(row?.UserId);
        if (!complianceId || !userId) return;
        if (!assignmentMap.has(complianceId)) assignmentMap.set(complianceId, []);
        assignmentMap.get(complianceId).push(userId);
    });

    return complianceList.map((row) => {
        const complianceId = toNullableInt(row?.Id ?? row?.id);
        const mapped = assignmentMap.get(complianceId) || [];
        const fallbackUserId = toNullableInt(row?.UserId ?? row?.userId);
        const assignedUserIds = mapped.length
            ? Array.from(new Set(mapped))
            : (fallbackUserId ? [fallbackUserId] : []);
        const firstAssigned = assignedUserIds.length ? assignedUserIds[0] : null;
        return {
            ...row,
            assignedUserIds,
            AssignedUserIds: assignedUserIds,
            userId: firstAssigned,
            UserId: firstAssigned
        };
    });
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
        const assignmentColumns = await getTableColumns(pool, 'UserComplianceAssignments');
        const hasAssignmentTable = assignmentColumns.size > 0
            && hasColumn(assignmentColumns, 'ComplianceId')
            && hasColumn(assignmentColumns, 'UserId');

        const routeIdRaw = req.params.id ? String(req.params.id).trim() : '';
        const id = routeIdRaw && /^\d+$/.test(routeIdRaw)
            ? Number.parseInt(routeIdRaw, 10)
            : null;

        if (req.method === 'PUT' && routeIdRaw.toLowerCase() === 'assignments') {
            const body = req.body || {};
            const targetUserId = toNullableInt(body.userId || req.query.userId);
            const selectedComplianceIds = Array.from(new Set(
                (Array.isArray(body.selectedComplianceIds) ? body.selectedComplianceIds : [])
                    .map((value) => toNullableInt(value))
                    .filter((value) => Number.isInteger(value) && value > 0)
            ));

            if (!targetUserId || targetUserId <= 0) {
                context.res = { status: 400, headers, body: { error: 'Valid userId is required.' } };
                return;
            }

            const tx = new sql.Transaction(pool);
            await tx.begin();
            try {
                if (hasAssignmentTable) {
                    await new sql.Request(tx)
                        .input('userId', sql.Int, targetUserId)
                        .query('DELETE FROM UserComplianceAssignments WHERE UserId = @userId');

                    for (const complianceId of selectedComplianceIds) {
                        await new sql.Request(tx)
                            .input('userId', sql.Int, targetUserId)
                            .input('complianceId', sql.Int, complianceId)
                            .query(`
INSERT INTO UserComplianceAssignments (UserId, ComplianceId)
SELECT @userId, @complianceId
WHERE EXISTS (
    SELECT 1 FROM Compliances c WHERE c.Id = @complianceId ${hasIsActive ? 'AND c.IsActive = 1' : ''}
)`);
                    }
                }

                if (hasColumn(complianceColumns, 'UserId')) {
                    await new sql.Request(tx)
                        .input('userId', sql.Int, targetUserId)
                        .query('UPDATE Compliances SET UserId = NULL WHERE UserId = @userId');

                    if (selectedComplianceIds.length) {
                        await new sql.Request(tx)
                            .input('userId', sql.Int, targetUserId)
                            .query(`UPDATE Compliances SET UserId = @userId WHERE Id IN (${selectedComplianceIds.join(', ')})`);
                    }
                }

                await tx.commit();
                context.res = {
                    status: 200,
                    headers,
                    body: {
                        message: 'Compliance assignments updated',
                        userId: targetUserId,
                        assignedComplianceIds: selectedComplianceIds
                    }
                };
            } catch (assignmentError) {
                await tx.rollback();
                throw assignmentError;
            }
            return;
        }

        if (req.method === 'GET') {
            const viewMode = String(req.query.view || '').trim().toLowerCase();

            if (viewMode === 'summary-by-user') {
                if (!hasAssignmentTable && !hasColumn(complianceColumns, 'UserId')) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }

                const userColumns = await getTableColumns(pool, 'Users');
                const hasUsersTable = userColumns.size > 0 && hasColumn(userColumns, 'Id');
                const whereParts = [];
                if (hasIsActive) whereParts.push('c.IsActive = 1');
                const summaryRows = await pool.request().query(`
SELECT c.Id, c.UserId, c.Status, c.ExpiryDate
FROM Compliances c
${whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''}`);

                const compliances = summaryRows.recordset || [];
                const byComplianceId = new Map();
                compliances.forEach((row) => {
                    const complianceId = toNullableInt(row?.Id);
                    if (complianceId) byComplianceId.set(complianceId, row);
                });

                const userNameById = {};
                if (hasUsersTable) {
                    const usersResult = await pool.request().query(`
SELECT Id,
       COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(FirstName, ''), ' ', ISNULL(LastName, '')))), ''), NULLIF(LTRIM(RTRIM(ISNULL(Username, ''))), '')) AS EmployeeName
FROM Users`);
                    (usersResult.recordset || []).forEach((row) => {
                        const userId = toNullableInt(row?.Id);
                        if (userId) userNameById[userId] = row?.EmployeeName || `User #${userId}`;
                    });
                }

                let assignmentRows = [];
                if (hasAssignmentTable) {
                    assignmentRows = (await pool.request().query('SELECT UserId, ComplianceId FROM UserComplianceAssignments')).recordset || [];
                } else {
                    assignmentRows = compliances
                        .map((row) => ({ UserId: row?.UserId, ComplianceId: row?.Id }))
                        .filter((row) => toNullableInt(row?.UserId) && toNullableInt(row?.ComplianceId));
                }

                const grouped = new Map();
                assignmentRows.forEach((assignment) => {
                    const userId = toNullableInt(assignment?.UserId);
                    const complianceId = toNullableInt(assignment?.ComplianceId);
                    const compliance = byComplianceId.get(complianceId);
                    if (!userId || !compliance) return;

                    if (!grouped.has(userId)) {
                        grouped.set(userId, {
                            UserId: userId,
                            EmployeeName: userNameById[userId] || `User #${userId}`,
                            TotalCount: 0,
                            CompletedCount: 0,
                            InProgressCount: 0,
                            PendingCount: 0,
                            OverdueCount: 0
                        });
                    }

                    const bucket = grouped.get(userId);
                    bucket.TotalCount += 1;

                    const status = String(compliance?.Status || '').trim().toLowerCase();
                    if (status === 'completed') {
                        bucket.CompletedCount += 1;
                    } else if (status === 'in_progress') {
                        bucket.InProgressCount += 1;
                    } else {
                        bucket.PendingCount += 1;
                    }

                    if (compliance?.ExpiryDate && status !== 'completed') {
                        const expiry = new Date(compliance.ExpiryDate);
                        const today = new Date();
                        expiry.setHours(0, 0, 0, 0);
                        today.setHours(0, 0, 0, 0);
                        if (!Number.isNaN(expiry.getTime()) && expiry < today) {
                            bucket.OverdueCount += 1;
                        }
                    }
                });

                const result = Array.from(grouped.values()).sort((a, b) =>
                    String(a.EmployeeName || '').localeCompare(String(b.EmployeeName || ''))
                );

                context.res = { status: 200, headers, body: result };
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
                const shouldFilterInMemoryByUser = !!(Number.isInteger(userIdFilter) && userIdFilter > 0 && hasAssignmentTable);
                if (!shouldFilterInMemoryByUser && Number.isInteger(userIdFilter) && userIdFilter > 0 && hasColumn(complianceColumns, 'UserId')) {
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

                let rows = await mapComplianceAssignments(pool, result.recordset || [], { hasAssignmentTable });
                if (shouldFilterInMemoryByUser) {
                    rows = rows.filter((row) => (Array.isArray(row?.assignedUserIds) ? row.assignedUserIds : []).includes(userIdFilter));
                }
                context.res = { status: 200, headers, body: rows.map(normalizeComplianceRow) };
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

                const withAssignments = await mapComplianceAssignments(pool, result.recordset || [], { hasAssignmentTable });
                const normalizedRow = withAssignments.length ? normalizeComplianceRow(withAssignments[0]) : null;

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

            const shouldFilterInMemoryByUser = !!(Number.isInteger(userId) && userId > 0 && hasAssignmentTable);
            if (!shouldFilterInMemoryByUser && Number.isInteger(userId) && userId > 0 && hasColumn(complianceColumns, 'UserId')) {
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

            let rows = await mapComplianceAssignments(pool, result.recordset || [], { hasAssignmentTable });
            if (shouldFilterInMemoryByUser) {
                rows = rows.filter((row) => (Array.isArray(row?.assignedUserIds) ? row.assignedUserIds : []).includes(userId));
            }
            context.res = { status: 200, headers, body: rows.map(normalizeComplianceRow) };
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const attachmentUrl = body.attachmentUrl || body.AttachmentUrl || body.attachmentData || body.AttachmentData || null;
            if (!hasColumn(complianceColumns, 'Title')) {
                context.res = { status: 500, headers, body: { error: 'Compliances schema mismatch: Title column is missing.' } };
                return;
            }

            const assignedUserIds = Array.from(new Set(
                (Array.isArray(body.assignedUserIds) ? body.assignedUserIds : [])
                    .map((value) => toNullableInt(value))
                    .filter((value) => Number.isInteger(value) && value > 0)
            ));
            const compatibilityUserId = assignedUserIds.length
                ? assignedUserIds[0]
                : toNullableInt(body.userId);

            const fieldDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: body.title || '' },
                { column: 'ComplianceTypeId', param: 'complianceTypeId', type: sql.Int, value: toNullableInt(body.complianceTypeId) },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: body.description || null },
                { column: 'UserId', param: 'userId', type: sql.Int, value: compatibilityUserId },
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

            const createdComplianceId = toNullableInt(result.recordset?.[0]?.Id || result.recordset?.[0]?.id);
            if (hasAssignmentTable && createdComplianceId) {
                const assignmentIds = assignedUserIds.length
                    ? assignedUserIds
                    : (compatibilityUserId ? [compatibilityUserId] : []);
                for (const assignedUserId of assignmentIds) {
                    await pool.request()
                        .input('userId', sql.Int, assignedUserId)
                        .input('complianceId', sql.Int, createdComplianceId)
                        .query('INSERT INTO UserComplianceAssignments (UserId, ComplianceId) VALUES (@userId, @complianceId)');
                }
            }

            context.res = { status: 201, headers, body: result.recordset[0] };
            return;
        }

        if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const attachmentUrl = body.attachmentUrl || body.AttachmentUrl || body.attachmentData || body.AttachmentData || null;

            const hasExplicitAssignedUserIds = Array.isArray(body.assignedUserIds);
            const assignedUserIds = Array.from(new Set(
                (hasExplicitAssignedUserIds ? body.assignedUserIds : [])
                    .map((value) => toNullableInt(value))
                    .filter((value) => Number.isInteger(value) && value > 0)
            ));
            const hasUserIdInPayload = Object.prototype.hasOwnProperty.call(body, 'userId') || Object.prototype.hasOwnProperty.call(body, 'UserId');
            const compatibilityUserId = hasExplicitAssignedUserIds
                ? (assignedUserIds[0] || null)
                : (hasUserIdInPayload ? toNullableInt(body.userId ?? body.UserId) : null);

            const updateDefs = [
                { column: 'Title', param: 'title', type: sql.NVarChar(255), value: body.title || '' },
                { column: 'ComplianceTypeId', param: 'complianceTypeId', type: sql.Int, value: toNullableInt(body.complianceTypeId) },
                { column: 'Description', param: 'description', type: sql.NVarChar(sql.MAX), value: body.description || null },
                ...(hasExplicitAssignedUserIds || hasUserIdInPayload
                    ? [{ column: 'UserId', param: 'userId', type: sql.Int, value: compatibilityUserId }]
                    : []),
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

            if (hasAssignmentTable && (hasExplicitAssignedUserIds || hasUserIdInPayload)) {
                const assignmentIds = hasExplicitAssignedUserIds
                    ? assignedUserIds
                    : (compatibilityUserId ? [compatibilityUserId] : []);

                const tx = new sql.Transaction(pool);
                await tx.begin();
                try {
                    await new sql.Request(tx)
                        .input('complianceId', sql.Int, id)
                        .query('DELETE FROM UserComplianceAssignments WHERE ComplianceId = @complianceId');

                    for (const assignedUserId of assignmentIds) {
                        await new sql.Request(tx)
                            .input('userId', sql.Int, assignedUserId)
                            .input('complianceId', sql.Int, id)
                            .query('INSERT INTO UserComplianceAssignments (UserId, ComplianceId) VALUES (@userId, @complianceId)');
                    }

                    await tx.commit();
                } catch (assignmentSyncError) {
                    await tx.rollback();
                    throw assignmentSyncError;
                }
            }

            context.res = { status: 200, headers, body: { message: 'Compliance updated' } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            const deleteRequest = pool.request().input('id', sql.Int, id);

            if (hasAssignmentTable) {
                await pool.request()
                    .input('id', sql.Int, id)
                    .query('DELETE FROM UserComplianceAssignments WHERE ComplianceId = @id');
            }

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
