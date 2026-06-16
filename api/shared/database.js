const sql = require('mssql');

let poolPromise = null;
let tenantSchemaEnsured = false;

function isPoolUsable(pool) {
    return Boolean(pool) && (pool.connected === true || pool.connecting === true);
}

// Phase 7 tenant migration. Runs once per cold-start. Idempotent (NULL-only updates).
// Adds Users.SubscriptionId, Clinics.SubscriptionId, Vendors.SubscriptionId and
// backfills via existing relations. See tenant.js for filter semantics.
async function ensureTenantSchema(pool) {
    if (tenantSchemaEnsured) return;
    try {
        await pool.request().batch(`
            -- Users.SubscriptionId column
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Users'))
                ALTER TABLE Users ADD SubscriptionId INT NULL;
        `);
        await pool.request().batch(`
            -- Clinics.SubscriptionId column
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Clinics'))
                ALTER TABLE Clinics ADD SubscriptionId INT NULL;
        `);
        await pool.request().batch(`
            -- Vendors.SubscriptionId column
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Vendors'))
                ALTER TABLE Vendors ADD SubscriptionId INT NULL;
        `);
        await pool.request().batch(`
            -- Tasks.SubscriptionId column
            IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'Tasks') AND type = 'U')
            AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Tasks'))
                ALTER TABLE Tasks ADD SubscriptionId INT NULL;
        `);
        await pool.request().batch(`
            -- Teams.SubscriptionId column
            IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'Teams') AND type = 'U')
            AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Teams'))
                ALTER TABLE Teams ADD SubscriptionId INT NULL;
        `);
        await pool.request().batch(`
            -- TeamEvents.SubscriptionId column
            IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'TeamEvents') AND type = 'U')
            AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'TeamEvents'))
                ALTER TABLE TeamEvents ADD SubscriptionId INT NULL;
        `);

        // Owners: each Subscriptions.OwnerUserId gets that subscription's Id.
        await pool.request().query(`
            UPDATE u SET u.SubscriptionId = s.Id
            FROM Users u
            INNER JOIN Subscriptions s ON s.OwnerUserId = u.Id AND s.IsActive = 1
            WHERE u.SubscriptionId IS NULL;
        `);

        // Sub-users: derive via UserClinics -> SubscriptionClinics, prefer non-admin sub.
        await pool.request().query(`
            ;WITH AdminUser AS (
                SELECT TOP 1 Id FROM Users WHERE LOWER(Username) = 'admin'
            ),
            NonAdminMap AS (
                SELECT uc.UserId, MIN(sc.SubscriptionId) AS SubId
                FROM UserClinics uc
                INNER JOIN SubscriptionClinics sc ON sc.ClinicId = uc.ClinicId
                INNER JOIN Subscriptions sub ON sub.Id = sc.SubscriptionId
                CROSS JOIN AdminUser a
                WHERE sub.OwnerUserId <> a.Id
                GROUP BY uc.UserId
            ),
            AnyMap AS (
                SELECT uc.UserId, MIN(sc.SubscriptionId) AS SubId
                FROM UserClinics uc
                INNER JOIN SubscriptionClinics sc ON sc.ClinicId = uc.ClinicId
                GROUP BY uc.UserId
            )
            UPDATE u SET u.SubscriptionId = COALESCE(n.SubId, a.SubId)
            FROM Users u
            LEFT JOIN NonAdminMap n ON n.UserId = u.Id
            LEFT JOIN AnyMap a ON a.UserId = u.Id
            WHERE u.SubscriptionId IS NULL
              AND COALESCE(n.SubId, a.SubId) IS NOT NULL;
        `);

        // Clinics: prefer non-admin subscription owner over admin's house sub.
        await pool.request().query(`
            ;WITH AdminUser AS (
                SELECT TOP 1 Id FROM Users WHERE LOWER(Username) = 'admin'
            ),
            NonAdminClinic AS (
                SELECT sc.ClinicId, MIN(sc.SubscriptionId) AS SubId
                FROM SubscriptionClinics sc
                INNER JOIN Subscriptions sub ON sub.Id = sc.SubscriptionId
                CROSS JOIN AdminUser a
                WHERE sub.OwnerUserId <> a.Id
                GROUP BY sc.ClinicId
            ),
            AnyClinic AS (
                SELECT sc.ClinicId, MIN(sc.SubscriptionId) AS SubId
                FROM SubscriptionClinics sc
                GROUP BY sc.ClinicId
            )
            UPDATE c SET c.SubscriptionId = COALESCE(n.SubId, a.SubId)
            FROM Clinics c
            LEFT JOIN NonAdminClinic n ON n.ClinicId = c.Id
            LEFT JOIN AnyClinic a ON a.ClinicId = c.Id
            WHERE c.SubscriptionId IS NULL
              AND COALESCE(n.SubId, a.SubId) IS NOT NULL;
        `);

        // Vendors: existing rows -> admin's house subscription.
        await pool.request().query(`
            ;WITH AdminSub AS (
                SELECT TOP 1 s.Id AS Id FROM Subscriptions s
                INNER JOIN Users u ON u.Id = s.OwnerUserId
                WHERE LOWER(u.Username) = 'admin'
                ORDER BY s.Id ASC
            )
            UPDATE Vendors SET SubscriptionId = (SELECT Id FROM AdminSub)
            WHERE SubscriptionId IS NULL
              AND EXISTS (SELECT 1 FROM AdminSub);
        `);

        // Tasks: backfill via Clinics.SubscriptionId chain when ClinicId exists,
        // otherwise to admin's house subscription.
        await pool.request().query(`
            IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Tasks'))
            BEGIN
                UPDATE t SET t.SubscriptionId = c.SubscriptionId
                FROM Tasks t
                INNER JOIN Clinics c ON c.Id = t.ClinicId
                WHERE t.SubscriptionId IS NULL AND c.SubscriptionId IS NOT NULL;

                ;WITH AdminSub AS (
                    SELECT TOP 1 s.Id AS Id FROM Subscriptions s
                    INNER JOIN Users u ON u.Id = s.OwnerUserId
                    WHERE LOWER(u.Username) = 'admin'
                    ORDER BY s.Id ASC
                )
                UPDATE Tasks SET SubscriptionId = (SELECT Id FROM AdminSub)
                WHERE SubscriptionId IS NULL AND EXISTS (SELECT 1 FROM AdminSub);
            END
        `);

        // Teams: existing rows -> admin's house subscription (no clinic linkage).
        await pool.request().query(`
            IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Teams'))
            BEGIN
                ;WITH AdminSub AS (
                    SELECT TOP 1 s.Id AS Id FROM Subscriptions s
                    INNER JOIN Users u ON u.Id = s.OwnerUserId
                    WHERE LOWER(u.Username) = 'admin'
                    ORDER BY s.Id ASC
                )
                UPDATE Teams SET SubscriptionId = (SELECT Id FROM AdminSub)
                WHERE SubscriptionId IS NULL AND EXISTS (SELECT 1 FROM AdminSub);
            END
        `);

        // TeamEvents: derive from parent Teams.SubscriptionId, fallback admin sub.
        await pool.request().query(`
            IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'TeamEvents'))
            BEGIN
                IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'SubscriptionId' AND Object_ID = Object_ID(N'Teams'))
                BEGIN
                    UPDATE te SET te.SubscriptionId = t.SubscriptionId
                    FROM TeamEvents te
                    INNER JOIN Teams t ON t.Id = te.TeamId
                    WHERE te.SubscriptionId IS NULL AND t.SubscriptionId IS NOT NULL;
                END

                ;WITH AdminSub AS (
                    SELECT TOP 1 s.Id AS Id FROM Subscriptions s
                    INNER JOIN Users u ON u.Id = s.OwnerUserId
                    WHERE LOWER(u.Username) = 'admin'
                    ORDER BY s.Id ASC
                )
                UPDATE TeamEvents SET SubscriptionId = (SELECT Id FROM AdminSub)
                WHERE SubscriptionId IS NULL AND EXISTS (SELECT 1 FROM AdminSub);
            END
        `);

        tenantSchemaEnsured = true;
    } catch (err) {
        // Don't crash the app if migration fails (e.g. permission issues);
        // surface in logs but allow handlers to continue with old behaviour.
        try { console.error('ensureTenantSchema failed:', err && err.message); } catch (_) {}
    }
}

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

        const pool = new sql.ConnectionPool(config);
        let connectPromise;

        pool.on('error', () => {
            if (poolPromise === connectPromise) {
                poolPromise = null;
            }
        });

        connectPromise = pool.connect().catch((err) => {
            if (poolPromise === connectPromise) {
                poolPromise = null;
            }
            throw err;
        });

        poolPromise = connectPromise;
    }

    const pool = await poolPromise;

    if (isPoolUsable(pool)) {
        if (!tenantSchemaEnsured) {
            // Fire-and-forget: don't block first request; subsequent requests
            // will see the migrated schema once the promise resolves.
            ensureTenantSchema(pool).catch(() => {});
        }
        return pool;
    }

    await resetPool();
    return getPool();
}

function bindInput(request, key, value) {
    if (value === undefined) {
        request.input(key, null);
        return;
    }
    // For strings longer than 4000 chars, explicitly use NVarChar(MAX) to
    // prevent mssql from defaulting to nvarchar(4000) and silently truncating.
    if (typeof value === 'string' && value.length > 4000) {
        request.input(key, sql.NVarChar(sql.MAX), value);
        return;
    }
    request.input(key, value);
}

async function execute(query, params = {}) {
    const runQuery = async () => {
        const pool = await getPool();
        const request = pool.request();

        Object.entries(params || {}).forEach(([key, value]) => {
            bindInput(request, key, value);
        });

        return request.query(query);
    };

    try {
        return await runQuery();
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const shouldRetry = message.includes('connection is closed') || message.includes('connection not yet open');
        if (!shouldRetry) {
            throw error;
        }

        await resetPool();
        return runQuery();
    }
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
    resetPool,
    ensureTenantSchema
};
