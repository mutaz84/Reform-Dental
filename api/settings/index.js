const sql = require('mssql');

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

        if (req.method === 'GET') {
            // Get all settings
            const result = await pool.request()
                .query('SELECT SettingKey, SettingValue FROM Settings');
            
            // Convert to object format
            const settings = {};
            result.recordset.forEach(row => {
                settings[row.SettingKey] = parseSettingValue(row.SettingValue);
            });
            
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
            if (body.officePlanTitle !== undefined) {
                await upsertSetting(pool, 'officePlanTitle', body.officePlanTitle);
            }
            if (body.officePlanDescription !== undefined) {
                await upsertSetting(pool, 'officePlanDescription', body.officePlanDescription, true);
            }
            if (body.officePlanImageUrl !== undefined) {
                // Can be a URL or a data URL (base64) if user uploaded a file
                await upsertSetting(pool, 'officePlanImageUrl', body.officePlanImageUrl, true);
            }
            if (body.officePlanUploadDate !== undefined) {
                await upsertSetting(pool, 'officePlanUploadDate', body.officePlanUploadDate);
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
