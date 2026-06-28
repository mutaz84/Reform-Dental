const sql = require('mssql');
const { getRequestUserId, isPlatformAdmin } = require('../shared/tenant');

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
    return {};
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    let pool;
    try {
        pool = await sql.connect(getConfig());

        const requestUserId = getRequestUserId(req);
        const isPlatformOwner = await isPlatformAdmin(pool, requestUserId);
        const subscriptionId = isPlatformOwner ? null : await getSubscriptionIdForUser(pool, requestUserId);

        if (req.method === 'GET') {
            // Get all settings
            const result = await pool.request()
                .query('SELECT SettingKey, SettingValue FROM Settings');
            
            // Convert to object format
            const settings = {};
            result.recordset.forEach(row => {
                const key = String(row.SettingKey || '');
                if (!key) return;
                if (key.includes(':subscription:')) return;
                if (OFFICE_PLAN_KEYS.has(key) && !isPlatformOwner) return;
                settings[key] = parseSettingValue(row.SettingValue);
            });

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
            const knownKeys = new Set([
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
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (_) {}
        }
    }
};
