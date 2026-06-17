const { sql, getPool, resetPool } = require('../shared/database');

const TRIAL_DAYS = 14;

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}
function hasColumn(columns, name) { return columns.has(String(name).toLowerCase()); }
function pickBody(body, ...keys) {
    for (const k of keys) if (body && Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined && body[k] !== null) return body[k];
    return undefined;
}
function nz(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
}
function toIntOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}
function isValidEmail(e) {
    if (!e) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e));
}

async function logEvent(pool, subscriptionId, eventType, actorUserId, payload) {
    try {
        const cols = await getTableColumns(pool, 'SubscriptionEvents');
        if (cols.size === 0) return;
        const r = pool.request()
            .input('subId', sql.Int, subscriptionId)
            .input('etype', sql.NVarChar(50), eventType);
        const colNames = ['SubscriptionId', 'EventType'];
        const valNames = ['@subId', '@etype'];
        if (hasColumn(cols, 'ActorUserId')) {
            r.input('actor', sql.Int, toIntOrNull(actorUserId));
            colNames.push('ActorUserId');
            valNames.push('@actor');
        }
        if (hasColumn(cols, 'Payload')) {
            r.input('payload', sql.NVarChar(sql.MAX), payload ? JSON.stringify(payload) : null);
            colNames.push('Payload');
            valNames.push('@payload');
        }
        await r.query(`INSERT INTO SubscriptionEvents (${colNames.join(', ')}) VALUES (${valNames.join(', ')})`);
    } catch (_) { /* non-fatal */ }
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };
    if (req.method === 'OPTIONS') { context.res = { status: 204, headers }; return; }
    if (req.method !== 'POST') { context.res = { status: 405, headers, body: { error: 'Method not allowed' } }; return; }

    const body = req.body || {};
    const companyName = nz(pickBody(body, 'companyName', 'CompanyName', 'clinicName'));
    const address     = nz(pickBody(body, 'address', 'Address'));
    const city        = nz(pickBody(body, 'city', 'City'));
    const state       = nz(pickBody(body, 'state', 'State'));
    const phone       = nz(pickBody(body, 'phone', 'Phone'));
    const ownerFirstName = nz(pickBody(body, 'ownerFirstName', 'firstName', 'FirstName'));
    const ownerLastName  = nz(pickBody(body, 'ownerLastName', 'lastName', 'LastName'));
    const email         = nz(pickBody(body, 'email', 'Email', 'workEmail', 'WorkEmail'));
    const password      = nz(pickBody(body, 'password', 'Password'));
    const planId        = toIntOrNull(pickBody(body, 'planId', 'PlanId'));
    const startTrial    = pickBody(body, 'startTrial') !== false; // default true
    const actorUserId   = toIntOrNull(pickBody(body, 'actorUserId', 'ActorUserId'));

    if (!companyName) { context.res = { status: 400, headers, body: { error: 'Company / clinic name is required.' } }; return; }
    if (!ownerFirstName || !ownerLastName) { context.res = { status: 400, headers, body: { error: 'Owner first and last name are required.' } }; return; }
    if (!email || !isValidEmail(email)) { context.res = { status: 400, headers, body: { error: 'A valid email is required.' } }; return; }
    if (!password || password.length < 6) { context.res = { status: 400, headers, body: { error: 'Password must be at least 6 characters.' } }; return; }
    if (!planId) { context.res = { status: 400, headers, body: { error: 'Plan selection is required.' } }; return; }

    let pool;
    let transaction = null;
    try {
        pool = await getPool();

        // Verify plan exists + active
        const planRes = await pool.request().input('id', sql.Int, planId)
            .query('SELECT TOP 1 Id, Name, IsActive, MaxClinics FROM SubscriptionPlans WHERE Id = @id');
        const plan = planRes.recordset[0];
        if (!plan) { context.res = { status: 400, headers, body: { error: 'Selected plan does not exist.' } }; return; }
        if (plan.IsActive !== true && plan.IsActive !== 1) {
            context.res = { status: 400, headers, body: { error: 'Selected plan is no longer available.' } }; return;
        }

        // Reject if username (email) already in use — case-insensitive check on Username AND WorkEmail
        const existingUser = await pool.request().input('uname', sql.NVarChar, email)
            .query('SELECT TOP 1 Id, Username FROM Users WHERE LOWER(Username) = LOWER(@uname) OR LOWER(ISNULL(WorkEmail, \'\')) = LOWER(@uname)');
        if (existingUser.recordset && existingUser.recordset.length > 0) {
            context.res = { status: 409, headers, body: {
                error: 'An account with this email already exists. Please sign in instead, or use a different email address.',
                code: 'duplicate_user'
            } };
            return;
        }

        const userColumns    = await getTableColumns(pool, 'Users');
        const clinicColumns  = await getTableColumns(pool, 'Clinics');
        const userClinicCols = await getTableColumns(pool, 'UserClinics');
        const subColumns     = await getTableColumns(pool, 'Subscriptions');

        // ===== TRANSACTION: Clinic + User + UserClinics + Subscription + SubscriptionClinics =====
        // If ANY core insert fails, rollback so no orphan clinic / user remains.
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        const tReq = () => new sql.Request(transaction);

        // 1) Create Clinic
        const clinicReq = tReq().input('name', sql.NVarChar, companyName);
        const clinicCols = ['Name'];
        const clinicVals = ['@name'];
        if (hasColumn(clinicColumns, 'Address')) { clinicReq.input('address', sql.NVarChar, address); clinicCols.push('Address'); clinicVals.push('@address'); }
        if (hasColumn(clinicColumns, 'City'))    { clinicReq.input('city',    sql.NVarChar, city);    clinicCols.push('City');    clinicVals.push('@city'); }
        if (hasColumn(clinicColumns, 'State'))   { clinicReq.input('state',   sql.NVarChar, state);   clinicCols.push('State');   clinicVals.push('@state'); }
        if (hasColumn(clinicColumns, 'Phone'))   { clinicReq.input('phone',   sql.NVarChar, phone);   clinicCols.push('Phone');   clinicVals.push('@phone'); }
        if (hasColumn(clinicColumns, 'Email'))   { clinicReq.input('cemail',  sql.NVarChar, email);   clinicCols.push('Email');   clinicVals.push('@cemail'); }
        if (hasColumn(clinicColumns, 'IsActive')) { clinicCols.push('IsActive'); clinicVals.push('1'); }
        const clinicInsert = await clinicReq.query(`INSERT INTO Clinics (${clinicCols.join(', ')}) OUTPUT INSERTED.Id VALUES (${clinicVals.join(', ')})`);
        const clinicId = clinicInsert.recordset[0].Id;

        // 2) Create User (role=admin — CK constraint compatible; treated same as owner by app permissions)
        const userReq = tReq()
            .input('username', sql.NVarChar, email)
            .input('passwordHash', sql.NVarChar, password)
            .input('firstName', sql.NVarChar, ownerFirstName)
            .input('lastName', sql.NVarChar, ownerLastName);
        const uCols = ['Username', 'PasswordHash', 'FirstName', 'LastName'];
        const uVals = ['@username', '@passwordHash', '@firstName', '@lastName'];
        if (hasColumn(userColumns, 'WorkEmail')) {
            userReq.input('workEmail', sql.NVarChar, email);
            uCols.push('WorkEmail'); uVals.push('@workEmail');
        }
        if (hasColumn(userColumns, 'Role')) {
            userReq.input('role', sql.NVarChar, 'admin');
            uCols.push('Role'); uVals.push('@role');
        }
        if (hasColumn(userColumns, 'IsActive')) { uCols.push('IsActive'); uVals.push('1'); }
        if (hasColumn(userColumns, 'CreatedDate')) { uCols.push('CreatedDate'); uVals.push('GETUTCDATE()'); }
        const userInsert = await userReq.query(`INSERT INTO Users (${uCols.join(', ')}) OUTPUT INSERTED.Id VALUES (${uVals.join(', ')})`);
        const userId = userInsert.recordset[0].Id;

        // 3) Link user <-> clinic (non-fatal — kept inside txn so it rolls back too)
        if (userClinicCols.size > 0 && hasColumn(userClinicCols, 'UserId') && hasColumn(userClinicCols, 'ClinicId')) {
            try {
                await tReq()
                    .input('userId', sql.Int, userId)
                    .input('clinicId', sql.Int, clinicId)
                    .query('INSERT INTO UserClinics (UserId, ClinicId) VALUES (@userId, @clinicId)');
            } catch (linkErr) { context.log.warn('UserClinics link failed (non-fatal):', linkErr.message); }
        }

        // 4) Create subscription (active with trial)
        const trialEndsAt = startTrial ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
        const status = startTrial ? 'active' : 'pending';
        const subReq = tReq()
            .input('owner', sql.Int, userId)
            .input('planId', sql.Int, planId)
            .input('status', sql.NVarChar(30), status);
        const sCols = ['OwnerUserId', 'PlanId', 'Status'];
        const sVals = ['@owner', '@planId', '@status'];
        if (hasColumn(subColumns, 'RequestedAt')) { sCols.push('RequestedAt'); sVals.push('GETUTCDATE()'); }
        if (status === 'active' && hasColumn(subColumns, 'ApprovedAt')) {
            sCols.push('ApprovedAt'); sVals.push('GETUTCDATE()');
        }
        if (hasColumn(subColumns, 'TrialEndsAt') && trialEndsAt) {
            subReq.input('trialEndsAt', sql.DateTime, trialEndsAt);
            sCols.push('TrialEndsAt'); sVals.push('@trialEndsAt');
        }
        const subInsert = await subReq.query(`INSERT INTO Subscriptions (${sCols.join(', ')}) OUTPUT INSERTED.Id VALUES (${sVals.join(', ')})`);
        const subscriptionId = subInsert.recordset[0].Id;

        // 5) Cover the new clinic under the subscription
        try {
            await tReq()
                .input('subId', sql.Int, subscriptionId)
                .input('clinicId', sql.Int, clinicId)
                .query('INSERT INTO SubscriptionClinics (SubscriptionId, ClinicId) VALUES (@subId, @clinicId)');
        } catch (covErr) { context.log.warn('SubscriptionClinics link failed (non-fatal):', covErr.message); }

        await transaction.commit();
        transaction = null;

        // 6) Audit (outside the txn — non-critical history)
        await logEvent(pool, subscriptionId, 'requested', actorUserId || userId, { planId, source: actorUserId ? 'admin' : 'public' });
        if (status === 'active') {
            await logEvent(pool, subscriptionId, 'approved', actorUserId || userId, { auto: true, trial: !!trialEndsAt });
            if (trialEndsAt) {
                await logEvent(pool, subscriptionId, 'trial_started', actorUserId || userId, { trialEndsAt: trialEndsAt.toISOString(), trialDays: TRIAL_DAYS });
            }
        }

        context.res = {
            status: 201,
            headers,
            body: {
                clinicId,
                userId,
                subscriptionId,
                planId,
                planName: plan.Name,
                status,
                trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
                trialDays: trialEndsAt ? TRIAL_DAYS : 0,
                username: email,
                message: trialEndsAt
                    ? `Welcome! Your ${TRIAL_DAYS}-day trial has started.`
                    : 'Signup submitted; awaiting admin approval.'
            }
        };
    } catch (err) {
        context.log.error('Signup error:', err);
        if (transaction) {
            try { await transaction.rollback(); } catch (rbErr) { context.log.warn('Rollback failed:', rbErr.message); }
        }
        await resetPool();
        const raw = String(err && (err.message || err) || '');
        let status = 500;
        let friendly = 'We could not complete your signup. Please try again.';
        let code = 'signup_failed';
        if (/UNIQUE KEY|duplicate key|Cannot insert duplicate/i.test(raw) && /Username|Users/i.test(raw)) {
            status = 409; code = 'duplicate_user';
            friendly = 'An account with this email already exists. Please sign in or use a different email.';
        } else if (/CHECK constraint/i.test(raw)) {
            status = 400; code = 'check_constraint';
            const m = raw.match(/column '([^']+)'/i);
            friendly = m ? `The value provided for ${m[1]} is not allowed by the database. Please contact support.` : 'One of the values you entered is not allowed. Please review and try again.';
        } else if (/FOREIGN KEY/i.test(raw)) {
            status = 400; code = 'foreign_key';
            friendly = 'A required reference is missing (likely the selected plan is no longer valid).';
        } else if (/Invalid object name|Invalid column name/i.test(raw)) {
            status = 500; code = 'schema_outdated';
            friendly = 'The database schema is out of date. An admin needs to run the latest subscriptions-setup.sql migration.';
        } else if (/Login failed|connection|ETIMEOUT|ECONNRESET/i.test(raw)) {
            status = 503; code = 'db_unavailable';
            friendly = 'The database is temporarily unavailable. Please try again in a moment.';
        }
        context.res = { status, headers, body: { error: friendly, code, detail: raw } };
    }
};
