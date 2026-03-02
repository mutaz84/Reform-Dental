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
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
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
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await sql.connect(getConfig());
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

        if (req.method === 'GET') {
            if (id) {
                const where = ['Id = @id'];
                if (hasIsActive) {
                    where.push('(IsActive = 1 OR IsActive IS NULL)');
                }
                const result = await pool.request()
                    .input('id', sql.Int, id)
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
                const whereClause = hasIsActive ? 'WHERE (IsActive = 1 OR IsActive IS NULL)' : '';
                const result = await pool.request()
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

            const request = pool.request();
            request.input('name', sql.NVarChar, body.name);
            request.input('address', sql.NVarChar, body.address || null);
            request.input('city', sql.NVarChar, body.city || null);
            request.input('state', sql.NVarChar, body.state || null);
            request.input('phone', sql.NVarChar, body.phone || null);
            request.input('email', sql.NVarChar, body.email || null);
            if (hasZipCode) request.input('zipCode', sql.NVarChar, body.zipCode || null);
            if (hasColor) request.input('color', sql.NVarChar, body.color || null);
            if (hasIcon) request.input('icon', sql.NVarChar, body.icon || null);
            if (hasDescription) request.input('description', sql.NVarChar, body.description || null);
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

            const request = pool.request();
            request.input('id', sql.Int, clinicId);
            request.input('name', sql.NVarChar, body.name);
            request.input('address', sql.NVarChar, body.address || null);
            request.input('city', sql.NVarChar, body.city || null);
            request.input('state', sql.NVarChar, body.state || null);
            request.input('phone', sql.NVarChar, body.phone || null);
            request.input('email', sql.NVarChar, body.email || null);
            if (hasZipCode) request.input('zipCode', sql.NVarChar, body.zipCode || null);
            if (hasColor) request.input('color', sql.NVarChar, body.color || null);
            if (hasIcon) request.input('icon', sql.NVarChar, body.icon || null);
            if (hasDescription) request.input('description', sql.NVarChar, body.description || null);
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

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
