const { sql, getPool } = require('./database');

/**
 * Tenant scoping helpers.
 *
 * Multi-tenancy is enforced at query-time using the user's UserClinics membership.
 * Every API endpoint that returns or mutates tenant-scoped data should:
 *   1. Resolve the caller's UserId via getRequestUserId(req).
 *   2. Add the snippet returned by tenantClinicScopeSql('ClinicId') (or with a
 *      table alias such as 't.ClinicId') to its WHERE clause.
 *   3. Bind the userId via the param name TENANT_PARAM ('_tenantUserId').
 *
 * If a user has no clinic memberships, the subquery returns no ClinicIds and
 * the caller naturally sees zero rows (fail closed).
 */

const TENANT_PARAM = '_tenantUserId';

function _toIntOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Pulls the caller's UserId from the request. Handles both Azure Functions v3
 * (req.headers is a plain object) and v4 (request.headers is a Headers
 * instance). Looks at, in order:
 *   - X-User-Id header
 *   - query.userId / query.actorUserId / query.UserId
 *   - body.userId / body.actorUserId / body.UserId
 * Returns null if none of those are present or numeric.
 */
function getRequestUserId(req) {
    if (!req) return null;

    // Header lookup (works for v3 plain object and v4 Headers instance).
    const headers = req.headers;
    let headerVal;
    if (headers) {
        if (typeof headers.get === 'function') {
            headerVal = headers.get('x-user-id') || headers.get('X-User-Id');
        } else {
            headerVal = headers['x-user-id'] || headers['X-User-Id'];
        }
    }
    const fromHeader = _toIntOrNull(headerVal);
    if (fromHeader) return fromHeader;

    // Query lookup (v4 query is a URLSearchParams-like Map; v3 is a plain object).
    const q = req.query;
    let qVal;
    if (q && typeof q.get === 'function') {
        qVal = q.get('userId') || q.get('actorUserId') || q.get('UserId') || q.get('ActorUserId');
    } else if (q && typeof q === 'object') {
        qVal = q.userId || q.actorUserId || q.UserId || q.ActorUserId;
    }
    const fromQuery = _toIntOrNull(qVal);
    if (fromQuery) return fromQuery;

    // Body lookup (must already be parsed by caller).
    const b = req.body || (typeof req.json === 'function' ? null : null);
    if (b && typeof b === 'object') {
        const fromBody = _toIntOrNull(b.userId || b.actorUserId || b.UserId || b.ActorUserId);
        if (fromBody) return fromBody;
    }

    return null;
}

/**
 * Returns the array of ClinicIds the user may access via UserClinics.
 * Returns [] when the user has no clinic memberships (means: see nothing).
 * Pool may be a sql.ConnectionPool OR an open Transaction.
 */
async function getUserClinicIds(pool, userId) {
    const id = _toIntOrNull(userId);
    if (!id) return [];
    try {
        const result = await pool.request()
            .input('userId', sql.Int, id)
            .query(`
                SELECT DISTINCT uc.ClinicId
                FROM UserClinics uc
                INNER JOIN Clinics c ON c.Id = uc.ClinicId
                WHERE uc.UserId = @userId
                  AND ISNULL(c.IsActive, 1) = 1`);
        return (result.recordset || [])
            .map((r) => _toIntOrNull(r.ClinicId))
            .filter((n) => n !== null);
    } catch (err) {
        return [];
    }
}

/**
 * Convenience: combines getRequestUserId + getUserClinicIds.
 * Returns { userId, clinicIds }.
 */
async function getTenantContext(req, pool) {
    const userId = getRequestUserId(req);
    if (!userId) return { userId: null, clinicIds: [] };
    const usePool = pool || (await getPool());
    const clinicIds = await getUserClinicIds(usePool, userId);
    return { userId, clinicIds };
}

/**
 * Returns a SQL snippet that scopes a column to clinics the caller is a member of.
 * Caller must bind the userId via TENANT_PARAM.
 *
 * Example:
 *   request.input('_tenantUserId', sql.Int, userId);
 *   await request.query(`SELECT * FROM Equipment WHERE ${tenantClinicScopeSql('ClinicId')}`);
 *
 * Or with execute():
 *   const params = { ..., _tenantUserId: userId };
 *   await execute(`SELECT * FROM Tasks t WHERE ${tenantClinicScopeSql('t.ClinicId')}`, params);
 *
 * NOTE: pass a userId of -1 (or 0) when none is available so the subquery
 * matches no rows (fail closed). Wrap the snippet with `userId == null` check
 * upstream if you prefer to short-circuit.
 */
function tenantClinicScopeSql(columnExpr = 'ClinicId') {
    // Black Sky starter mode is subscription-free, so clinic visibility is based
    // on direct UserClinics membership. Platform admin still sees everything.
    return `(
        EXISTS (SELECT 1 FROM Users WHERE Id = @${TENANT_PARAM} AND LOWER(Username) = 'admin')
        OR ${columnExpr} IN (
            SELECT uc.ClinicId FROM UserClinics uc
            WHERE uc.UserId = @${TENANT_PARAM}
        )
    )`;
}

async function resolveVisibleClinicId(pool, requestedClinicId, tenantUserId) {
    const id = _toIntOrNull(tenantUserId);
    if (!id) return null;
    const clinicId = _toIntOrNull(requestedClinicId);
    const request = pool.request().input(TENANT_PARAM, sql.Int, id);
    const where = [tenantClinicScopeSql('Id')];
    if (clinicId) {
        request.input('clinicId', sql.Int, clinicId);
        where.push('Id = @clinicId');
    }
    const result = await request.query(`SELECT TOP 1 Id FROM Clinics WHERE ${where.join(' AND ')} ORDER BY Id`);
    return result.recordset[0]?.Id || null;
}

// Phase 7: direct SubscriptionId column filter for tables that don't have a
// ClinicId (e.g. Vendors). Same admin bypass.
function tenantSubscriptionScope(columnExpr = 'SubscriptionId') {
    return `(
        EXISTS (SELECT 1 FROM Users WHERE Id = @${TENANT_PARAM} AND LOWER(Username) = 'admin')
        OR ${columnExpr} = (SELECT TOP 1 SubscriptionId FROM Users WHERE Id = @${TENANT_PARAM})
    )`;
}

/**
 * Returns a SQL subquery producing the set of UserIds the caller may "see":
 *   - the caller themselves
 *   - every user assigned to a clinic the caller can reach via tenantClinicScopeSql
 * Caller must bind the userId via TENANT_PARAM.
 *
 * Use as: `WHERE ${columnExpr} IN (${tenantVisibleUserIdsSql()})`
 * Or via convenience helper: tenantVisibleUserIdsClause('t.UserId').
 */
function tenantVisibleUserIdsSql() {
    // Platform admin (Username='admin') sees ALL users across all subscriptions.
    // Everyone else sees: themselves + users sharing at least one clinic membership.
    return `
        SELECT u_all.Id AS UserId
            FROM Users u_all
            WHERE EXISTS (SELECT 1 FROM Users u_admin WHERE u_admin.Id = @${TENANT_PARAM} AND LOWER(u_admin.Username) = 'admin')
        UNION
        SELECT @${TENANT_PARAM} AS UserId
        UNION
        SELECT u2.Id
            FROM Users u2
            INNER JOIN UserClinics uc2 ON uc2.UserId = u2.Id
            WHERE uc2.ClinicId IN (
                SELECT uc.ClinicId FROM UserClinics uc WHERE uc.UserId = @${TENANT_PARAM}
            )
    `;
}

function tenantVisibleUserIdsClause(columnExpr = 'UserId') {
    return `${columnExpr} IN (${tenantVisibleUserIdsSql()})`;
}

/**
 * Same as tenantVisibleUserIdsSql but returns Usernames (for tables that store
 * a username string instead of a UserId — e.g. PurchaseOrders.CreatedBy,
 * Requests.RequestedBy).
 */
function tenantVisibleUsernamesSql() {
    return `
        SELECT u.Username
            FROM Users u
            WHERE u.Id IN (${tenantVisibleUserIdsSql()})
    `;
}

function tenantVisibleUsernamesClause(columnExpr = 'CreatedBy') {
    return `${columnExpr} IN (${tenantVisibleUsernamesSql()})`;
}

/**
 * Returns a SQL fragment that checks whether the parent Request identified by
 * @paramName is visible to the caller (i.e. either created by or assigned to a
 * user the caller can see). Used by request-* child endpoints to gate access
 * to comments, attachments, notifications, and routing log entries.
 *
 * Use as: `WHERE EXISTS (${tenantRequestVisible('@requestId')})`
 */
function tenantRequestVisible(requestIdParam = '@requestId') {
    return `
        EXISTS (
            SELECT 1 FROM Requests r_v
            WHERE r_v.Id = ${requestIdParam}
              AND (
                EXISTS (SELECT 1 FROM Users WHERE Id = @${TENANT_PARAM} AND LOWER(Username) = 'admin')
                OR r_v.RequestedBy IN (${tenantVisibleUsernamesSql()})
                OR r_v.AssignedTo IN (${tenantVisibleUsernamesSql()})
              )
        )
    `;
}

/**
 * Builds a parameterized SQL fragment "ClinicId IN (@_tc0, @_tc1, ...)"
 * and binds values onto the provided sql.Request. Returns:
 *   - null if clinicIds is empty.
 *   - { sql: 'ClinicId IN (@_tc0,@_tc1)', paramNames: ['_tc0','_tc1'] } otherwise.
 *
 * Useful when the caller already has the clinicIds array in JS and wants to
 * avoid a second roundtrip to compute the subquery.
 */
function buildClinicInClause(request, clinicIds, columnExpr = 'ClinicId') {
    if (!Array.isArray(clinicIds) || clinicIds.length === 0) return null;
    const names = [];
    clinicIds.forEach((id, idx) => {
        const name = `_tc${idx}`;
        request.input(name, sql.Int, id);
        names.push('@' + name);
    });
    return {
        sql: `${columnExpr} IN (${names.join(',')})`,
        paramNames: names
    };
}

// The single platform-level admin (the SaaS owner) is identified by Username='admin'.
// Tenant admins (Role='admin' but bound to a Subscription) MUST NOT be platform admins.
async function isPlatformAdmin(pool, userId) {
    const id = _toIntOrNull(userId);
    if (!id) return false;
    try {
        const r = await pool.request()
            .input('id', sql.Int, id)
            .query("SELECT TOP 1 1 AS ok FROM Users WHERE Id = @id AND LOWER(Username) = 'admin'");
        return (r.recordset || []).length > 0;
    } catch (_) {
        return false;
    }
}

async function isPlatformAdminRequest(req, pool) {
    const uid = getRequestUserId(req);
    if (!uid) return false;
    const usePool = pool || (await getPool());
    return isPlatformAdmin(usePool, uid);
}

module.exports = {
    TENANT_PARAM,
    getRequestUserId,
    getUserClinicIds,
    getTenantContext,
    tenantClinicScopeSql,
    resolveVisibleClinicId,
    tenantSubscriptionScope,
    tenantVisibleUserIdsSql,
    tenantVisibleUserIdsClause,
    tenantVisibleUsernamesSql,
    tenantVisibleUsernamesClause,
    tenantRequestVisible,
    buildClinicInClause,
    isPlatformAdmin,
    isPlatformAdminRequest
};
