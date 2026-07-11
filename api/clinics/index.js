const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');
const https = require('https');

const GRAY_FOREST_CLINIC_API_BASE = 'https://gray-forest-05ad14f10.3.azurestaticapps.net/api/clinics';
const BLACK_SKY_GRAY_FOREST_CLINIC_USER_ID = '46';
const CLINIC_SUPPLEMENT_FIELDS = [
    'mainPhone',
    'afterHoursPhone',
    'fax',
    'website',
    'defaultDentist',
    'taxonomyNumber',
    'clinicNPI',
    'clinicTIN',
    'legalName',
    'legalAddress',
    'logo'
];

function isConnectionError(error) {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return [
        code.includes('econn'),
        code.includes('socket'),
        code.includes('timeout'),
        code.includes('enotopen'),
        message.includes('connection'),
        message.includes('socket'),
        message.includes('timeout'),
        message.includes('closed')
    ].some(Boolean);
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

function requestJson(url, options, body) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? undefined : JSON.stringify(body || {});
        const req = https.request(url, {
            method: options.method,
            headers: {
                ...options.headers,
                ...(data !== undefined ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let parsed = raw;
                try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
                resolve({ status: res.statusCode || 500, body: parsed });
            });
        });
        req.on('error', reject);
        if (data !== undefined) req.write(data);
        req.end();
    });
}

function getClinicId(row) {
    return row?.Id ?? row?.id ?? row?.ClinicId ?? row?.clinicId ?? row?.clinicID ?? row?.ClinicID ?? null;
}

function getSupplementClinicId(req, proxyResult) {
    const routeId = req.params && req.params.id ? String(req.params.id).trim() : '';
    if (routeId) return routeId;
    const resultId = getClinicId(proxyResult?.body || {});
    return resultId === null || resultId === undefined ? '' : String(resultId).trim();
}

function pickClinicSupplement(body) {
    const source = body || {};
    const supplement = {};
    CLINIC_SUPPLEMENT_FIELDS.forEach((field) => {
        const pascal = field.charAt(0).toUpperCase() + field.slice(1);
        const value = source[field] ?? source[pascal];
        if (value !== undefined) supplement[field] = value;
    });
    return supplement;
}

async function ensureClinicSupplementTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID('dbo.ClinicSupplementFields', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ClinicSupplementFields (
                ClinicId NVARCHAR(64) NOT NULL PRIMARY KEY,
                Payload NVARCHAR(MAX) NOT NULL,
                ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            )
        END
    `);
}

async function saveClinicSupplement(context, clinicId, body) {
    if (!clinicId) return;
    const supplement = pickClinicSupplement(body);
    if (Object.keys(supplement).length === 0) return;

    try {
        const pool = await getPool();
        await ensureClinicSupplementTable(pool);
        await pool.request()
            .input('clinicId', sql.NVarChar(64), String(clinicId))
            .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(supplement))
            .query(`
                MERGE dbo.ClinicSupplementFields AS target
                USING (SELECT @clinicId AS ClinicId, @payload AS Payload) AS source
                ON target.ClinicId = source.ClinicId
                WHEN MATCHED THEN UPDATE SET Payload = source.Payload, ModifiedDate = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (ClinicId, Payload) VALUES (source.ClinicId, source.Payload);
            `);
    } catch (error) {
        context.log.warn('Could not save clinic supplemental fields:', error?.message || error);
    }
}

async function deleteClinicSupplement(context, clinicId) {
    if (!clinicId) return;
    try {
        const pool = await getPool();
        await ensureClinicSupplementTable(pool);
        await pool.request()
            .input('clinicId', sql.NVarChar(64), String(clinicId))
            .query('DELETE FROM dbo.ClinicSupplementFields WHERE ClinicId = @clinicId');
    } catch (error) {
        context.log.warn('Could not delete clinic supplemental fields:', error?.message || error);
    }
}

async function loadClinicSupplements(context, clinicIds) {
    const ids = [...new Set((clinicIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (ids.length === 0) return new Map();

    try {
        const pool = await getPool();
        await ensureClinicSupplementTable(pool);
        const values = ids.map((_, index) => `(@id${index})`).join(', ');
        const request = pool.request();
        ids.forEach((id, index) => request.input(`id${index}`, sql.NVarChar(64), id));
        const result = await request.query(`
            SELECT ClinicId, Payload
            FROM dbo.ClinicSupplementFields
            WHERE ClinicId IN (SELECT ClinicId FROM (VALUES ${values}) AS ids(ClinicId))
        `);

        const map = new Map();
        (result.recordset || []).forEach((row) => {
            try {
                map.set(String(row.ClinicId), JSON.parse(row.Payload || '{}'));
            } catch (_) {}
        });
        return map;
    } catch (error) {
        context.log.warn('Could not load clinic supplemental fields:', error?.message || error);
        return new Map();
    }
}

function applyClinicSupplement(row, supplements) {
    if (!row || typeof row !== 'object') return row;
    const clinicId = getClinicId(row);
    const supplement = supplements.get(String(clinicId || ''));
    if (!supplement) return row;

    return {
        ...row,
        MainPhone: supplement.mainPhone ?? row.MainPhone,
        mainPhone: supplement.mainPhone ?? row.mainPhone,
        AfterHoursPhone: supplement.afterHoursPhone ?? row.AfterHoursPhone,
        afterHoursPhone: supplement.afterHoursPhone ?? row.afterHoursPhone,
        Fax: supplement.fax ?? row.Fax,
        fax: supplement.fax ?? row.fax,
        Website: supplement.website ?? row.Website,
        website: supplement.website ?? row.website,
        DefaultDentist: supplement.defaultDentist ?? row.DefaultDentist,
        defaultDentist: supplement.defaultDentist ?? row.defaultDentist,
        TaxonomyNumber: supplement.taxonomyNumber ?? row.TaxonomyNumber,
        taxonomyNumber: supplement.taxonomyNumber ?? row.taxonomyNumber,
        ClinicNPI: supplement.clinicNPI ?? row.ClinicNPI,
        clinicNPI: supplement.clinicNPI ?? row.clinicNPI,
        ClinicTIN: supplement.clinicTIN ?? row.ClinicTIN,
        clinicTIN: supplement.clinicTIN ?? row.clinicTIN,
        LegalName: supplement.legalName ?? row.LegalName,
        legalName: supplement.legalName ?? row.legalName,
        LegalAddress: supplement.legalAddress ?? row.LegalAddress,
        legalAddress: supplement.legalAddress ?? row.legalAddress,
        Logo: supplement.logo ?? row.Logo,
        logo: supplement.logo ?? row.logo
    };
}

async function mergeClinicSupplements(context, body) {
    if (Array.isArray(body)) {
        const ids = body.map(getClinicId).filter((id) => id !== null && id !== undefined);
        const supplements = await loadClinicSupplements(context, ids);
        return body.map((row) => applyClinicSupplement(row, supplements));
    }

    const clinicId = getClinicId(body || {});
    const supplements = await loadClinicSupplements(context, [clinicId]);
    return applyClinicSupplement(body, supplements);
}

async function proxyClinicToGrayForest(context, req, responseHeaders) {
    const id = req.params && req.params.id ? String(req.params.id).trim() : '';
    const url = new URL(id ? `${GRAY_FOREST_CLINIC_API_BASE}/${encodeURIComponent(id)}` : GRAY_FOREST_CLINIC_API_BASE);
    Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const proxyHeaders = { 'Content-Type': 'application/json' };
    const userId = req.headers && (req.headers['x-user-id'] || req.headers['X-User-Id']);
    proxyHeaders['X-User-Id'] = String(userId || '1') === '1'
        ? BLACK_SKY_GRAY_FOREST_CLINIC_USER_ID
        : String(userId);
    const authorization = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (authorization) proxyHeaders.Authorization = String(authorization);

    const method = String(req.method || '').toUpperCase();
    const hasBody = !['GET', 'DELETE'].includes(method);
    const result = await requestJson(url, { method: req.method, headers: proxyHeaders }, hasBody ? req.body : undefined);

    if (result.status >= 200 && result.status < 300) {
        if (method === 'GET') {
            result.body = await mergeClinicSupplements(context, result.body);
        } else if (method === 'POST' || method === 'PUT') {
            await saveClinicSupplement(context, getSupplementClinicId(req, result), req.body);
            result.body = await mergeClinicSupplements(context, result.body);
        } else if (method === 'DELETE') {
            await deleteClinicSupplement(context, id);
        }
    }

    context.res = { status: result.status, headers: responseHeaders, body: result.body };
}

const WORKING_HOURS_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
];

function normalizeTime(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    if (!text) return '';
    return text.slice(0, 5);
}

function normalizeOperatingHoursPayload(raw) {
    if (!raw) return null;

    let source = raw;
    if (typeof raw === 'string') {
        try {
            source = JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    if (!source || typeof source !== 'object') return null;

    const normalized = {};
    WORKING_HOURS_DAYS.forEach((day) => {
        const entry = source[day] || source[day.charAt(0).toUpperCase() + day.slice(1)] || {};
        const isOpen = entry?.isOpen === true || entry?.IsOpen === true;
        const open = isOpen ? normalizeTime(entry?.open ?? entry?.OpenTime ?? entry?.start) : '';
        const close = isOpen ? normalizeTime(entry?.close ?? entry?.CloseTime ?? entry?.end) : '';
        normalized[day] = { isOpen, open, close };
    });

    return normalized;
}

function parseOperatingHoursFromClinicRow(clinic) {
    const raw = clinic?.OperatingHours ?? clinic?.operatingHours;
    if (!raw) return null;

    if (typeof raw === 'object') {
        return normalizeOperatingHoursPayload(raw);
    }

    if (typeof raw === 'string') {
        return normalizeOperatingHoursPayload(raw);
    }

    return null;
}

async function getClinicWorkingHoursMap(pool, clinicId = null) {
    const request = pool.request();
    let query = `
        SELECT ClinicId,
               LOWER(DayKey) AS DayKey,
               IsOpen,
               CASE WHEN OpenTime IS NULL THEN '' ELSE CONVERT(VARCHAR(5), OpenTime, 108) END AS OpenTime,
               CASE WHEN CloseTime IS NULL THEN '' ELSE CONVERT(VARCHAR(5), CloseTime, 108) END AS CloseTime
        FROM ClinicWorkingHours
    `;

    if (clinicId !== null && clinicId !== undefined) {
        query += ' WHERE ClinicId = @clinicId';
        request.input('clinicId', sql.Int, clinicId);
    }

    const result = await request.query(query);
    const rows = result?.recordset || [];
    const map = new Map();

    rows.forEach((row) => {
        const key = String(row?.ClinicId || '');
        if (!key) return;
        if (!map.has(key)) {
            map.set(key, {});
        }

        map.get(key)[String(row?.DayKey || '').toLowerCase()] = {
            isOpen: row?.IsOpen === true,
            open: normalizeTime(row?.OpenTime),
            close: normalizeTime(row?.CloseTime)
        };
    });

    return map;
}

async function saveClinicWorkingHours(pool, clinicId, operatingHours) {
    await pool.request()
        .input('clinicId', sql.Int, clinicId)
        .query('DELETE FROM ClinicWorkingHours WHERE ClinicId = @clinicId');

    if (!operatingHours) return;

    for (const day of WORKING_HOURS_DAYS) {
        const row = operatingHours[day] || {};
        const isOpen = row?.isOpen === true;
        const open = isOpen ? normalizeTime(row?.open) : '';
        const close = isOpen ? normalizeTime(row?.close) : '';

        await pool.request()
            .input('clinicId', sql.Int, clinicId)
            .input('dayKey', sql.NVarChar(20), day)
            .input('isOpen', sql.Bit, isOpen ? 1 : 0)
            .input('openTime', sql.NVarChar(8), open || null)
            .input('closeTime', sql.NVarChar(8), close || null)
            .query(`
                INSERT INTO ClinicWorkingHours (ClinicId, DayKey, IsOpen, OpenTime, CloseTime)
                VALUES (
                    @clinicId,
                    @dayKey,
                    @isOpen,
                    CASE WHEN @openTime IS NULL THEN NULL ELSE CAST(@openTime AS time) END,
                    CASE WHEN @closeTime IS NULL THEN NULL ELSE CAST(@closeTime AS time) END
                )
            `);
    }
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    await proxyClinicToGrayForest(context, req, headers);
    return;

    try {
        const pool = await getPool();
        const clinicColumns = await getTableColumns(pool, 'Clinics');
        if (clinicColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Clinics table not found.' } };
            return;
        }

        const hasIsActive = hasColumn(clinicColumns, 'IsActive');
        const hasZipCode = hasColumn(clinicColumns, 'ZipCode');
        const hasColor = hasColumn(clinicColumns, 'Color');
        const hasIcon = hasColumn(clinicColumns, 'Icon');
        const hasDescription = hasColumn(clinicColumns, 'Description');
        const hasMainPhone = hasColumn(clinicColumns, 'MainPhone');
        const hasAfterHoursPhone = hasColumn(clinicColumns, 'AfterHoursPhone');
        const hasFax = hasColumn(clinicColumns, 'Fax');
        const hasWebsite = hasColumn(clinicColumns, 'Website');
        const hasDefaultDentist = hasColumn(clinicColumns, 'DefaultDentist');
        const hasTaxonomyNumber = hasColumn(clinicColumns, 'TaxonomyNumber');
        const hasClinicNPI = hasColumn(clinicColumns, 'ClinicNPI');
        const hasClinicTIN = hasColumn(clinicColumns, 'ClinicTIN');
        const hasLegalName = hasColumn(clinicColumns, 'LegalName');
        const hasLegalAddress = hasColumn(clinicColumns, 'LegalAddress');
        const hasStatus = hasColumn(clinicColumns, 'Status');
        const hasOperatingHours = hasColumn(clinicColumns, 'OperatingHours');
        const hasLogo = hasColumn(clinicColumns, 'Logo');
        const hasLogoData = hasColumn(clinicColumns, 'LogoData');
        const hasModifiedDate = hasColumn(clinicColumns, 'ModifiedDate');
        const orderBy = hasColumn(clinicColumns, 'Name') ? 'ORDER BY Name' : 'ORDER BY Id';

        const workingHoursColumns = await getTableColumns(pool, 'ClinicWorkingHours');
        const hasWorkingHoursTable =
            workingHoursColumns.size > 0
            && hasColumn(workingHoursColumns, 'ClinicId')
            && hasColumn(workingHoursColumns, 'DayKey')
            && hasColumn(workingHoursColumns, 'IsOpen');

        const id = req.params.id;
        const tenantUserId = getRequestUserId(req);

        if (req.method === 'GET') {
            // Tenant scope: caller must be a member of the clinic (UserClinics)
            // OR own a Subscription that includes it (SubscriptionClinics).
            if (!tenantUserId) {
                context.res = { status: 200, headers, body: id ? null : [] };
                return;
            }
            if (id) {
                const where = ['Id = @id', tenantClinicScopeSql('Id')];
                if (hasIsActive) {
                    where.push('(IsActive = 1 OR IsActive IS NULL)');
                }
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT * FROM Clinics WHERE ${where.join(' AND ')}`);
                const clinic = result.recordset[0] || null;
                if (clinic) {
                    let normalizedHours = null;
                    if (hasWorkingHoursTable) {
                        const map = await getClinicWorkingHoursMap(pool, Number.parseInt(id, 10));
                        normalizedHours = map.get(String(clinic.Id)) || null;
                    }
                    if (!normalizedHours && hasOperatingHours) {
                        normalizedHours = parseOperatingHoursFromClinicRow(clinic);
                    }
                    if (normalizedHours) {
                        clinic.OperatingHours = normalizedHours;
                        clinic.operatingHours = normalizedHours;
                    }
                }
                context.res = { status: 200, headers, body: clinic };
            } else {
                const whereParts = [tenantClinicScopeSql('Id')];
                if (hasIsActive) whereParts.push('(IsActive = 1 OR IsActive IS NULL)');
                const whereClause = `WHERE ${whereParts.join(' AND ')}`;
                const result = await pool.request()
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT * FROM Clinics ${whereClause} ${orderBy}`);

                const clinics = result.recordset || [];
                let workingHoursMap = new Map();
                if (hasWorkingHoursTable) {
                    workingHoursMap = await getClinicWorkingHoursMap(pool);
                }

                const mapped = clinics.map((clinic) => {
                    let normalizedHours = null;

                    if (hasWorkingHoursTable) {
                        normalizedHours = workingHoursMap.get(String(clinic.Id)) || null;
                    }

                    if (!normalizedHours && hasOperatingHours) {
                        normalizedHours = parseOperatingHoursFromClinicRow(clinic);
                    }

                    if (!normalizedHours) return clinic;

                    return {
                        ...clinic,
                        OperatingHours: normalizedHours,
                        operatingHours: normalizedHours
                    };
                });

                context.res = { status: 200, headers, body: mapped };
            }
        } else if (req.method === 'POST') {
            const body = req.body || {};
            if (!body.name) {
                context.res = { status: 400, headers, body: { error: 'Clinic name is required.' } };
                return;
            }

            const normalizedOperatingHours = normalizeOperatingHoursPayload(body.operatingHours ?? body.OperatingHours);
            const mainPhone = body.mainPhone || body.MainPhone || body.phone || body.Phone || null;
            const afterHoursPhone = body.afterHoursPhone || body.AfterHoursPhone || null;
            const fax = body.fax || body.Fax || null;

            const request = pool.request();
            request.input('name', sql.NVarChar, body.name);
            request.input('address', sql.NVarChar, body.address || null);
            request.input('city', sql.NVarChar, body.city || null);
            request.input('state', sql.NVarChar, body.state || null);
            request.input('phone', sql.NVarChar, body.phone || body.Phone || mainPhone || null);
            request.input('email', sql.NVarChar, body.email || null);
            if (hasZipCode) request.input('zipCode', sql.NVarChar, body.zipCode || null);
            if (hasColor) request.input('color', sql.NVarChar, body.color || null);
            if (hasIcon) request.input('icon', sql.NVarChar, body.icon || null);
            if (hasDescription) request.input('description', sql.NVarChar, body.description || null);
            if (hasMainPhone) request.input('mainPhone', sql.NVarChar, mainPhone);
            if (hasAfterHoursPhone) request.input('afterHoursPhone', sql.NVarChar, afterHoursPhone);
            if (hasFax) request.input('fax', sql.NVarChar, fax);
            if (hasWebsite) request.input('website', sql.NVarChar, body.website || null);
            if (hasDefaultDentist) request.input('defaultDentist', sql.NVarChar, body.defaultDentist || null);
            if (hasTaxonomyNumber) request.input('taxonomyNumber', sql.NVarChar, body.taxonomyNumber || null);
            if (hasClinicNPI) request.input('clinicNPI', sql.NVarChar, body.clinicNPI || null);
            if (hasClinicTIN) request.input('clinicTIN', sql.NVarChar, body.clinicTIN || null);
            if (hasLegalName) request.input('legalName', sql.NVarChar, body.legalName || null);
            if (hasLegalAddress) request.input('legalAddress', sql.NVarChar, body.legalAddress || null);
            if (hasStatus) request.input('status', sql.NVarChar, body.status || null);
            if (hasOperatingHours) request.input('operatingHours', sql.NVarChar(sql.MAX), normalizedOperatingHours ? JSON.stringify(normalizedOperatingHours) : null);
            if (hasLogo) request.input('logo', sql.NVarChar(sql.MAX), body.logo ? JSON.stringify(body.logo) : null);
            if (hasLogoData) request.input('logoData', sql.NVarChar(sql.MAX), body.logo ? JSON.stringify(body.logo) : null);

            const columns = ['Name', 'Address', 'City', 'State', 'Phone', 'Email'];
            const values = ['@name', '@address', '@city', '@state', '@phone', '@email'];
            if (hasZipCode) { columns.push('ZipCode'); values.push('@zipCode'); }
            if (hasColor) { columns.push('Color'); values.push('@color'); }
            if (hasIcon) { columns.push('Icon'); values.push('@icon'); }
            if (hasDescription) { columns.push('Description'); values.push('@description'); }
            if (hasMainPhone) { columns.push('MainPhone'); values.push('@mainPhone'); }
            if (hasAfterHoursPhone) { columns.push('AfterHoursPhone'); values.push('@afterHoursPhone'); }
            if (hasFax) { columns.push('Fax'); values.push('@fax'); }
            if (hasWebsite) { columns.push('Website'); values.push('@website'); }
            if (hasDefaultDentist) { columns.push('DefaultDentist'); values.push('@defaultDentist'); }
            if (hasTaxonomyNumber) { columns.push('TaxonomyNumber'); values.push('@taxonomyNumber'); }
            if (hasClinicNPI) { columns.push('ClinicNPI'); values.push('@clinicNPI'); }
            if (hasClinicTIN) { columns.push('ClinicTIN'); values.push('@clinicTIN'); }
            if (hasLegalName) { columns.push('LegalName'); values.push('@legalName'); }
            if (hasLegalAddress) { columns.push('LegalAddress'); values.push('@legalAddress'); }
            if (hasStatus) { columns.push('Status'); values.push('@status'); }
            if (hasOperatingHours) { columns.push('OperatingHours'); values.push('@operatingHours'); }
            if (hasLogo) { columns.push('Logo'); values.push('@logo'); }
            if (hasLogoData) { columns.push('LogoData'); values.push('@logoData'); }
            if (hasIsActive) { columns.push('IsActive'); values.push('1'); }

            const result = await request.query(`INSERT INTO Clinics (${columns.join(', ')}) 
                        OUTPUT INSERTED.Id VALUES (${values.join(', ')})`);

            const clinicId = result?.recordset?.[0]?.Id;
            if (hasWorkingHoursTable && clinicId && normalizedOperatingHours) {
                await saveClinicWorkingHours(pool, clinicId, normalizedOperatingHours);
            }

            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const clinicId = Number.parseInt(id, 10);
            if (!Number.isFinite(clinicId)) {
                context.res = { status: 400, headers, body: { error: 'Invalid clinic id.' } };
                return;
            }

            const body = req.body || {};
            if (!body.name) {
                context.res = { status: 400, headers, body: { error: 'Clinic name is required.' } };
                return;
            }

            const normalizedOperatingHours = normalizeOperatingHoursPayload(body.operatingHours ?? body.OperatingHours);
            const mainPhone = body.mainPhone || body.MainPhone || body.phone || body.Phone || null;
            const afterHoursPhone = body.afterHoursPhone || body.AfterHoursPhone || null;
            const fax = body.fax || body.Fax || null;

            const request = pool.request();
            request.input('id', sql.Int, clinicId);
            request.input('name', sql.NVarChar, body.name);
            request.input('address', sql.NVarChar, body.address || null);
            request.input('city', sql.NVarChar, body.city || null);
            request.input('state', sql.NVarChar, body.state || null);
            request.input('phone', sql.NVarChar, body.phone || body.Phone || mainPhone || null);
            request.input('email', sql.NVarChar, body.email || null);
            if (hasZipCode) request.input('zipCode', sql.NVarChar, body.zipCode || null);
            if (hasColor) request.input('color', sql.NVarChar, body.color || null);
            if (hasIcon) request.input('icon', sql.NVarChar, body.icon || null);
            if (hasDescription) request.input('description', sql.NVarChar, body.description || null);
            if (hasMainPhone) request.input('mainPhone', sql.NVarChar, mainPhone);
            if (hasAfterHoursPhone) request.input('afterHoursPhone', sql.NVarChar, afterHoursPhone);
            if (hasFax) request.input('fax', sql.NVarChar, fax);
            if (hasWebsite) request.input('website', sql.NVarChar, body.website || null);
            if (hasDefaultDentist) request.input('defaultDentist', sql.NVarChar, body.defaultDentist || null);
            if (hasTaxonomyNumber) request.input('taxonomyNumber', sql.NVarChar, body.taxonomyNumber || null);
            if (hasClinicNPI) request.input('clinicNPI', sql.NVarChar, body.clinicNPI || null);
            if (hasClinicTIN) request.input('clinicTIN', sql.NVarChar, body.clinicTIN || null);
            if (hasLegalName) request.input('legalName', sql.NVarChar, body.legalName || null);
            if (hasLegalAddress) request.input('legalAddress', sql.NVarChar, body.legalAddress || null);
            if (hasStatus) request.input('status', sql.NVarChar, body.status || null);
            if (hasOperatingHours) request.input('operatingHours', sql.NVarChar(sql.MAX), normalizedOperatingHours ? JSON.stringify(normalizedOperatingHours) : null);
            if (hasLogo) request.input('logo', sql.NVarChar(sql.MAX), body.logo ? JSON.stringify(body.logo) : null);
            if (hasLogoData) request.input('logoData', sql.NVarChar(sql.MAX), body.logo ? JSON.stringify(body.logo) : null);

            const setClauses = [
                'Name=@name',
                'Address=@address',
                'City=@city',
                'State=@state',
                'Phone=@phone',
                'Email=@email'
            ];
            if (hasZipCode) setClauses.push('ZipCode=@zipCode');
            if (hasColor) setClauses.push('Color=@color');
            if (hasIcon) setClauses.push('Icon=@icon');
            if (hasDescription) setClauses.push('Description=@description');
            if (hasMainPhone) setClauses.push('MainPhone=@mainPhone');
            if (hasAfterHoursPhone) setClauses.push('AfterHoursPhone=@afterHoursPhone');
            if (hasFax) setClauses.push('Fax=@fax');
            if (hasWebsite) setClauses.push('Website=@website');
            if (hasDefaultDentist) setClauses.push('DefaultDentist=@defaultDentist');
            if (hasTaxonomyNumber) setClauses.push('TaxonomyNumber=@taxonomyNumber');
            if (hasClinicNPI) setClauses.push('ClinicNPI=@clinicNPI');
            if (hasClinicTIN) setClauses.push('ClinicTIN=@clinicTIN');
            if (hasLegalName) setClauses.push('LegalName=@legalName');
            if (hasLegalAddress) setClauses.push('LegalAddress=@legalAddress');
            if (hasStatus) setClauses.push('Status=@status');
            if (hasOperatingHours) setClauses.push('OperatingHours=@operatingHours');
            if (hasLogo) setClauses.push('Logo=@logo');
            if (hasLogoData) setClauses.push('LogoData=@logoData');
            if (hasIsActive && body.isActive !== undefined) {
                request.input('isActive', sql.Bit, body.isActive ? 1 : 0);
                setClauses.push('IsActive=@isActive');
            }
            if (hasModifiedDate) setClauses.push('ModifiedDate=GETUTCDATE()');

            await request.query(`UPDATE Clinics
                        SET ${setClauses.join(', ')}
                        WHERE Id=@id`);

            if (hasWorkingHoursTable && normalizedOperatingHours) {
                await saveClinicWorkingHours(pool, clinicId, normalizedOperatingHours);
            }

            context.res = { status: 200, headers, body: { message: 'Clinic updated successfully' } };
        } else if (req.method === 'DELETE' && id) {
            const clinicId = Number.parseInt(id, 10);
            if (!Number.isFinite(clinicId)) {
                context.res = { status: 400, headers, body: { error: 'Invalid clinic id.' } };
                return;
            }

            let result;
            if (hasIsActive) {
                const softDeleteSet = hasModifiedDate ? 'IsActive = 0, ModifiedDate = GETUTCDATE()' : 'IsActive = 0';
                result = await pool.request()
                    .input('id', sql.Int, clinicId)
                    .query(`UPDATE Clinics SET ${softDeleteSet} WHERE Id = @id`);
            } else {
                result = await pool.request()
                    .input('id', sql.Int, clinicId)
                    .query('DELETE FROM Clinics WHERE Id = @id');
            }

            const rowsAffected = Array.isArray(result?.rowsAffected)
                ? result.rowsAffected.reduce((sum, n) => sum + Number(n || 0), 0)
                : 0;

            if (rowsAffected === 0) {
                context.res = { status: 404, headers, body: { error: 'Clinic not found or already deleted.' } };
                return;
            }

            context.res = { status: 200, headers, body: { message: 'Clinic deleted successfully' } };
        } else {
            context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
        }

    } catch (err) {
        if (isConnectionError(err)) {
            await resetPool();
        }
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
