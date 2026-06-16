const { sql, getPool } = require('./database');

/**
 * Tenant scoping helpers.
 *
 * Multi-tenancy in Reform Dental is enforced at query-time using the user's
 * UserClinics membership. Every API endpoint that returns or mutates
 * tenant-scoped data should:
 *   1. Call getRequestUserId(req) to get the caller's UserId.
 *   2. Call getUserClinicIds(pool, userId) to get the list of ClinicIds they may see.
 *   3. Add WHERE ClinicId IN (...) (or join on UserClinics) to every SELECT.
 *   4. On INSERT, default the row's ClinicId to the user's primary clinic if not supplied.
 *
 * If a user has no clinics, they see an empty result set (NEVER all rows).
 * Super-admin / platform-owner accounts can be opted in via the IsPlatformAdmin
 * flag on Users, but until that exists every caller is tenant-scoped.
 */

function _toIntOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Pulls the caller's UserId from the request. Looks at (in order):
 *   - req.headers['x-user-id']
 *   - req.query.userId / req.query.actorUserId / req.query.UserId
 *   - req.body.userId / req.body.actorUserId / req.body.UserId
 * Returns null if none of those are present or numeric.
 */
function getRequestUserId(req) {
    if (!req) return null;
    const h = req.headers || {};
    const headerVal = h['x-user-id'] || h['X-User-Id'];
    const fromHeader = _toIntOrNull(headerVal);
    if (fromHeader) return fromHeader;
    const q = req.query || {};
    const fromQuery = _toIntOrNull(q.userId || q.actorUserId || q.UserId || q.ActorUserId);
    if (fromQuery) return fromQuery;
    const b = req.body || {};
    const fromBody = _toIntOrNull(b.userId || b.actorUserId || b.UserId || b.ActorUserId);
    return fromBody;
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
            .query(`SELECT uc.ClinicId
                      FROM UserClinics uc
                      INNER JOIN Clinics c ON c.Id = uc.ClinicId
                      WHERE uc.UserId = @userId AND c.IsActive = 1`);
        return (result.recordset || [])
            .map((r) => _toIntOrNull(r.ClinicId))
            .filter((n) => n !== null);
    } catch (err) {
        // If UserClinics is missing / unhealthy, fail closed (return empty).
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
 * Builds a parameterized SQL fragment "ClinicId IN (@_tc0, @_tc1, ...)"
 * and binds values onto the provided sql.Request. Returns:
 *   - null if clinicIds is empty (caller should short-circuit to []).
 *   - { sql: 'ClinicId IN (@_tc0,@_tc1)', paramNames: ['_tc0','_tc1'] } otherwise.
 *
 * @param {sql.Request} request - the mssql request to bind onto
 * @param {number[]} clinicIds
 * @param {string} columnExpr - e.g. 'ClinicId' or 't.ClinicId'
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
    getRequestUserId,
    getUserClinicIds,
    getTenantContext,
    buildClinicInClause
};
