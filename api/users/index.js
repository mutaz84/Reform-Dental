const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE || '',
    user: process.env.SQL_USER || '',
    password: process.env.SQL_PASSWORD || '',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Parse connection string if provided
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
            options: {
                encrypt: true,
                trustServerCertificate: false
            }
        };
    }
    return config;
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

function toNullableString(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
}

function toNullableNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function toNullableDate(value) {
    if (!value) return null;
    return value;
}

function toBooleanBit(value) {
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function toJsonString(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch (_) {
        return null;
    }
}

function parseJsonSafe(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function parseRequestBody(body) {
    if (body == null) return {};
    if (typeof body === 'string') return parseJsonSafe(body, {}) || {};
    if (typeof body === 'object') return body;
    return {};
}

function toBitInt(value) {
    return value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true' ? 1 : 0;
}

function normalizeConstrainedString(value, allowedValues, fallbackValue = null) {
    const normalized = toNullableString(value);
    if (normalized == null) return fallbackValue;

    const match = (allowedValues || []).find((candidate) => String(candidate).toLowerCase() === String(normalized).toLowerCase());
    return match || fallbackValue;
}

function normalizeStaffType(value, fallbackValue = null) {
    return normalizeConstrainedString(value, ['clinical', 'non-clinical'], fallbackValue);
}

function normalizeEmployeeType(value, fallbackValue = null) {
    return normalizeConstrainedString(value, ['provider', 'assistant'], fallbackValue);
}

function normalizeEmployeeStatus(value, fallbackValue = null) {
    return normalizeConstrainedString(value, ['Active', 'Inactive', 'On Leave', 'Terminated'], fallbackValue);
}

function normalizeRoleValue(value, fallbackValue = null) {
    return normalizeConstrainedString(value, ['user', 'manager', 'admin'], fallbackValue);
}

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function isInactiveEmployeeStatus(statusValue) {
    const normalized = String(statusValue || '').trim().toLowerCase();
    return normalized === 'inactive' || normalized === 'terminated' || normalized === 'on leave' || normalized === 'leave';
}

function resolveScheduleLifecycleState(body) {
    const hasIsActive = hasOwn(body, 'isActive') || hasOwn(body, 'IsActive');
    const hasEmployeeStatus = hasOwn(body, 'employeeStatus') || hasOwn(body, 'EmployeeStatus');

    if (!hasIsActive && !hasEmployeeStatus) {
        return null;
    }

    const isActiveValue = hasIsActive ? toBooleanBit(body.isActive ?? body.IsActive) : null;
    const employeeStatusValue = hasEmployeeStatus ? (body.employeeStatus ?? body.EmployeeStatus) : null;

    if (hasIsActive && isActiveValue === false) {
        return { isActive: false, includeAssistantAssignments: true };
    }

    if (hasEmployeeStatus && isInactiveEmployeeStatus(employeeStatusValue)) {
        return { isActive: false, includeAssistantAssignments: true };
    }

    if ((hasIsActive && isActiveValue === true) || hasEmployeeStatus) {
        return { isActive: true, includeAssistantAssignments: false };
    }

    return null;
}

async function syncUserSchedulesLifecycle(connectionOrTx, userId, lifecycleState) {
    if (!(Number(userId) > 0) || !lifecycleState) return;

    const scheduleColumns = await getTableColumns(connectionOrTx, 'Schedules');
    const hasSchedules =
        scheduleColumns.size > 0 &&
        hasColumn(scheduleColumns, 'UserId') &&
        hasColumn(scheduleColumns, 'IsActive');

    if (!hasSchedules) return;

    const canUseAssistant = hasColumn(scheduleColumns, 'AssistantId');
    const includeAssistantAssignments = lifecycleState.includeAssistantAssignments === true && canUseAssistant;
    const setParts = ['IsActive = @scheduleIsActive'];
    if (hasColumn(scheduleColumns, 'ModifiedDate')) {
        setParts.push('ModifiedDate = GETUTCDATE()');
    }

    const where = includeAssistantAssignments
        ? '(UserId = @userId OR AssistantId = @userId)'
        : 'UserId = @userId';

    await new sql.Request(connectionOrTx)
        .input('userId', sql.Int, Number(userId))
        .input('scheduleIsActive', sql.Bit, lifecycleState.isActive ? 1 : 0)
        .query(`UPDATE Schedules SET ${setParts.join(', ')} WHERE ${where}`);
}

async function upsertNormalizedHrInfoAndBenefits(transaction, userId, hrInfoRaw) {
    if (!hrInfoRaw) return;

    const userHrInfoColumns = await getTableColumns(transaction, 'UserHRInfo');
    const hasUserHrInfo = userHrInfoColumns.size > 0 && hasColumn(userHrInfoColumns, 'UserId');
    if (!hasUserHrInfo) return;

    const hrDataColumn = hasColumn(userHrInfoColumns, 'HRDataJson')
        ? 'HRDataJson'
        : (hasColumn(userHrInfoColumns, 'HRData')
            ? 'HRData'
            : (hasColumn(userHrInfoColumns, 'HRInfo') ? 'HRInfo' : null));
    if (!hrDataColumn) return;

    const hasLastUpdated = hasColumn(userHrInfoColumns, 'LastUpdated');
    const hasCreatedAt = hasColumn(userHrInfoColumns, 'CreatedAt');
    const hasUpdatedAt = hasColumn(userHrInfoColumns, 'UpdatedAt');

    const hrInfoObj = typeof hrInfoRaw === 'string' ? (parseJsonSafe(hrInfoRaw, {}) || {}) : (hrInfoRaw || {});
    const hrDataJson = toJsonString(hrInfoObj) || '{}';

    await new sql.Request(transaction)
        .input('userId', sql.Int, Number(userId))
        .input('hrDataJson', sql.NVarChar(sql.MAX), hrDataJson)
        .query(`
            UPDATE UserHRInfo
            SET ${[
                `${hrDataColumn} = @hrDataJson`,
                hasLastUpdated ? 'LastUpdated = SYSUTCDATETIME()' : null,
                hasUpdatedAt ? 'UpdatedAt = SYSUTCDATETIME()' : null
            ].filter(Boolean).join(', ')}
            WHERE UserId = @userId;

            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO UserHRInfo (${[
                    'UserId',
                    hrDataColumn,
                    hasLastUpdated ? 'LastUpdated' : null,
                    hasCreatedAt ? 'CreatedAt' : null,
                    hasUpdatedAt ? 'UpdatedAt' : null
                ].filter(Boolean).join(', ')})
                VALUES (${[
                    '@userId',
                    '@hrDataJson',
                    hasLastUpdated ? 'SYSUTCDATETIME()' : null,
                    hasCreatedAt ? 'SYSUTCDATETIME()' : null,
                    hasUpdatedAt ? 'SYSUTCDATETIME()' : null
                ].filter(Boolean).join(', ')});
            END
        `);

    const verifyRow = await new sql.Request(transaction)
        .input('userId', sql.Int, Number(userId))
        .query('SELECT TOP 1 Id FROM UserHRInfo WHERE UserId = @userId');
    if (!verifyRow.recordset || !verifyRow.recordset[0]) {
        throw new Error('UserHRInfo upsert verification failed: row was not created.');
    }

    const userHrBenefitsColumns = await getTableColumns(transaction, 'UserHRBenefits');
    const hasUserHrBenefits = userHrBenefitsColumns.size > 0 && hasColumn(userHrBenefitsColumns, 'UserHRInfoId') && hasColumn(userHrBenefitsColumns, 'BenefitKey');
    if (!hasUserHrBenefits) return;

    const hasBenefitName = hasColumn(userHrBenefitsColumns, 'BenefitName');
    const hasIsEnabled = hasColumn(userHrBenefitsColumns, 'IsEnabled');
    if (!hasIsEnabled) return;
    const hasBenefitsCreatedAt = hasColumn(userHrBenefitsColumns, 'CreatedAt');
    const hasBenefitsUpdatedAt = hasColumn(userHrBenefitsColumns, 'UpdatedAt');

    const infoRow = await new sql.Request(transaction)
        .input('userId', sql.Int, Number(userId))
        .query('SELECT TOP 1 Id FROM UserHRInfo WHERE UserId = @userId');
    const userHrInfoId = Number(infoRow.recordset?.[0]?.Id || 0);
    if (!(userHrInfoId > 0)) return;

    const rawBenefits = hrInfoObj && typeof hrInfoObj === 'object' ? hrInfoObj.benefits : null;
    const benefits = rawBenefits && typeof rawBenefits === 'object' ? rawBenefits : {};

    await new sql.Request(transaction)
        .input('userHrInfoId', sql.Int, userHrInfoId)
        .query('DELETE FROM UserHRBenefits WHERE UserHRInfoId = @userHrInfoId');

    for (const [benefitKeyRaw, enabledRaw] of Object.entries(benefits)) {
        const benefitKey = String(benefitKeyRaw || '').trim();
        if (!benefitKey) continue;
        const benefitName = benefitKey.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        const insertColumns = [
            'UserHRInfoId',
            'BenefitKey',
            hasBenefitName ? 'BenefitName' : null,
            'IsEnabled',
            hasBenefitsCreatedAt ? 'CreatedAt' : null,
            hasBenefitsUpdatedAt ? 'UpdatedAt' : null
        ].filter(Boolean);

        const insertValues = [
            '@userHrInfoId',
            '@benefitKey',
            hasBenefitName ? '@benefitName' : null,
            '@isEnabled',
            hasBenefitsCreatedAt ? 'SYSUTCDATETIME()' : null,
            hasBenefitsUpdatedAt ? 'SYSUTCDATETIME()' : null
        ].filter(Boolean);

        await new sql.Request(transaction)
            .input('userHrInfoId', sql.Int, userHrInfoId)
            .input('benefitKey', sql.NVarChar(150), benefitKey)
            .input('benefitName', sql.NVarChar(200), benefitName)
            .input('isEnabled', sql.Bit, toBitInt(enabledRaw))
            .query(`
                INSERT INTO UserHRBenefits (${insertColumns.join(', ')})
                VALUES (${insertValues.join(', ')})
            `);
    }
}

async function hydrateBenefitsForUsers(pool, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const userIds = Array.from(new Set(rows.map((r) => Number(r?.Id || 0)).filter((n) => Number.isInteger(n) && n > 0)));
    if (!userIds.length) return rows;

    const userHrBenefitsColumns = await getTableColumns(pool, 'UserHRBenefits');
    const userHrInfoColumns = await getTableColumns(pool, 'UserHRInfo');
    const canQueryBenefits =
        userHrBenefitsColumns.size > 0 &&
        userHrInfoColumns.size > 0 &&
        hasColumn(userHrBenefitsColumns, 'UserHRInfoId') &&
        hasColumn(userHrBenefitsColumns, 'BenefitKey') &&
        hasColumn(userHrBenefitsColumns, 'IsEnabled') &&
        hasColumn(userHrInfoColumns, 'Id') &&
        hasColumn(userHrInfoColumns, 'UserId');

    if (!canQueryBenefits) return rows;

    const benefitsResult = await pool.request().query(`
        SELECT uhr.UserId, b.BenefitKey, b.IsEnabled
        FROM UserHRBenefits b
        JOIN UserHRInfo uhr ON uhr.Id = b.UserHRInfoId
        WHERE uhr.UserId IN (${userIds.join(',')})
    `);

    const map = new Map();
    (benefitsResult.recordset || []).forEach((r) => {
        const uid = Number(r?.UserId || 0);
        const key = String(r?.BenefitKey || '').trim();
        if (!(uid > 0) || !key) return;
        if (!map.has(uid)) map.set(uid, {});
        map.get(uid)[key] = !!r?.IsEnabled;
    });

    rows.forEach((row) => {
        const uid = Number(row?.Id || 0);
        const hrInfo = parseJsonSafe(row?.HRInfo, {}) || {};
        const benefits = map.get(uid);
        if (benefits) {
            hrInfo.benefits = {
                ...(hrInfo.benefits && typeof hrInfo.benefits === 'object' ? hrInfo.benefits : {}),
                ...benefits
            };
        }
        row.HRInfo = hrInfo;
    });

    return rows;
}

module.exports = async function (context, req) {
    // Handle CORS
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

    try {
        const pool = await sql.connect(getConfig());
        const id = req.params.id;
        const includeInactive = (() => {
            const raw = req?.query?.includeInactive ?? req?.query?.IncludeInactive;
            if (raw === undefined || raw === null || raw === '') return false;
            if (typeof raw === 'boolean') return raw;
            const normalized = String(raw).trim().toLowerCase();
            return normalized === '1' || normalized === 'true' || normalized === 'yes';
        })();

        const parseClinicIds = (value) => {
            if (!value) return [];
            const raw = Array.isArray(value) ? value : [value];
            const ids = raw
                .flatMap((v) => {
                    if (v == null) return [];
                    if (typeof v === 'number') return [v];
                    if (typeof v === 'string') {
                        // Allow comma-separated list
                        return v.split(',').map((x) => x.trim()).filter(Boolean);
                    }
                    return [];
                })
                .map((v) => Number.parseInt(String(v), 10))
                .filter((n) => Number.isInteger(n) && n > 0);
            return Array.from(new Set(ids));
        };

        if (req.method === 'GET') {
            const userColumns = await getTableColumns(pool, 'Users');
            if (userColumns.size === 0) {
                context.res = { status: 500, headers, body: { error: 'Users table not found.' } };
                return;
            }

            const userClinicColumns = await getTableColumns(pool, 'UserClinics');
            const clinicColumns = await getTableColumns(pool, 'Clinics');

            const hasUserIsActive = hasColumn(userColumns, 'IsActive');
            const hasUserClinics = userClinicColumns.size > 0 && hasColumn(userClinicColumns, 'UserId') && hasColumn(userClinicColumns, 'ClinicId');
            const hasClinicsForJoin = clinicColumns.size > 0 && hasColumn(clinicColumns, 'Id') && hasColumn(clinicColumns, 'Name');
            const hasClinicIsActive = hasColumn(clinicColumns, 'IsActive');
            const userHrInfoColumns = await getTableColumns(pool, 'UserHRInfo');
            const hasUserHrInfoJoin = userHrInfoColumns.size > 0 && hasColumn(userHrInfoColumns, 'UserId');
            const hrDataColumn = hasColumn(userHrInfoColumns, 'HRDataJson')
                ? 'HRDataJson'
                : (hasColumn(userHrInfoColumns, 'HRData')
                    ? 'HRData'
                    : (hasColumn(userHrInfoColumns, 'HRInfo') ? 'HRInfo' : null));

            const preferredColumns = [
                'Id', 'Username', 'PasswordHash', 'FirstName', 'MiddleName', 'LastName', 'Gender', 'DateOfBirth',
                'PersonalEmail', 'WorkEmail', 'HomePhone', 'CellPhone', 'Address', 'City', 'State', 'ZipCode',
                'JobTitle', 'StaffType', 'EmployeeType', 'Department', 'EmployeeStatus', 'Role', 'HireDate',
                'HourlyRate', 'Salary', 'Color', 'ProfileImage', 'Permissions', 'CreatedDate', 'ModifiedDate',
                'IsActive', 'IsOnline', 'LastSeen', 'RoleId', 'SSN', 'Title', 'EmergencyContactName',
                'EmergencyContactRelationship', 'EmergencyContactPhone', 'EmergencyContactEmail', 'NextReviewDate',
                'OfficeLocation', 'DirectSupervisor', 'SeparationDate', 'SeparationReason', 'PhotoFileName',
                'Documents', 'HRInfo', 'FailedLoginAttempts'
            ].filter((name) => hasColumn(userColumns, name));

            if (!preferredColumns.some((c) => c.toLowerCase() === 'id')) {
                preferredColumns.unshift('Id');
            }

            const baseSelect = preferredColumns.map((c) => `u.${c}`).join(', ');
            const clinicIdsJson = hasUserClinics
                ? `, ISNULL((SELECT uc.ClinicId AS Id FROM UserClinics uc WHERE uc.UserId = u.Id FOR JSON PATH), '[]') AS ClinicIdsJson`
                : `, '[]' AS ClinicIdsJson`;
            const clinicsJson = (hasUserClinics && hasClinicsForJoin)
                ? `, ISNULL((SELECT c.Id AS Id, c.Name AS Name FROM UserClinics uc JOIN Clinics c ON c.Id = uc.ClinicId WHERE uc.UserId = u.Id ${hasClinicIsActive ? 'AND c.IsActive = 1' : ''} FOR JSON PATH), '[]') AS ClinicsJson`
                : `, '[]' AS ClinicsJson`;
            const hrDataSelect = (hasUserHrInfoJoin && hrDataColumn)
                ? `, uhr.${hrDataColumn} AS UserHRDataJson`
                : '';
            const hrJoin = (hasUserHrInfoJoin && hrDataColumn)
                ? 'LEFT JOIN UserHRInfo uhr ON uhr.UserId = u.Id'
                : '';

            if (id) {
                const where = ['u.Id = @id'];
                if (hasUserIsActive && !includeInactive) {
                    where.push('ISNULL(u.IsActive, 1) = 1');
                }

                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`SELECT ${baseSelect}${clinicIdsJson}${clinicsJson}${hrDataSelect} FROM Users u ${hrJoin} WHERE ${where.join(' AND ')}`);

                if (result.recordset.length === 0) {
                    context.res = { status: 404, headers, body: { error: 'User not found' } };
                } else {
                    const row = result.recordset[0];
                    const clinicIdObjs = parseJsonSafe(row.ClinicIdsJson, []);
                    const clinics = parseJsonSafe(row.ClinicsJson, []);
                    const clinicIds = Array.isArray(clinicIdObjs)
                        ? clinicIdObjs.map((o) => o && o.Id).map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isInteger(n) && n > 0)
                        : [];

                    delete row.ClinicIdsJson;
                    delete row.ClinicsJson;
                    if (row.UserHRDataJson != null) row.HRInfo = row.UserHRDataJson;
                    delete row.UserHRDataJson;

                    const hydrated = await hydrateBenefitsForUsers(pool, [row]);
                    const hydratedRow = hydrated[0] || row;

                    context.res = {
                        status: 200,
                        headers,
                        body: {
                            ...hydratedRow,
                            ClinicIds: clinicIds,
                            Clinics: Array.isArray(clinics) ? clinics : []
                        }
                    };
                }
            } else {
                const whereClause = (hasUserIsActive && !includeInactive) ? 'WHERE ISNULL(u.IsActive, 1) = 1' : '';
                const orderBy = hasColumn(userColumns, 'FirstName') ? 'ORDER BY u.FirstName' : 'ORDER BY u.Id';

                const result = await pool.request()
                    .query(`SELECT ${baseSelect}${clinicIdsJson}${clinicsJson}${hrDataSelect} FROM Users u ${hrJoin} ${whereClause} ${orderBy}`);

                const users = (result.recordset || []).map((row) => {
                    const clinicIdObjs = parseJsonSafe(row.ClinicIdsJson, []);
                    const clinics = parseJsonSafe(row.ClinicsJson, []);
                    const clinicIds = Array.isArray(clinicIdObjs)
                        ? clinicIdObjs.map((o) => o && o.Id).map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isInteger(n) && n > 0)
                        : [];
                    if (row.UserHRDataJson != null) row.HRInfo = row.UserHRDataJson;
                    const { ClinicIdsJson, ClinicsJson, ...rest } = row;
                    delete rest.UserHRDataJson;
                    return {
                        ...rest,
                        ClinicIds: clinicIds,
                        Clinics: Array.isArray(clinics) ? clinics : []
                    };
                });

                const hydratedUsers = await hydrateBenefitsForUsers(pool, users);

                context.res = { status: 200, headers, body: hydratedUsers };
            }
        } else if (req.method === 'POST') {
            const body = parseRequestBody(req.body);
            const userColumns = await getTableColumns(pool, 'Users');
            const hasUsersHrInfoColumn = hasColumn(userColumns, 'HRInfo');
            const clinicIds = parseClinicIds(body.clinicIds || body.ClinicIds || body.clinicId || body.ClinicId);
            const permissionsValue = toJsonString(body.permissions || body.Permissions);
            const documentsValue = toJsonString(body.documents || body.Documents);
            const hrInfoValue = toJsonString(body.hrInfo || body.HRInfo);

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const result = await new sql.Request(transaction)
                    .input('username', sql.NVarChar, body.username)
                    .input('passwordHash', sql.NVarChar, body.password || body.passwordHash || body.PasswordHash || 'changeme')
                    .input('firstName', sql.NVarChar, toNullableString(body.firstName || body.FirstName))
                    .input('middleName', sql.NVarChar, toNullableString(body.middleName || body.MiddleName))
                    .input('lastName', sql.NVarChar, toNullableString(body.lastName || body.LastName))
                    .input('gender', sql.NVarChar, toNullableString(body.gender || body.Gender))
                    .input('dateOfBirth', sql.Date, toNullableDate(body.dateOfBirth || body.DateOfBirth))
                    .input('personalEmail', sql.NVarChar, toNullableString(body.personalEmail || body.PersonalEmail))
                    .input('workEmail', sql.NVarChar, toNullableString(body.workEmail || body.WorkEmail))
                    .input('homePhone', sql.NVarChar, toNullableString(body.homePhone || body.HomePhone))
                    .input('cellPhone', sql.NVarChar, toNullableString(body.cellPhone || body.CellPhone))
                    .input('address', sql.NVarChar, toNullableString(body.address || body.Address))
                    .input('city', sql.NVarChar, toNullableString(body.city || body.City))
                    .input('state', sql.NVarChar, toNullableString(body.state || body.State))
                    .input('zipCode', sql.NVarChar, toNullableString(body.zipCode || body.ZipCode))
                    .input('jobTitle', sql.NVarChar, toNullableString(body.jobTitle || body.JobTitle))
                    .input('staffType', sql.NVarChar, normalizeStaffType(body.staffType || body.StaffType, 'non-clinical'))
                    .input('employeeType', sql.NVarChar, normalizeEmployeeType(body.employeeType || body.EmployeeType, 'assistant'))
                    .input('department', sql.NVarChar, toNullableString(body.department || body.Department))
                    .input('employeeStatus', sql.NVarChar, normalizeEmployeeStatus(body.employeeStatus || body.EmployeeStatus, 'Active'))
                    .input('role', sql.NVarChar, normalizeRoleValue(body.role || body.Role, 'user'))
                    .input('hireDate', sql.Date, toNullableDate(body.hireDate || body.HireDate))
                    .input('hourlyRate', sql.Decimal(10,2), toNullableNumber(body.hourlyRate || body.HourlyRate))
                    .input('salary', sql.Decimal(12,2), toNullableNumber(body.salary || body.Salary))
                    .input('color', sql.NVarChar, body.color || '#3b82f6')
                    .input('profileImage', sql.NVarChar(sql.MAX), toNullableString(body.profileImage || body.ProfileImage || body.photoData || body.PhotoData))
                    .input('permissions', sql.NVarChar(sql.MAX), permissionsValue)
                    .input('ssn', sql.NVarChar, toNullableString(body.ssn || body.SSN))
                    .input('title', sql.NVarChar, toNullableString(body.title || body.Title))
                    .input('emergencyContactName', sql.NVarChar, toNullableString(body.emergencyContactName || body.EmergencyContactName))
                    .input('emergencyContactRelationship', sql.NVarChar, toNullableString(body.emergencyContactRelationship || body.EmergencyContactRelationship))
                    .input('emergencyContactPhone', sql.NVarChar, toNullableString(body.emergencyContactPhone || body.EmergencyContactPhone))
                    .input('emergencyContactEmail', sql.NVarChar, toNullableString(body.emergencyContactEmail || body.EmergencyContactEmail))
                    .input('nextReviewDate', sql.Date, toNullableDate(body.nextReviewDate || body.NextReviewDate))
                    .input('officeLocation', sql.NVarChar, toNullableString(body.officeLocation || body.OfficeLocation))
                    .input('directSupervisor', sql.NVarChar, toNullableString(body.directSupervisor || body.DirectSupervisor))
                    .input('separationDate', sql.Date, toNullableDate(body.separationDate || body.SeparationDate))
                    .input('separationReason', sql.NVarChar, toNullableString(body.separationReason || body.SeparationReason))
                    .input('photoFileName', sql.NVarChar, toNullableString(body.photoFileName || body.PhotoFileName))
                    .input('documents', sql.NVarChar(sql.MAX), documentsValue)
                    .input('hrInfo', sql.NVarChar(sql.MAX), hrInfoValue)
                    .input('failedLoginAttempts', sql.Int, toNullableNumber(body.failedLoginAttempts || body.FailedLoginAttempts) ?? 0)
                    .input('isActive', sql.Bit, body.isActive === undefined && body.IsActive === undefined ? 1 : toBooleanBit(body.isActive ?? body.IsActive))
                    .input('isOnline', sql.Bit, toBooleanBit(body.isOnline || body.IsOnline))
                    .input('lastSeen', sql.DateTime2, body.lastSeen || body.LastSeen || null)
                    .input('roleId', sql.Int, toNullableNumber(body.roleId || body.RoleId))
                        .query(`INSERT INTO Users (Username, PasswordHash, FirstName, MiddleName, LastName, Gender, DateOfBirth,
                            PersonalEmail, WorkEmail, HomePhone, CellPhone, Address, City, State, ZipCode,
                            JobTitle, StaffType, EmployeeType, Department, EmployeeStatus, Role, HireDate,
                            HourlyRate, Salary, Color, ProfileImage, Permissions, SSN, Title,
                            EmergencyContactName, EmergencyContactRelationship, EmergencyContactPhone,
                            EmergencyContactEmail, NextReviewDate, OfficeLocation, DirectSupervisor,
                            SeparationDate, SeparationReason, PhotoFileName, Documents${hasUsersHrInfoColumn ? ', HRInfo' : ''},
                            FailedLoginAttempts, IsActive, IsOnline, LastSeen, RoleId)
                            OUTPUT INSERTED.Id
                            VALUES (@username, @passwordHash, @firstName, @middleName, @lastName, @gender, @dateOfBirth,
                            @personalEmail, @workEmail, @homePhone, @cellPhone, @address, @city, @state, @zipCode,
                            @jobTitle, @staffType, @employeeType, @department, @employeeStatus, @role, @hireDate,
                            @hourlyRate, @salary, @color, @profileImage, @permissions, @ssn, @title,
                            @emergencyContactName, @emergencyContactRelationship, @emergencyContactPhone,
                            @emergencyContactEmail, @nextReviewDate, @officeLocation, @directSupervisor,
                            @separationDate, @separationReason, @photoFileName, @documents${hasUsersHrInfoColumn ? ', @hrInfo' : ''},
                            @failedLoginAttempts, @isActive, @isOnline, @lastSeen, @roleId)`);

                const userId = result.recordset[0].Id;

                await upsertNormalizedHrInfoAndBenefits(transaction, userId, hrInfoValue);

                if (clinicIds.length) {
                    for (const clinicId of clinicIds) {
                        await new sql.Request(transaction)
                            .input('userId', sql.Int, userId)
                            .input('clinicId', sql.Int, clinicId)
                            .query('INSERT INTO UserClinics (UserId, ClinicId) VALUES (@userId, @clinicId)');
                    }
                }

                await transaction.commit();
                context.res = { status: 201, headers, body: { id: userId, message: 'User created' } };
            } catch (e) {
                await transaction.rollback();
                throw e;
            }
        } else if (req.method === 'PUT' && id) {
            const body = parseRequestBody(req.body);
            const userColumns = await getTableColumns(pool, 'Users');
            const hasUsersHrInfoColumn = hasColumn(userColumns, 'HRInfo');

            if (body && (
                body.hrInfoOnly === true || body.HRInfoOnly === true ||
                String(body.hrInfoOnly || '').toLowerCase() === 'true' ||
                String(body.HRInfoOnly || '').toLowerCase() === 'true'
            )) {
                const hrInfoValueForUsers = toJsonString(body.hrInfo ?? body.HRInfo ?? null);
                const transaction = new sql.Transaction(pool);
                await transaction.begin();
                try {
                    await upsertNormalizedHrInfoAndBenefits(transaction, id, body.hrInfo ?? body.HRInfo ?? null);

                    if (hasUsersHrInfoColumn && hrInfoValueForUsers != null) {
                        await new sql.Request(transaction)
                            .input('id', sql.Int, id)
                            .input('hrInfo', sql.NVarChar(sql.MAX), hrInfoValueForUsers)
                            .query(`UPDATE Users SET HRInfo = @hrInfo${hasColumn(userColumns, 'ModifiedDate') ? ', ModifiedDate = GETUTCDATE()' : ''} WHERE Id = @id`);
                    }

                    await transaction.commit();
                    context.res = {
                        status: 200,
                        headers,
                        body: {
                            message: 'HR info updated',
                            user: {
                                Id: Number(id),
                                HRInfo: body.hrInfo ?? body.HRInfo ?? null
                            }
                        }
                    };
                    await pool.close();
                    return;
                } catch (e) {
                    await transaction.rollback();
                    throw e;
                }
            }

            if (body && (
                body.deactivateOnly === true || body.DeactivateOnly === true ||
                String(body.deactivateOnly || '').toLowerCase() === 'true' ||
                String(body.DeactivateOnly || '').toLowerCase() === 'true'
            )) {
                const userColumns = await getTableColumns(pool, 'Users');
                const setParts = [];

                if (hasColumn(userColumns, 'IsActive')) {
                    const hasIsActiveValue = !(body.isActive === undefined && body.IsActive === undefined);
                    if (hasIsActiveValue) {
                        setParts.push('IsActive = @isActive');
                    }
                }

                if (hasColumn(userColumns, 'IsOnline')) {
                    const hasIsOnlineValue = !(body.isOnline === undefined && body.IsOnline === undefined);
                    if (hasIsOnlineValue) {
                        setParts.push('IsOnline = @isOnline');
                    }
                }

                if (hasColumn(userColumns, 'ModifiedDate')) {
                    setParts.push('ModifiedDate = GETUTCDATE()');
                }

                if (setParts.length === 0) {
                    context.res = {
                        status: 400,
                        headers,
                        body: { error: 'No supported deactivation fields found on Users table.' }
                    };
                    await pool.close();
                    return;
                }

                const request = pool.request().input('id', sql.Int, id);
                if (setParts.some((part) => part.includes('@isActive'))) {
                    request.input('isActive', sql.Bit, toBooleanBit(body.isActive ?? body.IsActive));
                }
                if (setParts.some((part) => part.includes('@isOnline'))) {
                    request.input('isOnline', sql.Bit, toBooleanBit(body.isOnline ?? body.IsOnline));
                }

                const deactivateResult = await request.query(`UPDATE Users SET ${setParts.join(', ')} WHERE Id = @id`);
                const affectedRows = Array.isArray(deactivateResult.rowsAffected)
                    ? deactivateResult.rowsAffected.reduce((sum, n) => sum + Number(n || 0), 0)
                    : 0;

                if (affectedRows === 0) {
                    context.res = { status: 404, headers, body: { error: 'User not found or not updated' } };
                } else {
                    const lifecycleState = resolveScheduleLifecycleState(body);
                    if (lifecycleState) {
                        await syncUserSchedulesLifecycle(pool, id, lifecycleState);
                    }
                    context.res = { status: 200, headers, body: { message: 'User deactivated', user: { Id: Number(id) } } };
                }
                await pool.close();
                return;
            }

            const clinicIds = parseClinicIds(body.clinicIds || body.ClinicIds || body.clinicId || body.ClinicId);
            const permissionsValue = toJsonString(body.permissions || body.Permissions);
            const documentsValue = toJsonString(body.documents || body.Documents);
            const hrInfoValue = toJsonString(body.hrInfo || body.HRInfo);
            const hasClinicFields = hasOwn(body, 'clinicIds') || hasOwn(body, 'ClinicIds') || hasOwn(body, 'clinicId') || hasOwn(body, 'ClinicId');
            const clearClinicsRequested = toBooleanBit(body.clearClinics ?? body.ClearClinics);
            // Only mutate UserClinics when clinics are explicitly supplied or caller explicitly requests clearing.
            const shouldUpdateClinics = clearClinicsRequested || (hasClinicFields && clinicIds.length > 0);
            const lifecycleState = resolveScheduleLifecycleState(body);

            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const updateResult = await new sql.Request(transaction)
                    .input('id', sql.Int, id)
                    .input('username', sql.NVarChar, toNullableString(body.username || body.Username))
                    .input('firstName', sql.NVarChar, toNullableString(body.firstName || body.FirstName))
                    .input('middleName', sql.NVarChar, toNullableString(body.middleName || body.MiddleName))
                    .input('lastName', sql.NVarChar, toNullableString(body.lastName || body.LastName))
                    .input('gender', sql.NVarChar, toNullableString(body.gender || body.Gender))
                    .input('dateOfBirth', sql.Date, toNullableDate(body.dateOfBirth || body.DateOfBirth))
                    .input('personalEmail', sql.NVarChar, toNullableString(body.personalEmail || body.PersonalEmail))
                    .input('workEmail', sql.NVarChar, toNullableString(body.workEmail || body.WorkEmail))
                    .input('homePhone', sql.NVarChar, toNullableString(body.homePhone || body.HomePhone))
                    .input('cellPhone', sql.NVarChar, toNullableString(body.cellPhone || body.CellPhone))
                    .input('address', sql.NVarChar, toNullableString(body.address || body.Address))
                    .input('city', sql.NVarChar, toNullableString(body.city || body.City))
                    .input('state', sql.NVarChar, toNullableString(body.state || body.State))
                    .input('zipCode', sql.NVarChar, toNullableString(body.zipCode || body.ZipCode))
                    .input('jobTitle', sql.NVarChar, toNullableString(body.jobTitle || body.JobTitle))
                    .input('staffType', sql.NVarChar, normalizeStaffType(body.staffType || body.StaffType, null))
                    .input('employeeType', sql.NVarChar, normalizeEmployeeType(body.employeeType || body.EmployeeType, null))
                    .input('department', sql.NVarChar, toNullableString(body.department || body.Department))
                    .input('employeeStatus', sql.NVarChar, normalizeEmployeeStatus(body.employeeStatus || body.EmployeeStatus, null))
                    .input('role', sql.NVarChar, normalizeRoleValue(body.role || body.Role, null))
                    .input('hireDate', sql.Date, toNullableDate(body.hireDate || body.HireDate))
                    .input('hourlyRate', sql.Decimal(10,2), toNullableNumber(body.hourlyRate || body.HourlyRate))
                    .input('salary', sql.Decimal(12,2), toNullableNumber(body.salary || body.Salary))
                    .input('color', sql.NVarChar, toNullableString(body.color || body.Color))
                    .input('profileImage', sql.NVarChar(sql.MAX), toNullableString(body.profileImage || body.ProfileImage || body.photoData || body.PhotoData))
                    .input('permissions', sql.NVarChar(sql.MAX), permissionsValue)
                    .input('ssn', sql.NVarChar, toNullableString(body.ssn || body.SSN))
                    .input('title', sql.NVarChar, toNullableString(body.title || body.Title))
                    .input('emergencyContactName', sql.NVarChar, toNullableString(body.emergencyContactName || body.EmergencyContactName))
                    .input('emergencyContactRelationship', sql.NVarChar, toNullableString(body.emergencyContactRelationship || body.EmergencyContactRelationship))
                    .input('emergencyContactPhone', sql.NVarChar, toNullableString(body.emergencyContactPhone || body.EmergencyContactPhone))
                    .input('emergencyContactEmail', sql.NVarChar, toNullableString(body.emergencyContactEmail || body.EmergencyContactEmail))
                    .input('nextReviewDate', sql.Date, toNullableDate(body.nextReviewDate || body.NextReviewDate))
                    .input('officeLocation', sql.NVarChar, toNullableString(body.officeLocation || body.OfficeLocation))
                    .input('directSupervisor', sql.NVarChar, toNullableString(body.directSupervisor || body.DirectSupervisor))
                    .input('separationDate', sql.Date, toNullableDate(body.separationDate || body.SeparationDate))
                    .input('separationReason', sql.NVarChar, toNullableString(body.separationReason || body.SeparationReason))
                    .input('photoFileName', sql.NVarChar, toNullableString(body.photoFileName || body.PhotoFileName))
                    .input('documents', sql.NVarChar(sql.MAX), documentsValue)
                    .input('hrInfo', sql.NVarChar(sql.MAX), hrInfoValue)
                    .input('failedLoginAttempts', sql.Int, toNullableNumber(body.failedLoginAttempts || body.FailedLoginAttempts) ?? 0)
                    .input('isActive', sql.Bit, body.isActive === undefined && body.IsActive === undefined ? null : toBooleanBit(body.isActive || body.IsActive))
                    .input('isOnline', sql.Bit, toBooleanBit(body.isOnline || body.IsOnline))
                    .input('lastSeen', sql.DateTime2, body.lastSeen || body.LastSeen || null)
                    .input('roleId', sql.Int, toNullableNumber(body.roleId || body.RoleId))
                    .query(`UPDATE Users SET FirstName=@firstName, MiddleName=@middleName, LastName=@lastName, 
                            Username = COALESCE(@username, Username),
                            Gender=@gender, DateOfBirth=@dateOfBirth, PersonalEmail=@personalEmail, WorkEmail=@workEmail,
                            HomePhone=@homePhone, CellPhone=@cellPhone, Address=@address, City=@city, State=@state, ZipCode=@zipCode,
                            JobTitle=@jobTitle,
                            StaffType = COALESCE(@staffType,
                                CASE
                                    WHEN StaffType IN ('clinical', 'non-clinical') THEN StaffType
                                    ELSE 'non-clinical'
                                END
                            ),
                            EmployeeType = COALESCE(@employeeType,
                                CASE
                                    WHEN EmployeeType IN ('provider', 'assistant') THEN EmployeeType
                                    WHEN LOWER(ISNULL(JobTitle, '')) LIKE '%dentist%' OR LOWER(ISNULL(JobTitle, '')) LIKE '%doctor%' THEN 'provider'
                                    WHEN LOWER(ISNULL(StaffType, '')) = 'clinical' THEN 'provider'
                                    ELSE 'assistant'
                                END
                            ),
                            Department=@department,
                            EmployeeStatus = COALESCE(@employeeStatus,
                                CASE
                                    WHEN EmployeeStatus IN ('Active', 'Inactive', 'On Leave', 'Terminated') THEN EmployeeStatus
                                    ELSE 'Active'
                                END
                            ),
                            Role = COALESCE(@role,
                                CASE
                                    WHEN Role IN ('user', 'manager', 'admin') THEN Role
                                    ELSE 'user'
                                END
                            ),
                            HireDate=@hireDate, HourlyRate=@hourlyRate, Salary=@salary,
                            Color=@color, ProfileImage=@profileImage, Permissions=@permissions,
                            SSN=@ssn, Title=@title, EmergencyContactName=@emergencyContactName,
                            EmergencyContactRelationship=@emergencyContactRelationship,
                            EmergencyContactPhone=@emergencyContactPhone, EmergencyContactEmail=@emergencyContactEmail,
                            NextReviewDate=@nextReviewDate, OfficeLocation=@officeLocation,
                            DirectSupervisor=@directSupervisor, SeparationDate=@separationDate,
                            SeparationReason=@separationReason, PhotoFileName=@photoFileName,
                            Documents=@documents${hasUsersHrInfoColumn ? ', HRInfo=@hrInfo' : ''}, FailedLoginAttempts=@failedLoginAttempts,
                            IsActive=COALESCE(@isActive, IsActive, 1), IsOnline=@isOnline, LastSeen=@lastSeen, RoleId=@roleId,
                            ModifiedDate=GETUTCDATE() WHERE Id=@id`);

                const affectedRows = Array.isArray(updateResult.rowsAffected)
                    ? updateResult.rowsAffected.reduce((sum, n) => sum + Number(n || 0), 0)
                    : 0;
                if (affectedRows === 0) {
                    await transaction.rollback();
                    context.res = { status: 404, headers, body: { error: 'User not found or not updated' } };
                    await pool.close();
                    return;
                }

                if (shouldUpdateClinics) {
                    await new sql.Request(transaction)
                        .input('userId', sql.Int, id)
                        .query('DELETE FROM UserClinics WHERE UserId = @userId');

                    for (const clinicId of clinicIds) {
                        await new sql.Request(transaction)
                            .input('userId', sql.Int, id)
                            .input('clinicId', sql.Int, clinicId)
                            .query('INSERT INTO UserClinics (UserId, ClinicId) VALUES (@userId, @clinicId)');
                    }
                }

                await upsertNormalizedHrInfoAndBenefits(transaction, id, hrInfoValue);

                if (lifecycleState) {
                    await syncUserSchedulesLifecycle(transaction, id, lifecycleState);
                }

                await transaction.commit();

                const selectColumns = ['Id'];
                if (hasColumn(userColumns, 'Username')) selectColumns.push('Username');
                if (hasColumn(userColumns, 'HRInfo')) selectColumns.push('HRInfo');
                if (hasColumn(userColumns, 'ModifiedDate')) selectColumns.push('ModifiedDate');

                let updatedUser = { Id: Number(id) };
                try {
                    const refreshed = await pool.request()
                        .input('id', sql.Int, id)
                        .query(`SELECT ${selectColumns.join(', ')} FROM Users WHERE Id = @id`);
                    if (refreshed.recordset && refreshed.recordset[0]) {
                        updatedUser = refreshed.recordset[0];
                    }
                } catch (_) {
                    // Keep update successful even if refresh read fails.
                }

                try {
                    const normalizedHrCols = await getTableColumns(pool, 'UserHRInfo');
                    const normalizedHrCol = hasColumn(normalizedHrCols, 'HRDataJson')
                        ? 'HRDataJson'
                        : (hasColumn(normalizedHrCols, 'HRData')
                            ? 'HRData'
                            : (hasColumn(normalizedHrCols, 'HRInfo') ? 'HRInfo' : null));
                    if (normalizedHrCol) {
                        const normalizedHr = await pool.request()
                            .input('id', sql.Int, id)
                            .query(`SELECT TOP 1 ${normalizedHrCol} AS HRInfo FROM UserHRInfo WHERE UserId = @id`);
                        const normalizedHrValue = normalizedHr.recordset?.[0]?.HRInfo;
                        if (normalizedHrValue != null) {
                            updatedUser.HRInfo = normalizedHrValue;
                        }
                        const enriched = await hydrateBenefitsForUsers(pool, [updatedUser]);
                        updatedUser = enriched[0] || updatedUser;
                    }
                } catch (_) {
                    // Keep update successful even if normalized HR read fails.
                }

                context.res = { status: 200, headers, body: { message: 'User updated', user: updatedUser } };
            } catch (e) {
                await transaction.rollback();
                throw e;
            }
        } else if (req.method === 'DELETE' && id) {
            const userColumns = await getTableColumns(pool, 'Users');
            const hasUserIsActive = hasColumn(userColumns, 'IsActive');

            if (hasUserIsActive) {
                const softDeleteSets = ['IsActive = 0'];
                if (hasColumn(userColumns, 'IsOnline')) {
                    softDeleteSets.push('IsOnline = 0');
                }
                if (hasColumn(userColumns, 'ModifiedDate')) {
                    softDeleteSets.push('ModifiedDate = GETUTCDATE()');
                }

                const softDeleteResult = await pool.request()
                    .input('id', sql.Int, id)
                    .query(`UPDATE Users SET ${softDeleteSets.join(', ')} WHERE Id = @id`);

                const affectedRows = Array.isArray(softDeleteResult.rowsAffected)
                    ? softDeleteResult.rowsAffected.reduce((sum, n) => sum + Number(n || 0), 0)
                    : 0;

                if (affectedRows === 0) {
                    context.res = { status: 404, headers, body: { error: 'User not found' } };
                } else {
                    await syncUserSchedulesLifecycle(pool, id, { isActive: false, includeAssistantAssignments: true });
                    context.res = { status: 200, headers, body: { message: 'User deactivated' } };
                }
            } else {
                try {
                    const hardDeleteResult = await pool.request()
                        .input('id', sql.Int, id)
                        .query('DELETE FROM Users WHERE Id = @id');

                    const affectedRows = Array.isArray(hardDeleteResult.rowsAffected)
                        ? hardDeleteResult.rowsAffected.reduce((sum, n) => sum + Number(n || 0), 0)
                        : 0;

                    if (affectedRows === 0) {
                        context.res = { status: 404, headers, body: { error: 'User not found' } };
                    } else {
                        context.res = { status: 200, headers, body: { message: 'User deleted' } };
                    }
                } catch (deleteErr) {
                    if (Number(deleteErr?.number || 0) === 547) {
                        context.res = {
                            status: 409,
                            headers,
                            body: { error: 'Cannot delete user because related records exist. Use deactivation instead.' }
                        };
                    } else {
                        throw deleteErr;
                    }
                }
            }
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { 
            status: 500, 
            headers, 
            body: { error: 'Database error', details: err.message } 
        };
    }
};
