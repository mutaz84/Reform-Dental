const sql = require('mssql');

let poolPromise = null;

function parseConnectionString(connStr) {
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
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr && connStr.trim()) {
        return parseConnectionString(connStr);
    }

    return {
        server: process.env.SQL_SERVER || '',
        database: process.env.SQL_DATABASE || '',
        user: process.env.SQL_USER || '',
        password: process.env.SQL_PASSWORD || '',
        options: {
            encrypt: true,
            trustServerCertificate: false
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

function validateConfig(config) {
    if (!config.server || !config.database || !config.user || !config.password) {
        const configuredKeys = {
            hasServer: Boolean(config.server),
            hasDatabase: Boolean(config.database),
            hasUser: Boolean(config.user),
            hasPassword: Boolean(config.password),
            hasSqlConnectionString: Boolean(process.env.SQL_CONNECTION_STRING)
        };
        const err = new Error(`SQL configuration is incomplete: ${JSON.stringify(configuredKeys)}`);
        err.code = 'SQL_CONFIG_INCOMPLETE';
        throw err;
    }
}

async function getPool() {
    if (!poolPromise) {
        const config = getConfig();
        validateConfig(config);
        poolPromise = sql.connect(config).catch((err) => {
            poolPromise = null;
            throw err;
        });
    }

    return poolPromise;
}

function bindInput(request, key, value) {
    if (value === undefined) {
        request.input(key, null);
        return;
    }
    request.input(key, value);
}

async function execute(query, params = {}) {
    const pool = await getPool();
    const request = pool.request();

    Object.entries(params || {}).forEach(([key, value]) => {
        bindInput(request, key, value);
    });

    return request.query(query);
}

async function resetPool() {
    if (!poolPromise) return;
    const existing = poolPromise;
    poolPromise = null;
    try {
        const pool = await existing;
        await pool.close();
    } catch (_) {
        // Ignore errors while resetting pool
    }
}

module.exports = {
    sql,
    execute,
    getConfig,
    getPool,
    resetPool
};
