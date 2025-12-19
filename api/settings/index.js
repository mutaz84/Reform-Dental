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
    return {};
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await sql.connect(getConfig());

        if (req.method === 'GET') {
            // Get all settings
            const result = await pool.request()
                .query('SELECT SettingKey, SettingValue FROM Settings');
            
            // Convert to object format
            const settings = {};
            result.recordset.forEach(row => {
                settings[row.SettingKey] = row.SettingValue;
            });
            
            context.res = { status: 200, headers, body: settings };
            
        } else if (req.method === 'POST' || req.method === 'PUT') {
            // Save settings
            const body = req.body;
            
            // Upsert each setting
            if (body.companyName !== undefined) {
                await pool.request()
                    .input('key', sql.NVarChar, 'companyName')
                    .input('value', sql.NVarChar, body.companyName)
                    .query(`
                        IF EXISTS (SELECT 1 FROM Settings WHERE SettingKey = @key)
                            UPDATE Settings SET SettingValue = @value, ModifiedDate = GETUTCDATE() WHERE SettingKey = @key
                        ELSE
                            INSERT INTO Settings (SettingKey, SettingValue) VALUES (@key, @value)
                    `);
            }
            
            if (body.tagline !== undefined) {
                await pool.request()
                    .input('key', sql.NVarChar, 'tagline')
                    .input('value', sql.NVarChar, body.tagline)
                    .query(`
                        IF EXISTS (SELECT 1 FROM Settings WHERE SettingKey = @key)
                            UPDATE Settings SET SettingValue = @value, ModifiedDate = GETUTCDATE() WHERE SettingKey = @key
                        ELSE
                            INSERT INTO Settings (SettingKey, SettingValue) VALUES (@key, @value)
                    `);
            }
            
            if (body.logoData !== undefined) {
                await pool.request()
                    .input('key', sql.NVarChar, 'logoData')
                    .input('value', sql.NVarChar(sql.MAX), body.logoData)
                    .query(`
                        IF EXISTS (SELECT 1 FROM Settings WHERE SettingKey = @key)
                            UPDATE Settings SET SettingValue = @value, ModifiedDate = GETUTCDATE() WHERE SettingKey = @key
                        ELSE
                            INSERT INTO Settings (SettingKey, SettingValue) VALUES (@key, @value)
                    `);
            }
            
            context.res = { status: 200, headers, body: { message: 'Settings saved successfully' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
