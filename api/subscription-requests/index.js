const { sql, getPool, resetPool } = require('../shared/database');
const { TENANT_PARAM, getRequestUserId, isPlatformAdmin } = require('../shared/tenant');

const REQUEST_TYPES = new Set([
    'cancellation',
    'plan_change',
    'add_clinic',
    'billing',
    'pause',
    'contact_change',
    'other'
]);

const STATUSES = new Set(['open', 'in_review', 'approved', 'denied', 'completed', 'cancelled']);

function toIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function bodyValue(body, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(body || {}, key) && body[key] !== undefined) return body[key];
    }
    return undefined;
}

function textOrNull(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text || null;
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

function normalizeRequestType(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return REQUEST_TYPES.has(normalized) ? normalized : 'other';
}

function normalizeStatus(value, fallback = 'open') {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return STATUSES.has(normalized) ? normalized : fallback;
}

async function ensureSubscriptionRequestsTable(pool) {
    await pool.request().batch(`
        IF OBJECT_ID('dbo.SubscriptionRequests', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.SubscriptionRequests (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                SubscriptionId INT NOT NULL,
                RequestedByUserId INT NOT NULL,
                RequestType NVARCHAR(40) NOT NULL,
                CurrentPlanId INT NULL,
                TargetPlanId INT NULL,
                Status NVARCHAR(30) NOT NULL DEFAULT 'open',
                Reason NVARCHAR(MAX) NULL,
                Notes NVARCHAR(MAX) NULL,
                AdminResponse NVARCHAR(MAX) NULL,
                CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
                UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
                ResolvedAt DATETIME NULL,
                ResolvedByUserId INT NULL
            );
            CREATE INDEX IX_SubscriptionRequests_SubscriptionId ON dbo.SubscriptionRequests (SubscriptionId, CreatedAt DESC);
            CREATE INDEX IX_SubscriptionRequests_Status ON dbo.SubscriptionRequests (Status, CreatedAt DESC);
        END
    `);
}

function rows(body) {
    return Array.isArray(body) ? body : [];
}

async function getUserSubscriptionId(pool, userId) {
    const id = toIntOrNull(userId);
    if (!id) return null;

    const result = await pool.request()
        .input('userId', sql.Int, id)
        .query(`
            SELECT TOP 1 COALESCE(u.SubscriptionId, owned.Id) AS SubscriptionId
            FROM Users u
            OUTER APPLY (
                SELECT TOP 1 s.Id
                FROM Subscriptions s
                WHERE s.OwnerUserId = u.Id
                  AND s.Status IN ('active', 'pending', 'cancellation_requested', 'paused')
                ORDER BY CASE WHEN s.Status='active' THEN 0 ELSE 1 END, s.Id DESC
            ) owned
            WHERE u.Id = @userId`);
    return toIntOrNull(result.recordset[0] && result.recordset[0].SubscriptionId);
}

async function canSeeSubscription(pool, subscriptionId, callerUserId, callerIsPlatformAdmin) {
    if (callerIsPlatformAdmin) return true;
    const subId = toIntOrNull(subscriptionId);
    const userId = toIntOrNull(callerUserId);
    if (!subId || !userId) return false;

    const result = await pool.request()
        .input('subId', sql.Int, subId)
        .input(TENANT_PARAM, sql.Int, userId)
        .query(`
            SELECT TOP 1 1 AS Ok
            FROM Subscriptions s
            WHERE s.Id = @subId
              AND (
                s.OwnerUserId = @${TENANT_PARAM}
                OR s.Id = (SELECT TOP 1 SubscriptionId FROM Users WHERE Id = @${TENANT_PARAM})
              )`);
    return rows(result.recordset).length > 0;
}

async function getCurrentPlanId(pool, subscriptionId) {
    const result = await pool.request()
        .input('subId', sql.Int, subscriptionId)
        .query('SELECT TOP 1 PlanId FROM Subscriptions WHERE Id = @subId');
    return toIntOrNull(result.recordset[0] && result.recordset[0].PlanId);
}

async function getPlanLimits(pool, planId) {
    const result = await pool.request()
        .input('id', sql.Int, planId)
        .query('SELECT TOP 1 Id, Name, MaxClinics, IsActive FROM SubscriptionPlans WHERE Id = @id');
    return result.recordset[0] || null;
}

async function countSubscriptionClinics(pool, subscriptionId) {
    const result = await pool.request()
        .input('id', sql.Int, subscriptionId)
        .query('SELECT COUNT(*) AS Count FROM SubscriptionClinics WHERE SubscriptionId = @id');
    return result.recordset[0] ? Number(result.recordset[0].Count || 0) : 0;
}

async function applyApprovedRequest(pool, row, actorUserId) {
    const requestType = String(row.RequestType || '').toLowerCase();
    const subColumns = await getTableColumns(pool, 'Subscriptions');
    const modifiedClause = hasColumn(subColumns, 'ModifiedDate') ? ', ModifiedDate = GETUTCDATE()' : '';

    if (requestType === 'plan_change') {
        const targetPlanId = toIntOrNull(row.TargetPlanId);
        if (!targetPlanId) throw new Error('This plan change request has no target plan.');
        const plan = await getPlanLimits(pool, targetPlanId);
        if (!plan) throw new Error('Target plan not found.');
        const clinicCount = await countSubscriptionClinics(pool, row.SubscriptionId);
        if (Number(plan.MaxClinics || 1) < clinicCount) {
            throw new Error(`Plan ${plan.Name} only allows ${plan.MaxClinics} clinic(s); subscription currently covers ${clinicCount}.`);
        }
        await pool.request()
            .input('subId', sql.Int, row.SubscriptionId)
            .input('planId', sql.Int, targetPlanId)
            .query(`UPDATE Subscriptions SET PlanId = @planId${modifiedClause} WHERE Id = @subId`);
        await insertEvent(pool, row.SubscriptionId, actorUserId, 'plan_changed', { requestId: row.Id, newPlanId: targetPlanId });
        return;
    }

    if (requestType === 'cancellation') {
        await pool.request()
            .input('subId', sql.Int, row.SubscriptionId)
            .query(`UPDATE Subscriptions SET Status = 'cancelled', CancelledAt = GETUTCDATE()${modifiedClause} WHERE Id = @subId`);
        await insertEvent(pool, row.SubscriptionId, actorUserId, 'cancelled', { requestId: row.Id });
        return;
    }

    if (requestType === 'pause') {
        await pool.request()
            .input('subId', sql.Int, row.SubscriptionId)
            .query(`UPDATE Subscriptions SET Status = 'paused'${modifiedClause} WHERE Id = @subId`);
        await insertEvent(pool, row.SubscriptionId, actorUserId, 'paused', { requestId: row.Id });
    }
}

function mapRow(row) {
    if (!row) return null;
    return {
        Id: row.Id,
        SubscriptionId: row.SubscriptionId,
        RequestedByUserId: row.RequestedByUserId,
        RequestType: row.RequestType,
        CurrentPlanId: row.CurrentPlanId,
        TargetPlanId: row.TargetPlanId,
        Status: row.Status,
        Reason: row.Reason,
        Notes: row.Notes,
        AdminResponse: row.AdminResponse,
        CreatedAt: row.CreatedAt,
        UpdatedAt: row.UpdatedAt,
        ResolvedAt: row.ResolvedAt,
        ResolvedByUserId: row.ResolvedByUserId,
        SubscriptionStatus: row.SubscriptionStatus,
        CurrentPlanName: row.CurrentPlanName,
        TargetPlanName: row.TargetPlanName,
        RequestedByName: row.RequestedByName,
        RequestedByEmail: row.RequestedByEmail
    };
}

async function insertEvent(pool, subscriptionId, actorUserId, eventType, payload) {
    try {
        await pool.request()
            .input('subId', sql.Int, subscriptionId)
            .input('actor', sql.Int, actorUserId)
            .input('eventType', sql.NVarChar(50), eventType)
            .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(payload || {}))
            .query(`
                IF OBJECT_ID('SubscriptionEvents', 'U') IS NOT NULL
                BEGIN
                    INSERT INTO SubscriptionEvents (SubscriptionId, EventType, ActorUserId, Payload)
                    VALUES (@subId, @eventType, @actor, @payload)
                END`);
    } catch (_) {}
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        await ensureSubscriptionRequestsTable(pool);
        const callerUserId = getRequestUserId(req);
        const callerIsPlatformAdmin = await isPlatformAdmin(pool, callerUserId);
        const id = toIntOrNull(req.params && req.params.id);
        const body = req.body || {};

        if (!callerUserId) {
            context.res = { status: 401, headers, body: { error: 'Missing X-User-Id.' } };
            return;
        }

        if (req.method === 'GET') {
            const requestedSubId = toIntOrNull(req.query && (req.query.subscriptionId || req.query.SubscriptionId));
            const status = req.query && req.query.status ? normalizeStatus(req.query.status, '') : '';
            const request = pool.request().input(TENANT_PARAM, sql.Int, callerUserId);
            const where = [];

            if (id) {
                request.input('id', sql.Int, id);
                where.push('sr.Id = @id');
            }
            if (requestedSubId) {
                request.input('subId', sql.Int, requestedSubId);
                where.push('sr.SubscriptionId = @subId');
            }
            if (status) {
                request.input('status', sql.NVarChar(30), status);
                where.push('sr.Status = @status');
            }
            if (!callerIsPlatformAdmin) {
                where.push(`(sr.RequestedByUserId = @${TENANT_PARAM} OR sr.SubscriptionId = (SELECT TOP 1 SubscriptionId FROM Users WHERE Id = @${TENANT_PARAM}))`);
            }

            const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
            const result = await request.query(`
                SELECT sr.*,
                       s.Status AS SubscriptionStatus,
                       cp.Name AS CurrentPlanName,
                       tp.Name AS TargetPlanName,
                       LTRIM(RTRIM(COALESCE(u.FirstName, '') + ' ' + COALESCE(u.LastName, ''))) AS RequestedByName,
                       ISNULL(u.PersonalEmail, u.WorkEmail) AS RequestedByEmail
                FROM SubscriptionRequests sr
                LEFT JOIN Subscriptions s ON s.Id = sr.SubscriptionId
                LEFT JOIN SubscriptionPlans cp ON cp.Id = sr.CurrentPlanId
                LEFT JOIN SubscriptionPlans tp ON tp.Id = sr.TargetPlanId
                LEFT JOIN Users u ON u.Id = sr.RequestedByUserId
                ${whereSql}
                ORDER BY sr.CreatedAt DESC, sr.Id DESC`);

            const mapped = rows(result.recordset).map(mapRow);
            context.res = { status: 200, headers, body: id ? (mapped[0] || null) : mapped };
            return;
        }

        if (req.method === 'POST') {
            let subscriptionId = toIntOrNull(bodyValue(body, 'subscriptionId', 'SubscriptionId'));
            if (!subscriptionId) subscriptionId = await getUserSubscriptionId(pool, callerUserId);
            if (!subscriptionId) {
                context.res = { status: 400, headers, body: { error: 'No subscription was found for this user.' } };
                return;
            }
            if (!await canSeeSubscription(pool, subscriptionId, callerUserId, callerIsPlatformAdmin)) {
                context.res = { status: 403, headers, body: { error: 'Forbidden' } };
                return;
            }

            const requestType = normalizeRequestType(bodyValue(body, 'requestType', 'RequestType', 'type'));
            const currentPlanId = toIntOrNull(bodyValue(body, 'currentPlanId', 'CurrentPlanId')) || await getCurrentPlanId(pool, subscriptionId);
            const targetPlanId = toIntOrNull(bodyValue(body, 'targetPlanId', 'TargetPlanId', 'planId', 'PlanId'));
            const reason = textOrNull(bodyValue(body, 'reason', 'Reason'));
            const notes = textOrNull(bodyValue(body, 'notes', 'Notes', 'message', 'Message'));

            if (requestType === 'plan_change' && !targetPlanId) {
                context.res = { status: 400, headers, body: { error: 'targetPlanId is required for plan change requests.' } };
                return;
            }

            const result = await pool.request()
                .input('subscriptionId', sql.Int, subscriptionId)
                .input('requestedBy', sql.Int, callerUserId)
                .input('requestType', sql.NVarChar(40), requestType)
                .input('currentPlanId', sql.Int, currentPlanId)
                .input('targetPlanId', sql.Int, targetPlanId)
                .input('reason', sql.NVarChar(sql.MAX), reason)
                .input('notes', sql.NVarChar(sql.MAX), notes)
                .query(`
                    INSERT INTO SubscriptionRequests
                        (SubscriptionId, RequestedByUserId, RequestType, CurrentPlanId, TargetPlanId, Status, Reason, Notes, CreatedAt, UpdatedAt)
                    OUTPUT INSERTED.Id
                    VALUES
                        (@subscriptionId, @requestedBy, @requestType, @currentPlanId, @targetPlanId, 'open', @reason, @notes, GETUTCDATE(), GETUTCDATE())`);
            const newId = result.recordset[0].Id;
            await insertEvent(pool, subscriptionId, callerUserId, 'request_created', { requestId: newId, requestType, targetPlanId, reason, notes });
            context.res = { status: 201, headers, body: { id: newId, status: 'open' } };
            return;
        }

        if (req.method === 'PUT' && id) {
            const existing = await pool.request()
                .input('id', sql.Int, id)
                .query('SELECT TOP 1 * FROM SubscriptionRequests WHERE Id = @id');
            const row = existing.recordset[0];
            if (!row) {
                context.res = { status: 404, headers, body: { error: 'Subscription request not found.' } };
                return;
            }
            if (!await canSeeSubscription(pool, row.SubscriptionId, callerUserId, callerIsPlatformAdmin)) {
                context.res = { status: 403, headers, body: { error: 'Forbidden' } };
                return;
            }

            const requestedStatus = normalizeStatus(bodyValue(body, 'status', 'Status'), row.Status || 'open');
            const adminResponse = textOrNull(bodyValue(body, 'adminResponse', 'AdminResponse', 'response'));
            const notes = textOrNull(bodyValue(body, 'notes', 'Notes'));

            if (!callerIsPlatformAdmin) {
                if (row.RequestedByUserId !== callerUserId || !['open', 'in_review'].includes(String(row.Status || '').toLowerCase()) || requestedStatus !== 'cancelled') {
                    context.res = { status: 403, headers, body: { error: 'Only platform admin can update subscription requests, except subscribers cancelling their own open request.' } };
                    return;
                }
            }

            const resolved = ['approved', 'denied', 'completed', 'cancelled'].includes(requestedStatus);
            if (callerIsPlatformAdmin && requestedStatus === 'approved') {
                await applyApprovedRequest(pool, row, callerUserId);
            }
            await pool.request()
                .input('id', sql.Int, id)
                .input('status', sql.NVarChar(30), requestedStatus)
                .input('adminResponse', sql.NVarChar(sql.MAX), adminResponse)
                .input('notes', sql.NVarChar(sql.MAX), notes)
                .input('resolvedBy', sql.Int, resolved ? callerUserId : null)
                .query(`
                    UPDATE SubscriptionRequests
                    SET Status = @status,
                        AdminResponse = COALESCE(@adminResponse, AdminResponse),
                        Notes = COALESCE(@notes, Notes),
                        UpdatedAt = GETUTCDATE(),
                        ResolvedAt = CASE WHEN @resolvedBy IS NULL THEN ResolvedAt ELSE GETUTCDATE() END,
                        ResolvedByUserId = COALESCE(@resolvedBy, ResolvedByUserId)
                    WHERE Id = @id`);
            await insertEvent(pool, row.SubscriptionId, callerUserId, 'request_updated', { requestId: id, status: requestedStatus, adminResponse, notes });
            context.res = { status: 200, headers, body: { id, status: requestedStatus } };
            return;
        }

        if (req.method === 'DELETE' && id) {
            const existing = await pool.request()
                .input('id', sql.Int, id)
                .query('SELECT TOP 1 * FROM SubscriptionRequests WHERE Id = @id');
            const row = existing.recordset[0];
            if (!row) {
                context.res = { status: 404, headers, body: { error: 'Subscription request not found.' } };
                return;
            }
            if (!callerIsPlatformAdmin && row.RequestedByUserId !== callerUserId) {
                context.res = { status: 403, headers, body: { error: 'Forbidden' } };
                return;
            }
            await pool.request().input('id', sql.Int, id).query('DELETE FROM SubscriptionRequests WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Subscription request deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
    } catch (err) {
        context.log.error('SubscriptionRequests error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
