'use strict';

/**
 * Authentication for the ReformDental API.
 *
 * - Passwords are hashed with scrypt (Node's built-in crypto, no extra dependency).
 *   Stored format: scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>
 *   Older rows may still hold plain text or a bcrypt hash; verifyPassword accepts those
 *   and login upgrades them to scrypt on the next successful sign-in.
 * - After login the API issues a signed session token (HMAC-SHA256). The browser sends it
 *   in the X-Auth-Token header. withAuth() rejects any request without a valid token and
 *   overwrites X-User-Id with the token's user, so the caller can no longer pick a tenant.
 *
 * Secret: set AUTH_TOKEN_SECRET in the Static Web App's application settings. If it is not
 * set, a secret is derived from SQL_CONNECTION_STRING so logins keep working; setting a
 * dedicated value is still recommended (changing it signs everyone out).
 */

const crypto = require('crypto');

const TOKEN_HEADER = 'x-auth-token';
const TOKEN_TTL_SECONDS = 12 * 60 * 60; // one working day
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD_LENGTH = 6;

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Auth-Token'
};

let cachedSecret = null;

function getTokenSecret() {
    if (cachedSecret) return cachedSecret;
    const explicit = String(process.env.AUTH_TOKEN_SECRET || '').trim();
    if (explicit) {
        cachedSecret = Buffer.from(explicit, 'utf8');
        return cachedSecret;
    }
    const conn = String(process.env.SQL_CONNECTION_STRING || '').trim();
    if (conn) {
        cachedSecret = crypto.createHmac('sha256', conn).update('reformdental-auth-token-v1').digest();
        return cachedSecret;
    }
    throw new Error('AUTH_TOKEN_SECRET is not configured');
}

function b64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(s + '='.repeat((4 - (s.length % 4)) % 4), 'base64');
}

function sign(data) {
    return b64url(crypto.createHmac('sha256', getTokenSecret()).update(data).digest());
}

function issueToken(user) {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
        uid: Number(user.Id ?? user.id),
        usr: String(user.Username ?? user.username ?? ''),
        role: String(user.Role ?? user.role ?? 'user').toLowerCase(),
        iat: now,
        exp: now + TOKEN_TTL_SECONDS
    };
    const body = b64url(JSON.stringify(claims));
    return { token: `${body}.${sign(body)}`, expiresAt: new Date(claims.exp * 1000).toISOString() };
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    let expected;
    try { expected = sign(body); } catch (_) { return null; }
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let claims;
    try { claims = JSON.parse(fromB64url(body).toString('utf8')); } catch (_) { return null; }
    if (!claims || !Number.isInteger(claims.uid) || claims.uid <= 0) return null;
    if (!claims.exp || Math.floor(Date.now() / 1000) >= claims.exp) return null;
    return claims;
}

function readHeader(req, name) {
    const headers = req && req.headers;
    if (!headers) return undefined;
    if (typeof headers.get === 'function') return headers.get(name) || undefined;
    const lower = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function getTokenFromRequest(req) {
    const direct = readHeader(req, TOKEN_HEADER);
    if (direct) return String(direct).trim();
    const authz = readHeader(req, 'authorization');
    const match = authz && /^Bearer\s+(.+)$/i.exec(String(authz));
    return match ? match[1].trim() : null;
}

// ---- Passwords -------------------------------------------------------------

function isHashed(stored) {
    const s = String(stored || '');
    return s.startsWith('scrypt$') || /^\$2[aby]\$\d{2}\$/.test(s);
}

function hashPassword(plain) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function safeEqualStrings(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/** Returns { ok, needsUpgrade }. needsUpgrade is true when the stored value is not scrypt. */
function verifyPassword(plain, stored) {
    const s = String(stored || '');
    if (!s || plain == null || plain === '') return { ok: false, needsUpgrade: false };

    if (s.startsWith('scrypt$')) {
        const parts = s.split('$');
        if (parts.length !== 6) return { ok: false, needsUpgrade: false };
        const [, n, r, p, saltB64, hashB64] = parts;
        const expected = Buffer.from(hashB64, 'base64');
        const actual = crypto.scryptSync(String(plain), Buffer.from(saltB64, 'base64'), expected.length, {
            N: Number(n), r: Number(r), p: Number(p)
        });
        return { ok: actual.length === expected.length && crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
    }

    if (/^\$2[aby]\$\d{2}\$/.test(s)) {
        try {
            const bcrypt = require('bcryptjs');
            return { ok: bcrypt.compareSync(String(plain), s), needsUpgrade: true };
        } catch (_) {
            return { ok: false, needsUpgrade: false };
        }
    }

    // Legacy plain-text value.
    return { ok: safeEqualStrings(plain, s), needsUpgrade: true };
}

function validateNewPassword(plain) {
    const s = String(plain == null ? '' : plain);
    if (s.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (s.length > 200) return 'Password is too long.';
    return null;
}

// ---- Request guard ---------------------------------------------------------

function setTrustedUserHeader(req, uid) {
    const headers = req.headers;
    if (!headers) return;
    if (typeof headers.set === 'function') {
        headers.set('x-user-id', String(uid));
        return;
    }
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'x-user-id') delete headers[key];
    }
    headers['x-user-id'] = String(uid);
}

/**
 * Wrap an Azure Functions (v3) handler so it requires a valid session token.
 * options.publicMethods: HTTP methods that stay open (e.g. ['GET'] for public plan lists).
 * options.public: true leaves the whole function open (login, signup).
 */
function withAuth(handler, options = {}) {
    const publicAll = options.public === true;
    const publicMethods = (options.publicMethods || []).map((m) => String(m).toUpperCase());

    return async function authGuard(context, req) {
        const method = String((req && req.method) || '').toUpperCase();
        if (method === 'OPTIONS' || publicAll || publicMethods.includes(method)) {
            return handler(context, req);
        }

        const claims = verifyToken(getTokenFromRequest(req));
        if (!claims) {
            context.res = {
                status: 401,
                headers: CORS_HEADERS,
                body: { error: 'Authentication required. Please sign in again.', code: 'AUTH_REQUIRED' }
            };
            return;
        }

        req.authUser = { id: claims.uid, username: claims.usr, role: claims.role };
        setTrustedUserHeader(req, claims.uid);
        return handler(context, req);
    };
}

function isAdminOrManager(authUser) {
    const role = String(authUser && authUser.role || '').toLowerCase();
    return role === 'admin' || role === 'manager';
}

module.exports = {
    TOKEN_HEADER,
    CORS_HEADERS,
    issueToken,
    verifyToken,
    getTokenFromRequest,
    hashPassword,
    verifyPassword,
    isHashed,
    validateNewPassword,
    withAuth,
    isAdminOrManager,
    MIN_PASSWORD_LENGTH
};
