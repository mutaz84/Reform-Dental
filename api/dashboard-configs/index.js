const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, isPlatformAdmin } = require('../shared/tenant');
const https = require('https');

const GRAY_FOREST_DASHBOARD_CONFIGS_API_BASE = 'https://gray-forest-05ad14f10.3.azurestaticapps.net/api/dashboard-configs';

const MAX_ID_LENGTH = 80;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

function requestJson(url, options, body) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body || {}));
        const request = https.request(url, {
            method: options.method,
            headers: {
                ...options.headers,
                ...(data !== undefined ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let parsed = raw;
                try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
                resolve({ status: response.statusCode || 500, body: parsed });
            });
        });
        request.on('error', reject);
        request.setTimeout(10000, () => {
            request.destroy(new Error('Dashboard configs proxy request timed out'));
        });
        if (data !== undefined) request.write(data);
        request.end();
    });
}

function getForwardedHost(req) {
    const headers = req.headers || {};
    return [
        headers['x-forwarded-host'],
        headers['X-Forwarded-Host'],
        headers['x-original-host'],
        headers['X-Original-Host'],
        headers['x-ms-original-host'],
        headers['X-MS-ORIGINAL-HOST'],
        headers.host,
        headers.Host
    ].filter(Boolean).join(' ').toLowerCase();
}

function shouldProxyDashboardConfigsRequest(req) {
    const host = getForwardedHost(req);
    if (host.includes('gray-forest-05ad14f10')) return false;
    if (host.includes('black-sky-06e87aa10')) return true;
    return String(process.env.PROXY_DASHBOARD_CONFIGS_TO_GRAY_FOREST || '').trim() === '1';
}

async function proxyDashboardConfigsToGrayForest(context, req, responseHeaders) {
    const id = normalizeDashboardId(req.params && req.params.id);
    const url = new URL(id ? `${GRAY_FOREST_DASHBOARD_CONFIGS_API_BASE}/${encodeURIComponent(id)}` : GRAY_FOREST_DASHBOARD_CONFIGS_API_BASE);
    Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const proxyHeaders = { 'Content-Type': 'application/json' };
    const headers = req.headers || {};
    const userId = headers['x-user-id'] || headers['X-User-Id'];
    if (userId) proxyHeaders['X-User-Id'] = String(userId);
    const authorization = headers.authorization || headers.Authorization;
    if (authorization) proxyHeaders.Authorization = String(authorization);

    const method = String(req.method || '').toUpperCase();
    const hasBody = !['GET', 'DELETE'].includes(method);
    const result = await requestJson(url, { method, headers: proxyHeaders }, hasBody ? req.body : undefined);
    context.res = { status: result.status, headers: responseHeaders, body: result.body };
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

function parseJsonSafe(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function cleanString(value, maxLength) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    return maxLength ? text.slice(0, maxLength) : text;
}

function normalizeDashboardId(value) {
    const id = cleanString(value, MAX_ID_LENGTH);
    return /^[A-Za-z0-9:_-]+$/.test(id) ? id : '';
}

function serializeSnapshot(value) {
    const snapshot = value && typeof value === 'object' ? value : {};
    return JSON.stringify(snapshot);
}

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function mapRow(row) {
    return {
        id: row.Id,
        name: row.Name || 'Untitled Dashboard',
        description: row.Description || '',
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
        ownerUserId: row.OwnerUserId || null,
        subscriptionId: row.SubscriptionId || null,
        snapshot: parseJsonSafe(row.SnapshotJson, {}) || {}
    };
}

async function ensureDashboardConfigsTable(pool) {
    await pool.request().batch(`
        IF OBJECT_ID('dbo.DashboardConfigs', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DashboardConfigs (
                Id NVARCHAR(80) NOT NULL PRIMARY KEY,
                SubscriptionId INT NULL,
                OwnerUserId INT NULL,
                Name NVARCHAR(200) NOT NULL,
                Description NVARCHAR(1000) NULL,
                SnapshotJson NVARCHAR(MAX) NOT NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            );
        END;

        IF COL_LENGTH('dbo.DashboardConfigs', 'SubscriptionId') IS NULL
            ALTER TABLE dbo.DashboardConfigs ADD SubscriptionId INT NULL;
        IF COL_LENGTH('dbo.DashboardConfigs', 'OwnerUserId') IS NULL
            ALTER TABLE dbo.DashboardConfigs ADD OwnerUserId INT NULL;
        IF COL_LENGTH('dbo.DashboardConfigs', 'Description') IS NULL
            ALTER TABLE dbo.DashboardConfigs ADD Description NVARCHAR(1000) NULL;
        IF COL_LENGTH('dbo.DashboardConfigs', 'SnapshotJson') IS NULL
            ALTER TABLE dbo.DashboardConfigs ADD SnapshotJson NVARCHAR(MAX) NOT NULL DEFAULT '{}';
        IF COL_LENGTH('dbo.DashboardConfigs', 'CreatedAt') IS NULL
            ALTER TABLE dbo.DashboardConfigs ADD CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
        IF COL_LENGTH('dbo.DashboardConfigs', 'UpdatedAt') IS NULL
            ALTER TABLE dbo.DashboardConfigs ADD UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DashboardConfigs_Subscription_UpdatedAt' AND object_id = OBJECT_ID('dbo.DashboardConfigs'))
            CREATE INDEX IX_DashboardConfigs_Subscription_UpdatedAt ON dbo.DashboardConfigs (SubscriptionId, UpdatedAt DESC);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DashboardConfigs_Owner_UpdatedAt' AND object_id = OBJECT_ID('dbo.DashboardConfigs'))
            CREATE INDEX IX_DashboardConfigs_Owner_UpdatedAt ON dbo.DashboardConfigs (OwnerUserId, UpdatedAt DESC);
    `);
}

async function getCallerScope(pool, req) {
    const userId = getRequestUserId(req);
    if (!userId) return null;

    const userColumns = await getTableColumns(pool, 'Users');
    if (!hasColumn(userColumns, 'Id')) return null;

    const subscriptionSelect = hasColumn(userColumns, 'SubscriptionId') ? 'SubscriptionId' : 'NULL AS SubscriptionId';

    const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`SELECT TOP 1 Id, ${subscriptionSelect} FROM Users WHERE Id = @userId`);

    const user = userResult.recordset?.[0];
    if (!user) return null;

    const platformAdmin = await isPlatformAdmin(pool, userId);
    const subscriptionId = platformAdmin ? null : await resolveDashboardSubscriptionId(pool, userId, user.SubscriptionId);

    return {
        userId: Number(user.Id),
        subscriptionId,
        platformAdmin
    };
}

async function resolveDashboardSubscriptionId(pool, userId, directSubscriptionId) {
    const direct = Number(directSubscriptionId) || null;
    if (direct) return direct;

    const subscriptionColumns = await getTableColumns(pool, 'Subscriptions');
    if (!hasColumn(subscriptionColumns, 'Id')) return null;

    const hasStatus = hasColumn(subscriptionColumns, 'Status');
    const statusFilter = hasStatus ? "AND ISNULL(s.Status, 'active') IN ('active', 'pending', 'cancellation_requested', 'paused')" : '';
    const orderBy = hasStatus
        ? "ORDER BY CASE WHEN s.Status = 'active' THEN 0 WHEN s.Status = 'pending' THEN 1 ELSE 2 END, s.Id DESC"
        : 'ORDER BY s.Id DESC';

    if (hasColumn(subscriptionColumns, 'OwnerUserId')) {
        const owned = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT TOP 1 s.Id
                FROM Subscriptions s
                WHERE s.OwnerUserId = @userId
                  ${statusFilter}
                ${orderBy}`);
        const ownedId = Number(owned.recordset?.[0]?.Id) || null;
        if (ownedId) return ownedId;
    }

    const userClinicColumns = await getTableColumns(pool, 'UserClinics');
    const subscriptionClinicColumns = await getTableColumns(pool, 'SubscriptionClinics');
    if (
        hasColumn(userClinicColumns, 'UserId')
        && hasColumn(userClinicColumns, 'ClinicId')
        && hasColumn(subscriptionClinicColumns, 'SubscriptionId')
        && hasColumn(subscriptionClinicColumns, 'ClinicId')
    ) {
        const clinicLinked = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT TOP 1 sc.SubscriptionId AS Id
                FROM UserClinics uc
                INNER JOIN SubscriptionClinics sc ON sc.ClinicId = uc.ClinicId
                INNER JOIN Subscriptions s ON s.Id = sc.SubscriptionId
                WHERE uc.UserId = @userId
                  ${statusFilter}
                ${orderBy}`);
        return Number(clinicLinked.recordset?.[0]?.Id) || null;
    }

    return null;
}

function addScopeFilter(request, scope, parts, alias = '') {
    request.input('scopeUserId', sql.Int, scope.userId);
    const prefix = alias ? `${alias}.` : '';

    if (scope.subscriptionId) {
        request.input('scopeSubscriptionId', sql.Int, scope.subscriptionId);
        parts.push(`(${prefix}SubscriptionId = @scopeSubscriptionId OR (${prefix}SubscriptionId IS NULL AND ${prefix}OwnerUserId = @scopeUserId))`);
    } else {
        parts.push(`${prefix}OwnerUserId = @scopeUserId`);
    }
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    let pool;
    try {
        if (shouldProxyDashboardConfigsRequest(req)) {
            await proxyDashboardConfigsToGrayForest(context, req, headers);
            return;
        }

        pool = await getPool();
        await ensureDashboardConfigsTable(pool);

        const scope = await getCallerScope(pool, req);
        if (!scope) {
            context.res = { status: 401, headers, body: { error: 'A valid X-User-Id is required to sync dashboards.' } };
            return;
        }

        const routeId = normalizeDashboardId(req.params && req.params.id);

        if (req.method === 'GET') {
            const request = pool.request();
            const where = [];
            addScopeFilter(request, scope, where);
            if (routeId) {
                request.input('id', sql.NVarChar(80), routeId);
                where.push('Id = @id');
            }

            const result = await request.query(`
                SELECT Id, SubscriptionId, OwnerUserId, Name, Description, SnapshotJson, CreatedAt, UpdatedAt
                FROM dbo.DashboardConfigs
                WHERE ${where.join(' AND ')}
                ORDER BY UpdatedAt DESC, Name ASC
            `);

            const rows = (result.recordset || []).map(mapRow);
            context.res = { status: 200, headers, body: routeId ? (rows[0] || null) : rows };
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            const body = parseRequestBody(req.body);
            const id = normalizeDashboardId(routeId || body.id || body.Id);
            const name = cleanString(body.name || body.Name || body.dashName || body.DashName, MAX_NAME_LENGTH) || 'Untitled Dashboard';
            const description = cleanString(body.description || body.Description, MAX_DESCRIPTION_LENGTH);
            const snapshotJson = serializeSnapshot(body.snapshot || body.Snapshot || {});

            if (!id) {
                context.res = { status: 400, headers, body: { error: 'Dashboard id is required.' } };
                return;
            }

            const request = pool.request()
                .input('id', sql.NVarChar(80), id)
                .input('subscriptionId', sql.Int, scope.subscriptionId)
                .input('ownerUserId', sql.Int, scope.userId)
                .input('name', sql.NVarChar(200), name)
                .input('description', sql.NVarChar(1000), description || null)
                .input('snapshotJson', sql.NVarChar(sql.MAX), snapshotJson);

            const existingWhere = ['Id = @id'];
            addScopeFilter(request, scope, existingWhere);

            await request.query(`
                IF EXISTS (SELECT 1 FROM dbo.DashboardConfigs WHERE ${existingWhere.join(' AND ')})
                BEGIN
                    UPDATE dbo.DashboardConfigs
                    SET Name = @name,
                        Description = @description,
                        SnapshotJson = @snapshotJson,
                        SubscriptionId = @subscriptionId,
                        OwnerUserId = @ownerUserId,
                        UpdatedAt = SYSUTCDATETIME()
                    WHERE ${existingWhere.join(' AND ')};
                END
                ELSE
                BEGIN
                    INSERT INTO dbo.DashboardConfigs (Id, SubscriptionId, OwnerUserId, Name, Description, SnapshotJson, CreatedAt, UpdatedAt)
                    VALUES (@id, @subscriptionId, @ownerUserId, @name, @description, @snapshotJson, SYSUTCDATETIME(), SYSUTCDATETIME());
                END
            `);

            const saved = await pool.request()
                .input('id', sql.NVarChar(80), id)
                .query('SELECT Id, SubscriptionId, OwnerUserId, Name, Description, SnapshotJson, CreatedAt, UpdatedAt FROM dbo.DashboardConfigs WHERE Id = @id');

            context.res = { status: 200, headers, body: mapRow(saved.recordset[0]) };
            return;
        }

        if (req.method === 'DELETE') {
            if (!routeId) {
                context.res = { status: 400, headers, body: { error: 'Dashboard id is required.' } };
                return;
            }

            const request = pool.request().input('id', sql.NVarChar(80), routeId);
            const where = ['Id = @id'];
            addScopeFilter(request, scope, where);
            await request.query(`DELETE FROM dbo.DashboardConfigs WHERE ${where.join(' AND ')}`);
            context.res = { status: 200, headers, body: { deleted: true } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (err) {
        const message = String(err && err.message || err || 'Unknown error');
        if (/connection is closed|connection not yet open|socket|timeout/i.test(message)) {
            try { await resetPool(); } catch (_) {}
        }
        context.log.error('Dashboard configs API error:', err);
        context.res = { status: 500, headers, body: { error: message } };
    }
};