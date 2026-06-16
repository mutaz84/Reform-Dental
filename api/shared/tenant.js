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
                SELECT DISTINCT clinics_for_user.ClinicId
                FROM (
                    SELECT uc.ClinicId
                        FROM UserClinics uc
                        WHERE uc.UserId = @userId
                    UNION
                    SELECT sc.ClinicId
                        FROM SubscriptionClinics sc
                        INNER JOIN Subscriptions s ON s.Id = sc.SubscriptionId
                        WHERE s.OwnerUserId = @userId AND s.IsActive = 1
                ) AS clinics_for_user
                INNER JOIN Clinics c ON c.Id = clinics_for_user.ClinicId
                WHERE c.IsActive = 1`);
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
    // A user can reach a clinic two ways:
    //   1. Explicit per-user assignment in UserClinics (sub-users).
    //   2. They OWN a Subscription whose SubscriptionClinics include the clinic
    //      (subscription owner / "house" admin who paid for it).
    // Both branches use the same @_tenantUserId binding.
    return `${columnExpr} IN (
        SELECT ClinicId FROM UserClinics WHERE UserId = @${TENANT_PARAM}
        UNION
        SELECT sc.ClinicId
            FROM SubscriptionClinics sc
            INNER JOIN Subscriptions s ON s.Id = sc.SubscriptionId
            WHERE s.OwnerUserId = @${TENANT_PARAM} AND s.IsActive = 1
    )`;
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

module.exports = {
    TENANT_PARAM,
    getRequestUserId,
    getUserClinicIds,
    getTenantContext,
    tenantClinicScopeSql,
    buildClinicInClause
};
