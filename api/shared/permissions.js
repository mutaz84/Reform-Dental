'use strict';

/**
 * Server-side permission checks. Mirrors the Manage Permissions catalog and role defaults in
 * the app (PERMISSION_CATEGORIES / getDefaultPermissions / normalizePermissionsForRole), so a
 * switch means the same thing in the browser and here. Keep the two in step.
 *
 * Saved permissions come from dbo.UserPermissions rows (preferred) or Users.Permissions JSON.
 * The platform admin (Username 'admin') is always allowed.
 */

const { sql, getPool } = require('./database');

const CATALOG = {
    clinics: ['view', 'view_identity_fields', 'create', 'edit', 'delete'],
    rooms: ['view', 'create', 'edit', 'delete'],
    users: ['view_all', 'create', 'edit', 'delete', 'manage_permissions'],
    schedules: ['view_all', 'create', 'edit', 'delete'],
    tasks: ['view_all', 'create', 'edit', 'delete', 'assign'],
    vendors: ['view', 'create', 'edit', 'delete'],
    password_manager: ['view', 'edit', 'export'],
    equipment: ['view', 'create', 'edit', 'delete'],
    instruments: ['view', 'create', 'edit', 'delete'],
    supplies: ['view', 'create', 'edit', 'delete'],
    utilities: ['view', 'create', 'edit', 'delete'],
    teams: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'export'],
    system: ['reset_data', 'manage_settings']
};

const ADMIN_ROLES = new Set(['admin', 'owner', 'administrator', 'superadmin', 'manager-admin', 'manageradmin']);

const OVERRIDES = {
    manager: {
        clinics: { create: 'full', edit: 'full', delete: 'full' },
        rooms: { create: 'full', edit: 'full', delete: 'full' },
        users: { create: 'full', edit: 'full', delete: 'full' },
        schedules: { view_all: 'full', create: 'full', edit: 'full', delete: 'full' },
        tasks: { view_all: 'full', create: 'full', edit: 'full', delete: 'full', assign: 'full' },
        password_manager: { edit: 'full', export: 'full' },
        reports: { view: 'full', export: 'full' },
        supplies: { create: 'full' }
    },
    user: {
        instruments: { view: 'readonly' },
        supplies: { view: 'readonly', create: 'full' },
        utilities: { view: 'readonly' },
        teams: { view: 'readonly' },
        vendors: { view: 'readonly' },
        tasks: { create: 'full', edit: 'full', delete: 'full', assign: 'full' }
    }
};

const TRUSTED_BEFORE_V2 = new Set([
    'clinics.view', 'clinics.view_identity_fields', 'rooms.view', 'users.view_all', 'users.manage_permissions',
    'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete', 'password_manager.view',
    'equipment.create', 'equipment.edit', 'equipment.delete', 'instruments.create', 'instruments.edit', 'instruments.delete',
    'supplies.edit', 'supplies.delete', 'system.reset_data'
]);

const LEVELS = new Set(['full', 'readonly', 'hidden']);

function normalizeRole(role) {
    const r = String(role || 'user').trim().toLowerCase();
    if (ADMIN_ROLES.has(r)) return 'admin';
    return r === 'manager' ? 'manager' : (r || 'user');
}

/** True for admin, owner, administrator and the other roles that get every permission. */
function isAdminRole(role) {
    return normalizeRole(role) === 'admin';
}

function defaultsFor(role) {
    const r = normalizeRole(role);
    const out = {};
    Object.keys(CATALOG).forEach((cat) => {
        out[cat] = {};
        CATALOG[cat].forEach((perm) => {
            let level;
            if (r === 'admin') level = 'full';
            else if (r === 'manager') {
                if (perm.includes('view')) level = 'full';
                else if (perm === 'delete' || perm === 'manage_permissions' || perm === 'reset_data' || perm === 'manage_settings') level = 'hidden';
                else level = 'readonly';
            } else {
                level = (cat === 'equipment' && perm === 'view') ? 'readonly' : 'hidden';
            }
            out[cat][perm] = level;
        });
    });
    const overrides = r === 'admin' ? null : OVERRIDES[r === 'manager' ? 'manager' : 'user'];
    if (overrides) {
        Object.keys(overrides).forEach((cat) => {
            Object.keys(overrides[cat]).forEach((perm) => {
                if (out[cat] && Object.prototype.hasOwnProperty.call(out[cat], perm)) out[cat][perm] = overrides[cat][perm];
            });
        });
    }
    return out;
}

function parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function normalize(saved, role) {
    const out = defaultsFor(role);
    const source = parseJson(saved) || {};
    const trustAll = !!(source.meta && String(source.meta.v2 || '').toLowerCase() === 'full');
    Object.keys(CATALOG).forEach((cat) => {
        const sc = source[cat];
        if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return;
        CATALOG[cat].forEach((perm) => {
            if (!trustAll && !TRUSTED_BEFORE_V2.has(`${cat}.${perm}`)) return;
            const v = String(sc[perm] || '').trim().toLowerCase();
            if (LEVELS.has(v)) out[cat][perm] = v;
        });
    });
    return out;
}

async function loadUser(pool, userId) {
    const id = Number(userId || 0);
    if (!(id > 0)) return null;
    let user = null;
    try {
        const r = await pool.request().input('userId', sql.Int, id)
            .query('SELECT TOP 1 Id, Username, Role, Permissions FROM Users WHERE Id = @userId');
        user = r.recordset && r.recordset[0];
    } catch (_) {
        // Older databases without a Permissions column.
        const r = await pool.request().input('userId', sql.Int, id)
            .query('SELECT TOP 1 Id, Username, Role FROM Users WHERE Id = @userId');
        user = r.recordset && r.recordset[0];
    }
    if (!user) return null;
    let saved = parseJson(user.Permissions);
    try {
        const rows = await pool.request().input('userId', sql.Int, id).query(`
            IF OBJECT_ID(N'dbo.UserPermissions', N'U') IS NOT NULL
                SELECT CategoryKey, PermissionKey, AccessLevel FROM dbo.UserPermissions WHERE UserId = @userId
            ELSE
                SELECT TOP 0 CAST(NULL AS NVARCHAR(100)) AS CategoryKey, CAST(NULL AS NVARCHAR(100)) AS PermissionKey, CAST(NULL AS NVARCHAR(20)) AS AccessLevel`);
        const list = (rows.recordset || []);
        if (list.length) {
            saved = {};
            list.forEach((row) => {
                const c = String(row.CategoryKey || '').trim();
                const p = String(row.PermissionKey || '').trim();
                if (!c || !p) return;
                if (!saved[c]) saved[c] = {};
                saved[c][p] = String(row.AccessLevel || '').trim().toLowerCase();
            });
        }
    } catch (_) { /* table missing or not readable: fall back to JSON */ }
    return {
        id,
        username: String(user.Username || '').trim().toLowerCase(),
        role: String(user.Role || 'user').trim().toLowerCase(),
        permissions: normalize(saved, user.Role)
    };
}

async function getCaller(pool, req) {
    if (req && req.__rdPermCaller !== undefined) return req.__rdPermCaller;
    const id = req && req.authUser && Number(req.authUser.id);
    const caller = id ? await loadUser(pool, id) : null;
    if (req) req.__rdPermCaller = caller;
    return caller;
}

function levelAllows(level, required) {
    return required === 'readonly' ? (level === 'full' || level === 'readonly') : level === 'full';
}

async function can(pool, req, category, permission, required = 'full') {
    const authUser = req && req.authUser;
    if (!authUser) return false;
    if (String(authUser.username || '').trim().toLowerCase() === 'admin') return true;
    const caller = await getCaller(pool, req);
    if (!caller) return false;
    if (caller.username === 'admin') return true;
    const level = caller.permissions[category] && caller.permissions[category][permission];
    return levelAllows(level || 'hidden', required);
}

const ACTION_WORDS = { create: 'add', edit: 'change', delete: 'delete', view: 'see', view_all: 'see', manage_permissions: 'manage permissions for', export: 'export' };

/** Sets a 403 response and returns false when the caller is missing the permission. */
async function requirePermission(context, pool, req, category, permission, headers, required = 'full') {
    if (await can(pool, req, category, permission, required)) return true;
    const word = ACTION_WORDS[permission] || permission;
    context.res = {
        status: 403,
        headers: headers || { 'Content-Type': 'application/json' },
        body: {
            error: `You don't have permission to ${word} ${category.replace('_', ' ')}. Ask an admin to change it in Manage Permissions.`,
            code: 'PERMISSION_DENIED',
            permission: `${category}.${permission}`
        }
    };
    return false;
}

/** Maps an HTTP method to the create / edit / delete switch. */
function permissionForMethod(method) {
    const m = String(method || '').toUpperCase();
    if (m === 'POST') return 'create';
    if (m === 'PUT' || m === 'PATCH') return 'edit';
    if (m === 'DELETE') return 'delete';
    return null;
}

/**
 * Wraps a v3 handler so the listed HTTP methods need a permission first.
 * rules: { POST: ['equipment', 'create'], DELETE: ['equipment', 'delete'] }
 * Use inside withAuth(): module.exports = withAuth(guardMethods(handler, rules[, { skip }])).
 */
function guardMethods(handler, rules, options = {}) {
    return async function permissionGuard(context, req) {
        const method = String((req && req.method) || '').toUpperCase();
        const rule = rules && rules[method];
        // options.skip(req) lets a handler pass a request through unchecked, e.g. when it only
        // forwards the call to another server that runs the same check itself.
        const skip = typeof options.skip === 'function' && options.skip(req);
        if (rule && method !== 'OPTIONS' && !skip) {
            const { CORS_HEADERS } = require('./auth');
            let pool;
            try {
                pool = await getPool();
            } catch (err) {
                context.res = { status: 503, headers: CORS_HEADERS, body: { error: 'Database unavailable. Try again shortly.' } };
                return;
            }
            if (!(await requirePermission(context, pool, req, rule[0], rule[1], CORS_HEADERS, rule[2] || 'full'))) return;
        }
        return handler(context, req);
    };
}

module.exports = {
    CATALOG,
    guardMethods,
    isAdminRole,
    defaultsFor,
    normalize,
    loadUser,
    can,
    requirePermission,
    permissionForMethod
};
