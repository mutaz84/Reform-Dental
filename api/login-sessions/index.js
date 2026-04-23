const { execute } = require('../shared/database');
const { successResponse, errorResponse, handleOptions } = require('../shared/response');

const ONLINE_WINDOW_MINUTES = 10;
const MAX_HISTORY_LIMIT = 500;
const DEFAULT_HISTORY_LIMIT = 120;

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function toNullableInt(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number.parseInt(String(value), 10);
    return Number.isInteger(n) ? n : null;
}

function toSafeString(value, maxLen = 200) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
}

function toHistoryLimit(raw) {
    const n = Number.parseInt(String(raw || ''), 10);
    if (!Number.isInteger(n) || n <= 0) return DEFAULT_HISTORY_LIMIT;
    return Math.min(n, MAX_HISTORY_LIMIT);
}

async function getLoginTableAvailability() {
    const result = await execute(
        `SELECT
            CASE WHEN OBJECT_ID('dbo.UserLoginSessions', 'U') IS NOT NULL THEN 1 ELSE 0 END AS HasSessions,
            CASE WHEN OBJECT_ID('dbo.UserLoginAudit', 'U') IS NOT NULL THEN 1 ELSE 0 END AS HasAudit`
    );

    const row = (result.recordset || [])[0] || {};
    return {
        hasSessions: Number(row.HasSessions) === 1,
        hasAudit: Number(row.HasAudit) === 1
    };
}

function buildMissingTablesError(tables = {}) {
    const missing = [];
    if (!tables.hasSessions) missing.push('UserLoginSessions');
    if (!tables.hasAudit) missing.push('UserLoginAudit');
    return {
        error: `Login session tables are not configured: ${missing.join(', ')}`,
        details: 'Run database/login-audit-sessions.sql in the active SQL database.'
    };
}

async function writeAuditEvent(payload = {}) {
    const username = normalizeUsername(payload.username || payload.usernameRaw);
    if (!username) return;

    await execute(
        `INSERT INTO UserLoginAudit (
            SessionId, UserId, Username, DisplayName, UserRole,
            EventType, EventSource, EventAt, ForcedBy, Note
        )
        VALUES (
            @sessionId, @userId, @username, @displayName, @userRole,
            @eventType, @eventSource, SYSUTCDATETIME(), @forcedBy, @note
        )`,
        {
            sessionId: toSafeString(payload.sessionId, 120),
            userId: toNullableInt(payload.userId),
            username,
            displayName: toSafeString(payload.displayName || payload.name, 200),
            userRole: toSafeString(payload.userRole || payload.role, 60),
            eventType: toSafeString(payload.eventType, 80) || 'unknown',
            eventSource: toSafeString(payload.eventSource || payload.source, 60),
            forcedBy: toSafeString(payload.forcedBy, 120),
            note: toSafeString(payload.note, 400)
        }
    );
}

async function getSnapshot(params = {}, tables = { hasSessions: true, hasAudit: true }) {
    const historyLimit = toHistoryLimit(params.historyLimit);
    const sessionId = toSafeString(params.sessionId, 120);

    const onlineResult = tables.hasSessions
        ? await execute(
            `SELECT
                SessionId,
                Username,
                DisplayName,
                UserRole,
                LoginAt,
                LastSeenAt,
                ForcedLogoutAt,
                ForcedBy
            FROM UserLoginSessions
            WHERE IsActive = 1
              AND LastSeenAt >= DATEADD(MINUTE, -@onlineWindowMin, SYSUTCDATETIME())
            ORDER BY LastSeenAt DESC`,
            {
                onlineWindowMin: ONLINE_WINDOW_MINUTES
            }
        )
        : { recordset: [] };

    const historyResult = tables.hasAudit
        ? await execute(
            `SELECT TOP (@historyLimit)
                SessionId,
                Username,
                DisplayName,
                UserRole,
                EventType,
                EventSource,
                EventAt,
                ForcedBy,
                Note
            FROM UserLoginAudit
            ORDER BY EventAt DESC`,
            {
                historyLimit
            }
        )
        : { recordset: [] };

    let shouldForceLogout = false;
    let forcedBy = null;

    if (sessionId && tables.hasSessions) {
        const forceResult = await execute(
            `SELECT TOP 1 ForcedLogoutAt, ForcedBy, LogoutReason, IsActive
             FROM UserLoginSessions
             WHERE SessionId = @sessionId`,
            { sessionId }
        );

        const forceRow = (forceResult.recordset || [])[0];
        if (forceRow) {
            const reason = String(forceRow.LogoutReason || '').trim().toLowerCase();
            shouldForceLogout = !!forceRow.ForcedLogoutAt || (forceRow.IsActive === false && reason === 'forced_logout');
            forcedBy = forceRow.ForcedBy || null;
        }
    }

    return {
        onlineUsers: onlineResult.recordset || [],
        history: historyResult.recordset || [],
        shouldForceLogout,
        forcedBy,
        apiDegraded: !(tables.hasSessions && tables.hasAudit)
    };
}

async function upsertSession(body = {}) {
    const sessionId = toSafeString(body.sessionId, 120);
    const username = normalizeUsername(body.username || body.usernameRaw);

    if (!sessionId || !username) {
        return {
            status: 400,
            body: { error: 'sessionId and username are required.' }
        };
    }

    const existingResult = await execute(
        `SELECT TOP 1
            SessionId,
            UserId,
            Username,
            DisplayName,
            UserRole,
            IsActive,
            ForcedLogoutAt,
            ForcedBy,
            LogoutReason
        FROM UserLoginSessions
        WHERE SessionId = @sessionId`,
        { sessionId }
    );

    const existing = (existingResult.recordset || [])[0] || null;
    if (existing && existing.ForcedLogoutAt) {
        return {
            status: 200,
            body: {
                success: true,
                shouldForceLogout: true,
                forcedBy: existing.ForcedBy || null
            }
        };
    }

    const payload = {
        sessionId,
        userId: toNullableInt(body.userId),
        username,
        displayName: toSafeString(body.displayName || body.name, 200),
        userRole: toSafeString(body.userRole || body.role, 60),
        source: toSafeString(body.source, 60)
    };

    if (!existing) {
        await execute(
            `INSERT INTO UserLoginSessions (
                SessionId, UserId, Username, DisplayName, UserRole, Source,
                LoginAt, LastSeenAt, IsActive, CreatedDate, ModifiedDate
            )
            VALUES (
                @sessionId, @userId, @username, @displayName, @userRole, @source,
                SYSUTCDATETIME(), SYSUTCDATETIME(), 1, SYSUTCDATETIME(), SYSUTCDATETIME()
            )`,
            payload
        );

        await writeAuditEvent({
            ...payload,
            eventType: 'login',
            eventSource: payload.source || 'login-sessions-api'
        });

        return {
            status: 200,
            body: { success: true, shouldForceLogout: false, created: true }
        };
    }

    const wasInactive = existing.IsActive === false;

    await execute(
        `UPDATE UserLoginSessions
         SET UserId = COALESCE(@userId, UserId),
             Username = @username,
             DisplayName = COALESCE(@displayName, DisplayName),
             UserRole = COALESCE(@userRole, UserRole),
             Source = COALESCE(@source, Source),
             LastSeenAt = SYSUTCDATETIME(),
             IsActive = 1,
             ModifiedDate = SYSUTCDATETIME(),
             LogoutAt = NULL,
             LogoutReason = NULL,
             ForcedLogoutAt = NULL,
             ForcedBy = NULL
         WHERE SessionId = @sessionId`,
        payload
    );

    if (wasInactive) {
        await writeAuditEvent({
            ...payload,
            eventType: 'login',
            eventSource: payload.source || 'login-sessions-api',
            note: 'session reactivated'
        });
    }

    return {
        status: 200,
        body: { success: true, shouldForceLogout: false, created: false }
    };
}

async function logoutSession(body = {}) {
    const sessionId = toSafeString(body.sessionId, 120);
    const username = normalizeUsername(body.username || body.usernameRaw);
    const reason = toSafeString(body.reason, 80) || 'logout';

    if (!sessionId && !username) {
        return {
            status: 400,
            body: { error: 'sessionId or username is required.' }
        };
    }

    const rowsResult = await execute(
        `SELECT SessionId, UserId, Username, DisplayName, UserRole, IsActive
         FROM UserLoginSessions
         WHERE (@sessionId IS NOT NULL AND SessionId = @sessionId)
            OR (@sessionId IS NULL AND Username = @username AND IsActive = 1)`,
        {
            sessionId,
            username
        }
    );

    const rows = rowsResult.recordset || [];
    if (!rows.length) {
        return {
            status: 200,
            body: { success: true, updated: 0 }
        };
    }

    await execute(
        `UPDATE UserLoginSessions
         SET IsActive = 0,
             LastSeenAt = SYSUTCDATETIME(),
             LogoutAt = SYSUTCDATETIME(),
             LogoutReason = @reason,
             ModifiedDate = SYSUTCDATETIME()
         WHERE (@sessionId IS NOT NULL AND SessionId = @sessionId)
            OR (@sessionId IS NULL AND Username = @username AND IsActive = 1)`,
        {
            sessionId,
            username,
            reason
        }
    );

    for (const row of rows) {
        if (row.IsActive === false) continue;
        await writeAuditEvent({
            sessionId: row.SessionId,
            userId: row.UserId,
            username: row.Username,
            displayName: row.DisplayName,
            userRole: row.UserRole,
            eventType: reason,
            eventSource: toSafeString(body.source, 60) || 'login-sessions-api'
        });
    }

    return {
        status: 200,
        body: { success: true, updated: rows.length }
    };
}

async function forceLogoutUser(body = {}) {
    const username = normalizeUsername(body.username || body.usernameRaw);
    const forcedBy = toSafeString(body.forcedBy, 120) || 'admin';

    if (!username) {
        return {
            status: 400,
            body: { error: 'username is required.' }
        };
    }

    const activeResult = await execute(
        `SELECT SessionId, UserId, Username, DisplayName, UserRole
         FROM UserLoginSessions
         WHERE Username = @username AND IsActive = 1`,
        { username }
    );

    const sessions = activeResult.recordset || [];

    await execute(
        `UPDATE UserLoginSessions
         SET IsActive = 0,
             LastSeenAt = SYSUTCDATETIME(),
             LogoutAt = SYSUTCDATETIME(),
             LogoutReason = 'forced_logout',
             ForcedLogoutAt = SYSUTCDATETIME(),
             ForcedBy = @forcedBy,
             ModifiedDate = SYSUTCDATETIME()
         WHERE Username = @username`,
        {
            username,
            forcedBy
        }
    );

    for (const row of sessions) {
        await writeAuditEvent({
            sessionId: row.SessionId,
            userId: row.UserId,
            username: row.Username,
            displayName: row.DisplayName,
            userRole: row.UserRole,
            eventType: 'forced_logout',
            eventSource: 'login-sessions-api',
            forcedBy
        });
    }

    if (!sessions.length) {
        await writeAuditEvent({
            sessionId: null,
            userId: null,
            username,
            displayName: toSafeString(body.displayName, 200) || username,
            userRole: null,
            eventType: 'forced_logout',
            eventSource: 'login-sessions-api',
            forcedBy,
            note: 'no active session at force time'
        });
    }

    return {
        status: 200,
        body: {
            success: true,
            forcedCount: sessions.length,
            username,
            forcedBy
        }
    };
}

async function forceLogoutSession(body = {}) {
    const sessionId = toSafeString(body.sessionId, 120);
    const forcedBy = toSafeString(body.forcedBy, 120) || 'admin';

    if (!sessionId) {
        return {
            status: 400,
            body: { error: 'sessionId is required.' }
        };
    }

    const sessionResult = await execute(
        `SELECT TOP 1 SessionId, UserId, Username, DisplayName, UserRole, IsActive
         FROM UserLoginSessions
         WHERE SessionId = @sessionId`,
        { sessionId }
    );

    const session = (sessionResult.recordset || [])[0] || null;
    if (!session) {
        return {
            status: 404,
            body: { error: 'Session not found.' }
        };
    }

    await execute(
        `UPDATE UserLoginSessions
         SET IsActive = 0,
             LastSeenAt = SYSUTCDATETIME(),
             LogoutAt = SYSUTCDATETIME(),
             LogoutReason = 'forced_logout',
             ForcedLogoutAt = SYSUTCDATETIME(),
             ForcedBy = @forcedBy,
             ModifiedDate = SYSUTCDATETIME()
         WHERE SessionId = @sessionId`,
        {
            sessionId,
            forcedBy
        }
    );

    await writeAuditEvent({
        sessionId: session.SessionId,
        userId: session.UserId,
        username: session.Username,
        displayName: session.DisplayName,
        userRole: session.UserRole,
        eventType: 'forced_logout',
        eventSource: 'login-sessions-api',
        forcedBy,
        note: session.IsActive === false ? 'session already inactive before force' : null
    });

    return {
        status: 200,
        body: {
            success: true,
            forcedCount: session.IsActive === false ? 0 : 1,
            sessionId: session.SessionId,
            username: session.Username,
            forcedBy
        }
    };
}

async function clearHistory() {
    await execute('DELETE FROM UserLoginAudit');
    return {
        status: 200,
        body: { success: true, message: 'Login audit history cleared.' }
    };
}

module.exports = async function (context, req) {
    try {
        if (req.method === 'OPTIONS') {
            context.res = handleOptions();
            return;
        }

        const tables = await getLoginTableAvailability();

        if (req.method === 'GET') {
            const snapshot = await getSnapshot(req.query || {}, tables);
            context.res = successResponse(snapshot, 200);
            return;
        }

        if (req.method === 'DELETE') {
            const clear = String((req.query || {}).scope || '').trim().toLowerCase();
            if (clear === 'history') {
                const result = await clearHistory();
                context.res = successResponse(result.body, result.status);
                return;
            }
            context.res = errorResponse('Unsupported delete scope.', 400);
            return;
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const action = String(body.action || 'upsertSession').trim();

            if (!tables.hasSessions || !tables.hasAudit) {
                const missing = buildMissingTablesError(tables);
                context.res = errorResponse(missing.error, 503, missing.details);
                return;
            }

            let result;
            if (action === 'upsertSession' || action === 'heartbeat') {
                result = await upsertSession(body);
            } else if (action === 'logoutSession' || action === 'logout') {
                result = await logoutSession(body);
            } else if (action === 'forceLogoutSession') {
                result = await forceLogoutSession(body);
            } else if (action === 'forceLogoutUser') {
                result = await forceLogoutUser(body);
            } else if (action === 'clearHistory') {
                result = await clearHistory();
            } else {
                result = {
                    status: 400,
                    body: { error: `Unsupported action: ${action}` }
                };
            }

            if (result.status >= 400) {
                context.res = errorResponse(result.body.error || 'Action failed.', result.status, result.body.details || null);
                return;
            }

            context.res = successResponse(result.body, result.status);
            return;
        }

        context.res = errorResponse('Method not allowed.', 405);
    } catch (error) {
        context.log.error('login-sessions error:', error);
        context.res = errorResponse('Server error', 500, error.message);
    }
};
