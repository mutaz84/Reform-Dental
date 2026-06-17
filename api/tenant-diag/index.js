// Read-only platform-admin diagnostic endpoint. Dumps tenant-relevant tables
// so we can debug per-subscription scoping without guessing at the schema.
// GET /api/tenant-diag?userId=<targetUserId>   (X-User-Id MUST be the platform admin)
const { sql, getPool } = require('../shared/database');
const { getRequestUserId, isPlatformAdmin, tenantClinicScopeSql, tenantSubscriptionScope, tenantVisibleUserIdsClause, TENANT_PARAM } = require('../shared/tenant');

async function safe(pool, query, params) {
    try {
        const r = pool.request();
        if (params) Object.entries(params).forEach(([k, v]) => r.input(k, v));
        const result = await r.query(query);
        return result.recordset || [];
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
            SELECT Id, Name, SubscriptionId,
                   ISNULL(IsActive, 1) AS IsActive
            FROM Clinics ORDER BY Id`);

        // Migration sanity: counts of NULL SubscriptionId per table.
        out.MigrationStatus = await safe(pool, `
            SELECT 'Users' AS TableName,
                   (SELECT COUNT(*) FROM Users) AS Total,
                   (SELECT COUNT(*) FROM Users WHERE SubscriptionId IS NULL) AS NullCount
            UNION ALL SELECT 'Clinics',
                   (SELECT COUNT(*) FROM Clinics),
                   (SELECT COUNT(*) FROM Clinics WHERE SubscriptionId IS NULL)
            UNION ALL SELECT 'Equipment',
                   (SELECT COUNT(*) FROM Equipment),
                   0
            UNION ALL SELECT 'Tasks',
                   (SELECT COUNT(*) FROM Tasks WHERE 1=1),
                   (SELECT COUNT(*) FROM Tasks WHERE 1=1 AND ${"COALESCE(CAST(SubscriptionId AS NVARCHAR(50)),'X')='X'"})
            UNION ALL SELECT 'Vendors',
                   (SELECT COUNT(*) FROM Vendors),
                   (SELECT COUNT(*) FROM Vendors WHERE SubscriptionId IS NULL)
        `);

        // All users with their SubscriptionId — easy way to see if migration backfilled them.
        out.AllUsersBrief = await safe(pool, `
            SELECT Id, Username, FirstName, LastName, Role,
                   SubscriptionId, ISNULL(IsActive, 1) AS IsActive
            FROM Users ORDER BY Id`);

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

            // *** THE REAL TEST ***
            // Run the LIVE tenant filter (Phase 7+8 logic) as the target user
            // to confirm what they'd actually see when calling the API.
            const subWhere = tenantSubscriptionScope('SubscriptionId');
            const visUsers = tenantVisibleUserIdsClause('Id');

            out.LiveFilterAsTargetUser = {};

            // 1) Users.SubscriptionId for the target
            out.LiveFilterAsTargetUser.targetUserSubscriptionId = await safe(pool,
                `SELECT TOP 1 Id, Username, SubscriptionId FROM Users WHERE Id = @${TENANT_PARAM}`,
                { [TENANT_PARAM]: targetId });

            // 2) What Clinics filter resolves under the new logic
            out.LiveFilterAsTargetUser.visibleClinicsViaPhase7 = await safe(pool,
                `SELECT Id, Name, SubscriptionId FROM Clinics WHERE ${tenantClinicScopeSql('Id')}`,
                { [TENANT_PARAM]: targetId });

            // 3) Equipment count visible to target user (via Clinics chain)
            out.LiveFilterAsTargetUser.equipmentCountVisible = await safe(pool,
                `SELECT COUNT(*) AS visibleCount, (SELECT COUNT(*) FROM Equipment) AS totalCount
                 FROM Equipment WHERE ${tenantClinicScopeSql('ClinicId')}`,
                { [TENANT_PARAM]: targetId });

            // 4) Supplies
            out.LiveFilterAsTargetUser.suppliesCountVisible = await safe(pool,
                `SELECT COUNT(*) AS visibleCount, (SELECT COUNT(*) FROM Supplies) AS totalCount
                 FROM Supplies WHERE ${tenantClinicScopeSql('ClinicId')}`,
                { [TENANT_PARAM]: targetId });

            // 5) Tasks (uses direct SubscriptionId column)
            out.LiveFilterAsTargetUser.tasksCountVisible = await safe(pool,
                `SELECT COUNT(*) AS visibleCount, (SELECT COUNT(*) FROM Tasks) AS totalCount
                 FROM Tasks WHERE ${subWhere}`,
                { [TENANT_PARAM]: targetId });

            // 6) Users count visible
            out.LiveFilterAsTargetUser.usersCountVisible = await safe(pool,
                `SELECT COUNT(*) AS visibleCount, (SELECT COUNT(*) FROM Users) AS totalCount
                 FROM Users WHERE ${visUsers}`,
                { [TENANT_PARAM]: targetId });

            // 7) Vendors
            out.LiveFilterAsTargetUser.vendorsCountVisible = await safe(pool,
                `SELECT COUNT(*) AS visibleCount, (SELECT COUNT(*) FROM Vendors) AS totalCount
                 FROM Vendors WHERE ${subWhere}`,
                { [TENANT_PARAM]: targetId });
        }

        context.res = { status: 200, headers, body: out };
    } catch (err) {
        context.res = { status: 500, headers, body: { error: err.message, stack: err.stack } };
    }
};
