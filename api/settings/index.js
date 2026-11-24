const { sql, getPool } = require('../shared/database');
const { getRequestUserId, isPlatformAdmin, resolveVisibleClinicId } = require('../shared/tenant');

const PLATFORM_BRANDING_KEYS = new Set(['companyName', 'tagline', 'logoData']);
const OFFICE_PLAN_KEYS = new Set([
    'officePlanTitle',
    'officePlanDescription',
    'officePlanImageUrl',
    'officePlanUploadDate'
]);

function getScopedOfficePlanKey(key, subscriptionId) {
    return `${key}:subscription:${subscriptionId}`;
}

async function getSubscriptionIdForUser(pool, userId) {
    const id = Number(userId || 0);
    if (!Number.isInteger(id) || id <= 0) return null;
    const result = await pool.request()
        .input('userId', sql.Int, id)
        .query('SELECT TOP 1 SubscriptionId FROM Users WHERE Id = @userId');
    const subscriptionId = Number(result.recordset?.[0]?.SubscriptionId || 0);
    return Number.isInteger(subscriptionId) && subscriptionId > 0 ? subscriptionId : null;
}

async function upsertSetting(pool, key, value, useMax = false) {
    const inputType = useMax ? sql.NVarChar(sql.MAX) : sql.NVarChar(4000);
    await pool.request()
        .input('key', sql.NVarChar, key)
        .input('value', inputType, value)
        .query(`
            IF EXISTS (SELECT 1 FROM Settings WHERE SettingKey = @key)
                UPDATE Settings SET SettingValue = @value, ModifiedDate = GETUTCDATE() WHERE SettingKey = @key
            ELSE
                INSERT INTO Settings (SettingKey, SettingValue) VALUES (@key, @value)
        `);
}

function parseRequestBody(body) {
    if (body == null) return {};
    if (typeof body === 'string') {
        try {
            const parsed = JSON.parse(body);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }
    return typeof body === 'object' ? body : {};
}

function parseSettingValue(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        return value;
    }
    try {
        return JSON.parse(trimmed);
    } catch (_) {
        return value;
    }
}

function serializeSettingValue(value) {
    if (value === undefined) return null;
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
    try {
        return JSON.stringify(value);
    } catch (_) {
        return null;
    }
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Username, X-User-Name, X-User-Email'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    let pool;
    try {
        pool = await getPool();

        const requestUserId = getRequestUserId(req);
        const isPlatformOwner = await isPlatformAdmin(pool, requestUserId);
        const calendarBody = parseRequestBody(req.body);
        const wantsCalendar = req.query?.calendarClinicId !== undefined || calendarBody.calendarLayouts !== undefined;
        const subscriptionId = isPlatformOwner || wantsCalendar ? null : await getSubscriptionIdForUser(pool, requestUserId);
        let calendarKey = null;
        if (wantsCalendar) {
            const requestedClinicId = Number(req.query?.calendarClinicId || calendarBody.calendarClinicId || 0);
            const clinicId = requestedClinicId > 0 ? await resolveVisibleClinicId(pool, requestedClinicId, requestUserId) : null;
            if (!clinicId || clinicId !== requestedClinicId) {
                context.res = { status: 403, headers, body: { error: 'Select a clinic you can access.' } };
                return;
            }
            calendarKey = `calendarLayouts:clinic:${clinicId}`;
        }

        if (req.method === 'GET') {
            // Get all settings
            const result = await pool.request()
                .query('SELECT SettingKey, SettingValue FROM Settings');
            
            // Convert to object format
            const settings = {};
            result.recordset.forEach(row => {
                const key = String(row.SettingKey || '');
                if (!key) return;
                if (key === 'calendarLayouts' || key.startsWith('calendarLayouts:')) return;
                if (key.includes(':subscription:')) return;
                if (OFFICE_PLAN_KEYS.has(key) && !isPlatformOwner) return;
                settings[key] = parseSettingValue(row.SettingValue);
            });

            if (calendarKey) {
                const row = result.recordset.find(item => item.SettingKey === calendarKey);
                settings.calendarLayouts = row ? parseSettingValue(row.SettingValue) : [];
            }

            if (subscriptionId) {
                result.recordset.forEach(row => {
                    const key = String(row.SettingKey || '');
                    for (const baseKey of OFFICE_PLAN_KEYS) {
                        if (key === getScopedOfficePlanKey(baseKey, subscriptionId)) {
                            settings[baseKey] = parseSettingValue(row.SettingValue);
                        }
                    }
                });
            }
            
            context.res = { status: 200, headers, body: settings };
            
        } else if (req.method === 'POST' || req.method === 'PUT') {
            // Save settings
            const body = parseRequestBody(req.body);
            if (Object.keys(body).some(key => key.startsWith('calendarLayouts:'))) {
                context.res = { status: 400, headers, body: { error: 'Use calendarLayouts with calendarClinicId.' } };
                return;
            }
            if (body.calendarLayouts !== undefined) {
                const actor = await pool.request().input('calendarActorId', sql.Int, requestUserId)
                    .query('SELECT TOP 1 Role FROM Users WHERE Id = @calendarActorId');
                const role = String(actor.recordset?.[0]?.Role || '').trim().toLowerCase();
                if (!isPlatformOwner && !['admin', 'owner', 'manager-admin', 'manageradmin'].includes(role)) {
                    context.res = { status: 403, headers, body: { error: 'Only administrators can change calendar layouts.' } };
                    return;
                }
                const layouts = body.calendarLayouts;
                const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
                const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
                const validEntity = column =>
                    (column.entityType === undefined || (typeof column.entityType === 'string' && column.entityType.length <= 40)) &&
                    (column.entityId === undefined || (typeof column.entityId === 'string' && column.entityId.length <= 160)) &&
                    (column.entityName === undefined || (typeof column.entityName === 'string' && column.entityName.length <= 160));
                const valid = Array.isArray(layouts) && layouts.length <= 20 &&
                    new Set(layouts.map(layout => layout?.id)).size === layouts.length && layouts.every(layout =>
                        layout && validId(layout.id) && validName(layout.name) && Array.isArray(layout.columns) && layout.columns.length <= 30 &&
                        new Set(layout.columns.map(column => column?.id)).size === layout.columns.length && layout.columns.every(column =>
                            column && validId(column.id) && validName(column.name) && /^#[0-9a-f]{6}$/i.test(column.color || '') && typeof column.active === 'boolean' && validEntity(column)));
                if (!valid) {
                    context.res = { status: 400, headers, body: { error: 'Invalid calendar layouts or columns.' } };
                    return;
                }
                await upsertSetting(pool, calendarKey, JSON.stringify(layouts), true);
            }
            const knownKeys = new Set([
                'calendarLayouts',
                'calendarClinicId',
                'companyName',
                'tagline',
                'logoData',
                'officePlanTitle',
                'officePlanDescription',
                'officePlanImageUrl',
                'officePlanUploadDate'
            ]);
            
            if ([...PLATFORM_BRANDING_KEYS].some(key => body[key] !== undefined) && !isPlatformOwner) {
                context.res = { status: 403, headers, body: { error: 'Only the platform owner can manage app branding.' } };
                return;
            }

            if ([...OFFICE_PLAN_KEYS].some(key => body[key] !== undefined) && !isPlatformOwner && !subscriptionId) {
                context.res = { status: 403, headers, body: { error: 'A subscription is required to manage an office plan.' } };
                return;
            }

            // Upsert each setting
            if (body.companyName !== undefined) {
                await upsertSetting(pool, 'companyName', body.companyName);
            }
            
            if (body.tagline !== undefined) {
                await upsertSetting(pool, 'tagline', body.tagline);
            }
            
            if (body.logoData !== undefined) {
                await upsertSetting(pool, 'logoData', body.logoData, true);
            }

            // Office Plan settings (used by Office Plan viewer/management UI)
            const officePlanKey = (key) => subscriptionId ? getScopedOfficePlanKey(key, subscriptionId) : key;
            if (body.officePlanTitle !== undefined) {
                await upsertSetting(pool, officePlanKey('officePlanTitle'), body.officePlanTitle);
            }
            if (body.officePlanDescription !== undefined) {
                await upsertSetting(pool, officePlanKey('officePlanDescription'), body.officePlanDescription, true);
            }
            if (body.officePlanImageUrl !== undefined) {
                // Can be a URL or a data URL (base64) if user uploaded a file
                await upsertSetting(pool, officePlanKey('officePlanImageUrl'), body.officePlanImageUrl, true);
            }
            if (body.officePlanUploadDate !== undefined) {
                await upsertSetting(pool, officePlanKey('officePlanUploadDate'), body.officePlanUploadDate);
            }

            // Persist all additional settings keys to avoid silent drops for new features.
            for (const [key, value] of Object.entries(body)) {
                if (knownKeys.has(key)) continue;
                const serialized = serializeSettingValue(value);
                if (serialized === null) continue;
                await upsertSetting(pool, key, serialized, serialized.length > 3500);
            }
            
            context.res = { status: 200, headers, body: { message: 'Settings saved successfully' } };
        }

    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};

module.exports = require('../shared/auth').withAuth(module.exports);
