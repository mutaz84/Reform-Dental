const fs = require('fs');
const path = require('path');
const sql = require('mssql');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=(?:tcp:)?([^,;]+)/i);
        const portMatch = connStr.match(/Server=(?:tcp:)?[^,;]+,(\d+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);
        const encryptMatch = connStr.match(/Encrypt=([^;]+)/i);
        const trustMatch = connStr.match(/TrustServerCertificate=([^;]+)/i);

        const parseBool = (value, fallback) => {
            if (value == null) return fallback;
            return /^(true|yes|1)$/i.test(String(value).trim());
        };

        return {
            server: serverMatch ? serverMatch[1] : '',
            port: portMatch ? Number(portMatch[1]) : undefined,
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: {
                encrypt: parseBool(encryptMatch?.[1], true),
                trustServerCertificate: parseBool(trustMatch?.[1], false),
                enableArithAbort: true
            },
            pool: {
                max: 4,
                min: 0,
                idleTimeoutMillis: 30000
            },
            requestTimeout: 120000,
            connectionTimeout: 30000
        };
    }

    return {
        server: process.env.SQL_SERVER || '',
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        database: process.env.SQL_DATABASE || '',
        user: process.env.SQL_USER || '',
        password: process.env.SQL_PASSWORD || '',
        options: {
            encrypt: true,
            trustServerCertificate: false,
            enableArithAbort: true
        },
        pool: {
            max: 4,
            min: 0,
            idleTimeoutMillis: 30000
        },
        requestTimeout: 120000,
        connectionTimeout: 30000
    };
}

function splitBatches(sqlText) {
    return String(sqlText)
        .split(/^\s*GO\s*$/gim)
        .map((batch) => batch.trim())
        .filter(Boolean);
}

async function run() {
    const scriptPath = path.resolve(__dirname, '../../database/attendance-pto-rebuild.sql');
    const sqlText = fs.readFileSync(scriptPath, 'utf8');
    const batches = splitBatches(sqlText);

    if (!batches.length) {
        throw new Error('No SQL batches found in attendance-pto-rebuild.sql');
    }

    console.log(`Running attendance rebuild script: ${scriptPath}`);
    console.log(`Executing ${batches.length} SQL batch(es)...`);

    const pool = await sql.connect(getConfig());
    try {
        for (let i = 0; i < batches.length; i += 1) {
            const batchIndex = i + 1;
            console.log(`Batch ${batchIndex}/${batches.length}`);
            await pool.request().batch(batches[i]);
        }
        console.log('Attendance/PTO SQL rebuild completed successfully.');
    } finally {
        await pool.close();
    }
}

run().catch((error) => {
    console.error('Attendance/PTO SQL rebuild failed:', error?.message || error);
    process.exitCode = 1;
});
