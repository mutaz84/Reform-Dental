const { sql, getPool } = require('../shared/database');
const { getRequestUserId, isPlatformAdmin, resolveVisibleClinicId } = require('../shared/tenant');
const permissions = require('../shared/permissions');

const CALENDAR_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const CALENDAR_PIN_VALUE = /^[a-zA-Z0-9_-]{1,80}:[a-zA-Z0-9_-]{1,80}$/;
const MAX_CALENDAR_PINS = 5000;

function parsePinMap(value) {
    const parsed = parseSettingValue(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

// Applies placement changes inside a transaction so two people dragging at the same moment
// don't overwrite each other's change.
async function applyCalendarPins(pool, pinsKey, changes) {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const current = await new sql.Request(tx)
            .input('key', sql.NVarChar, pinsKey)
            .query('SELECT TOP 1 SettingValue FROM Settings WITH (UPDLOCK, HOLDLOCK) WHERE SettingKey = @key');
        const pins = parsePinMap(current.recordset?.[0]?.SettingValue);
        changes.forEach((change) => {
            delete pins[change.key];
            if (change.value) pins[change.key] = change.value;
        });
        const keys = Object.keys(pins);
        if (keys.length > MAX_CALENDAR_PINS) keys.slice(0, keys.length - MAX_CALENDAR_PINS).forEach((key) => { delete pins[key]; });
        await new sql.Request(tx)
            .input('key', sql.NVarChar, pinsKey)
            .input('value', sql.NVarChar(sql.MAX), JSON.stringify(pins))
            .query(`
                IF EXISTS (SELECT 1 FROM Settings WHERE SettingKey = @key)
                    UPDATE Settings SET SettingValue = @value, ModifiedDate = GETUTCDATE() WHERE SettingKey = @key
                ELSE
                    INSERT INTO Settings (SettingKey, SettingValue) VALUES (@key, @value)
            `);
        await tx.commit();
        return pins;
    } catch (err) {
        try { await tx.rollback(); } catch (_) { /* already rolled back */ }
        throw err;
    }
}

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
        const wantsCalendar = req.query?.calendarClinicId !== undefined || calendarBody.calendarLayouts !== undefined || calendarBody.calendarPin !== undefined;
        const subscriptionId = isPlatformOwner || wantsCalendar ? null : await getSubscriptionIdForUser(pool, requestUserId);
        let calendarKey = null;
        let calendarPinsKey = null;
        if (wantsCalendar) {
            const requestedClinicId = Number(req.query?.calendarClinicId || calendarBody.calendarClinicId || 0);
            const clinicId = requestedClinicId > 0 ? await resolveVisibleClinicId(pool, requestedClinicId, requestUserId) : null;
            if (!clinicId || clinicId !== requestedClinicId) {
                context.res = { status: 403, headers, body: { error: 'Select a clinic you can access.' } };
                return;
            }
            calendarKey = `calendarLayouts:clinic:${clinicId}`;
            calendarPinsKey = `calendarPins:clinic:${clinicId}`;
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
                if (key === 'calendarLayouts' || key.startsWith('calendarLayouts:') || key.startsWith('calendarPins:')) return;
                if (key.includes(':subscription:')) return;
                if (OFFICE_PLAN_KEYS.has(key) && !isPlatformOwner) return;
                settings[key] = parseSettingValue(row.SettingValue);
            });

            if (calendarKey) {
                const row = result.recordset.find(item => item.SettingKey === calendarKey);
                settings.calendarLayouts = row ? parseSettingValue(row.SettingValue) : [];
                const pinsRow = result.recordset.find(item => item.SettingKey === calendarPinsKey);
                settings.calendarPins = pinsRow ? parsePinMap(pinsRow.SettingValue) : {};
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
            if (Object.keys(body).some(key => key.startsWith('calendarLayouts:') || key.startsWith('calendarPins:'))) {
                context.res = { status: 400, headers, body: { error: 'Use calendarLayouts with calendarClinicId.' } };
                return;
            }
            if (body.calendarLayouts !== undefined) {
                if (!isPlatformOwner && !(await permissions.can(pool, req, 'calendar', 'manage_layouts'))) {
                    context.res = { status: 403, headers, body: { error: "You don't have permission to change calendar layouts. Ask an admin to turn on Office Calendar > Edit Calendar Layouts.", code: 'PERMISSION_DENIED' } };
                    return;
                }
                const layouts = body.calendarLayouts;
                const validId = value => typeof value === 'string' && CALENDAR_ID.test(value);
                const validUnassigned = layout =>
                    (layout.unassignedName === undefined || (typeof layout.unassignedName === 'string' && layout.unassignedName.length <= 80)) &&
                    (layout.hideUnassignedWhenEmpty === undefined || typeof layout.hideUnassignedWhenEmpty === 'boolean');
                const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
                const validEntity = column =>
                    (column.entityType === undefined || (typeof column.entityType === 'string' && column.entityType.length <= 40)) &&
                    (column.entityId === undefined || (typeof column.entityId === 'string' && column.entityId.length <= 160)) &&
                    (column.entityName === undefined || (typeof column.entityName === 'string' && column.entityName.length <= 160));
                const valid = Array.isArray(layouts) && layouts.length <= 20 &&
                    new Set(layouts.map(layout => layout?.id)).size === layouts.length && layouts.every(layout =>
                        layout && validId(layout.id) && validName(layout.name) && validUnassigned(layout) && Array.isArray(layout.columns) && layout.columns.length <= 30 &&
                        new Set(layout.columns.map(column => column?.id)).size === layout.columns.length && layout.columns.every(column =>
                            column && validId(column.id) && validName(column.name) && /^#[0-9a-f]{6}$/i.test(column.color || '') && typeof column.active === 'boolean' && validEntity(column)));
                if (!valid) {
                    context.res = { status: 400, headers, body: { error: 'Invalid calendar layouts or columns.' } };
                    return;
                }
                await upsertSetting(pool, calendarKey, JSON.stringify(layouts), true);
            }
            if (body.calendarPin !== undefined) {
                if (!isPlatformOwner && !(await permissions.can(pool, req, 'calendar', 'move_events'))) {
                    context.res = { status: 403, headers, body: { error: "You don't have permission to arrange the office calendar. Ask an admin to turn on Office Calendar > Move Anyone's Events.", code: 'PERMISSION_DENIED' } };
                    return;
                }
                const changes = (Array.isArray(body.calendarPin) ? body.calendarPin : [body.calendarPin]).map((change) => ({
                    key: change && change.key,
                    value: change && (change.value === null || change.value === undefined) ? '' : change && change.value
                }));
                const valid = changes.length > 0 && changes.length <= 200 && changes.every((change) =>
                    typeof change.key === 'string' && change.key.length > 0 && change.key.length <= 200 &&
                    typeof change.value === 'string' && (change.value === '' || CALENDAR_PIN_VALUE.test(change.value)));
                if (!valid) {
                    context.res = { status: 400, headers, body: { error: 'Invalid calendar placement.' } };
                    return;
                }
                const pins = await applyCalendarPins(pool, calendarPinsKey, changes);
                context.res = { status: 200, headers, body: { message: 'Calendar placement saved', calendarPins: pins } };
                return;
            }
            const knownKeys = new Set([
                'calendarLayouts',
                'calendarClinicId',
                'calendarPin',
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
