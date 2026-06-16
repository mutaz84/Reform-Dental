// Read-only platform-admin diagnostic endpoint. Dumps tenant-relevant tables
// so we can debug per-subscription scoping without guessing at the schema.
// GET /api/tenant-diag?userId=<targetUserId>   (X-User-Id MUST be the platform admin)
const { sql, getPool } = require('../shared/database');
const { getRequestUserId, isPlatformAdmin } = require('../shared/tenant');

async function safe(pool, query) {
    try {
        const r = await pool.request().query(query);
        return r.recordset || [];
    } catch (err) {
        return { error: err.message };
    }
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const callerUserId = getRequestUserId(req);
        const pool = await getPool();

        // Hard gate: only platform admin can read this.
        const isAdmin = await isPlatformAdmin(pool, callerUserId);
        if (!isAdmin) {
            context.res = { status: 403, headers, body: { error: 'Platform admin only.' } };
            return;
        }

        const targetIdRaw = (req.query && req.query.userId) ? String(req.query.userId).trim() : '';
        const targetId = /^\d+$/.test(targetIdRaw) ? parseInt(targetIdRaw, 10) : null;

        const out = {};

        // Schema discovery — what columns actually exist?
        out.UsersColumns = await safe(pool, `
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Users' ORDER BY ORDINAL_POSITION`);
        out.SubscriptionsColumns = await safe(pool, `
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Subscriptions' ORDER BY ORDINAL_POSITION`);
        out.ClinicsColumns = await safe(pool, `
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Clinics' ORDER BY ORDINAL_POSITION`);

        out.Subscriptions = await safe(pool, `SELECT * FROM Subscriptions`);
        out.SubscriptionClinics = await safe(pool, `SELECT * FROM SubscriptionClinics`);
        out.Clinics = await safe(pool, `
            SELECT Id, Name,
                   ISNULL(IsActive, 1) AS IsActive
                   ${'' /* SubscriptionId added later if column exists */}
            FROM Clinics ORDER BY Id`);

        // Per-user view if userId was provided.
        if (targetId) {
            out.target = { userId: targetId };

            out.targetUser = await safe(pool, `
                SELECT TOP 1 Id, Username, FirstName, LastName, Role,
                             ISNULL(IsActive, 1) AS IsActive
                FROM Users WHERE Id = ${targetId}`);

            out.targetSubscriptionsOwned = await safe(pool, `
                SELECT * FROM Subscriptions WHERE OwnerUserId = ${targetId}`);

            out.targetUserClinics = await safe(pool, `
                SELECT uc.UserId, uc.ClinicId, c.Name AS ClinicName
                FROM UserClinics uc
                LEFT JOIN Clinics c ON c.Id = uc.ClinicId
                WHERE uc.UserId = ${targetId}`);

            // What clinics the existing tenant filter would resolve for this user.
            out.targetVisibleClinicIds = await safe(pool, `
                SELECT DISTINCT cid AS ClinicId
                FROM (
                    SELECT ClinicId AS cid FROM UserClinics WHERE UserId = ${targetId}
                    UNION
                    SELECT sc.ClinicId AS cid
                        FROM SubscriptionClinics sc
                        INNER JOIN Subscriptions s ON s.Id = sc.SubscriptionId
                        WHERE s.OwnerUserId = ${targetId} AND s.IsActive = 1
                ) x`);
        }

        context.res = { status: 200, headers, body: out };
    } catch (err) {
        context.res = { status: 500, headers, body: { error: err.message, stack: err.stack } };
    }
};
