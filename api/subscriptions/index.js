const { sql, getPool, resetPool } = require('../shared/database');
const { isPlatformAdmin, getRequestUserId } = require('../shared/tenant');

const VALID_STATUSES = ['pending', 'active', 'cancellation_requested', 'cancelled', 'rejected', 'paused'];

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}
function hasColumn(columns, name) { return columns.has(String(name).toLowerCase()); }
function getBodyValue(body, ...keys) {
    for (const key of keys) if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) return body[key];
    return undefined;
}
function toIntOrNull(v) { if (v === null || v === undefined || v === '') return null; const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
function nowDate() { return new Date(); }

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
    } catch (e) { /* non-fatal */ }
}

async function fetchSubscriptionFull(pool, id) {
    const subRes = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            SELECT s.*, p.Name AS PlanName, p.Price AS PlanPrice, p.BillingCycle AS PlanBillingCycle,
                   p.MaxClinics AS PlanMaxClinics, p.MaxUsers AS PlanMaxUsers,
                   u.FirstName AS OwnerFirstName, u.LastName AS OwnerLastName,
                   ISNULL(u.PersonalEmail, u.WorkEmail) AS OwnerEmail
            FROM Subscriptions s
            LEFT JOIN SubscriptionPlans p ON p.Id = s.PlanId
            LEFT JOIN Users u ON u.Id = s.OwnerUserId
            WHERE s.Id = @id`);
    const sub = subRes.recordset[0];
    if (!sub) return null;
    let clinics = [];
    let events = [];
    try {
        const clinicsRes = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT sc.Id, sc.ClinicId, sc.AddedAt, c.Name AS ClinicName
                FROM SubscriptionClinics sc
                LEFT JOIN Clinics c ON c.Id = sc.ClinicId
                WHERE sc.SubscriptionId = @id
                ORDER BY sc.AddedAt ASC`);
        clinics = clinicsRes.recordset || [];
    } catch (_) {}
    try {
        const evRes = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT TOP 50 e.Id, e.EventType, e.ActorUserId, e.Payload, e.CreatedDate,
                       u.FirstName AS ActorFirstName, u.LastName AS ActorLastName
                FROM SubscriptionEvents e
                LEFT JOIN Users u ON u.Id = e.ActorUserId
                WHERE e.SubscriptionId = @id
                ORDER BY e.CreatedDate DESC`);
        events = evRes.recordset || [];
    } catch (_) {}
    sub.Clinics = clinics;
    sub.Events = events;
    return sub;
}

async function listSubscriptions(pool, { status, ownerUserId } = {}) {
    const r = pool.request();
    const whereParts = [];
    if (status) { r.input('status', sql.NVarChar(30), status); whereParts.push('s.Status = @status'); }
    if (ownerUserId !== undefined && ownerUserId !== null && ownerUserId !== '') {
        r.input('owner', sql.Int, toIntOrNull(ownerUserId));
        whereParts.push('s.OwnerUserId = @owner');
    }
    const whereClause = whereParts.length ? ('WHERE ' + whereParts.join(' AND ')) : '';
    const result = await r.query(`
        SELECT s.*, p.Name AS PlanName, p.Price AS PlanPrice, p.BillingCycle AS PlanBillingCycle,
               p.MaxClinics AS PlanMaxClinics, p.MaxUsers AS PlanMaxUsers,
               u.FirstName AS OwnerFirstName, u.LastName AS OwnerLastName,
               ISNULL(u.PersonalEmail, u.WorkEmail) AS OwnerEmail,
               (SELECT COUNT(*) FROM SubscriptionClinics sc WHERE sc.SubscriptionId = s.Id) AS ClinicCount
        FROM Subscriptions s
        LEFT JOIN SubscriptionPlans p ON p.Id = s.PlanId
        LEFT JOIN Users u ON u.Id = s.OwnerUserId
        ${whereClause}
        ORDER BY s.RequestedAt DESC, s.Id DESC`);
    return result.recordset || [];
}

async function getPlanLimits(pool, planId) {
    const r = await pool.request().input('id', sql.Int, planId)
        .query('SELECT TOP 1 Id, Name, MaxClinics, MaxUsers, IsActive FROM SubscriptionPlans WHERE Id = @id');
    return r.recordset[0] || null;
}

async function countSubscriptionClinics(pool, subscriptionId) {
    const r = await pool.request().input('id', sql.Int, subscriptionId)
        .query('SELECT COUNT(*) AS C FROM SubscriptionClinics WHERE SubscriptionId = @id');
    return r.recordset[0] ? r.recordset[0].C : 0;
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
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (req.method === 'OPTIONS') { context.res = { status: 204, headers }; return; }

    try {
        const pool = await getPool();
        const subColumns = await getTableColumns(pool, 'Subscriptions');
        if (subColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Subscriptions table not found. Run database/subscriptions-setup.sql in Azure SQL.' } };
            return;
        }

        const id = toIntOrNull(req.params.id);
        const action = req.params.action ? String(req.params.action).toLowerCase() : null;
        const subId = req.params.subId ? String(req.params.subId) : null;
        const body = req.body || {};
        const actorUserId = toIntOrNull(getBodyValue(body, 'actorUserId', 'ActorUserId'));

        // ---- Authorization context ----
        // Caller is identified by X-User-Id header (injected on every API request by the frontend).
        // Platform admin (Username='admin') can manage every subscription. Tenant admins
        // (Role='admin' on a Subscription) can only see/act on subscriptions they OWN.
        const callerUserId = getRequestUserId(req);
        const callerIsPlatformAdmin = await isPlatformAdmin(pool, callerUserId);

        async function loadOwnerOf(subId) {
            if (!subId) return null;
            try {
                const r = await pool.request().input('id', sql.Int, subId)
                    .query('SELECT TOP 1 OwnerUserId FROM Subscriptions WHERE Id=@id');
                return r.recordset[0] ? toIntOrNull(r.recordset[0].OwnerUserId) : null;
            } catch (_) { return null; }
        }

        // ---- GET ----
        if (req.method === 'GET') {
            if (id && !action) {
                // Single subscription: platform admin OR the subscription's owner.
                if (!callerIsPlatformAdmin) {
                    const ownerId = await loadOwnerOf(id);
                    if (!callerUserId || ownerId !== callerUserId) {
                        context.res = { status: 403, headers, body: { error: 'Forbidden' } };
                        return;
                    }
                }
                const sub = await fetchSubscriptionFull(pool, id);
                context.res = { status: 200, headers, body: sub };
                return;
            }
            if (id && action === 'events') {
                if (!callerIsPlatformAdmin) {
                    const ownerId = await loadOwnerOf(id);
                    if (!callerUserId || ownerId !== callerUserId) {
                        context.res = { status: 403, headers, body: { error: 'Forbidden' } };
                        return;
                    }
                }
                try {
                    const r = await pool.request().input('id', sql.Int, id).query(`
                        SELECT TOP 100 e.Id, e.EventType, e.ActorUserId, e.Payload, e.CreatedDate,
                               u.FirstName AS ActorFirstName, u.LastName AS ActorLastName
                        FROM SubscriptionEvents e LEFT JOIN Users u ON u.Id = e.ActorUserId
                        WHERE e.SubscriptionId = @id ORDER BY e.CreatedDate DESC`);
                    context.res = { status: 200, headers, body: r.recordset };
                } catch (_) { context.res = { status: 200, headers, body: [] }; }
                return;
            }
            // List: platform admin sees ALL; tenant users only see their own (forced filter).
            const requestedOwnerRaw = req.query && req.query.ownerUserId !== undefined ? req.query.ownerUserId : undefined;
            const requestedOwner = toIntOrNull(requestedOwnerRaw);
            let listOwnerUserId = requestedOwner;
            if (!callerIsPlatformAdmin) {
                if (!callerUserId) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                // Force the filter to the caller — they cannot enumerate other people's subs.
                listOwnerUserId = callerUserId;
            }
            const list = await listSubscriptions(pool, {
                status: req.query && req.query.status ? String(req.query.status) : undefined,
                ownerUserId: listOwnerUserId === null ? undefined : listOwnerUserId
            });
            context.res = { status: 200, headers, body: list };
            return;
        }

        // ---- POST (create or sub-action) ----
        if (req.method === 'POST') {
            if (id && action) {
                // Sub-actions on an existing subscription.
                // Authorization rules:
                //   approve / reject / note / welcome-email   → platform admin only
                //   cancel / change-plan / add-clinic /
                //   remove-clinic                              → platform admin OR subscription owner
                const PLATFORM_ONLY_ACTIONS = new Set(['approve', 'reject', 'note', 'welcome-email']);
                if (!callerIsPlatformAdmin) {
                    if (PLATFORM_ONLY_ACTIONS.has(action)) {
                        context.res = { status: 403, headers, body: { error: 'Only the platform administrator can perform this action.' } };
                        return;
                    }
                    const ownerId = await loadOwnerOf(id);
                    if (!callerUserId || ownerId !== callerUserId) {
                        context.res = { status: 403, headers, body: { error: 'Forbidden: you do not own this subscription.' } };
                        return;
                    }
                }
                if (action === 'approve') {
                    await pool.request()
                        .input('id', sql.Int, id)
                        .query(`UPDATE Subscriptions SET Status='active', ApprovedAt=GETUTCDATE()${hasColumn(subColumns, 'ModifiedDate') ? ', ModifiedDate=GETUTCDATE()' : ''} WHERE Id=@id`);
                    await logEvent(pool, id, 'approved', actorUserId, null);
                    context.res = { status: 200, headers, body: { message: 'Subscription approved' } };
                    return;
                }
                if (action === 'reject') {
                    const reason = getBodyValue(body, 'reason', 'Reason') || null;
                    await pool.request()
                        .input('id', sql.Int, id)
                        .query(`UPDATE Subscriptions SET Status='rejected'${hasColumn(subColumns, 'ModifiedDate') ? ', ModifiedDate=GETUTCDATE()' : ''} WHERE Id=@id`);
                    await logEvent(pool, id, 'rejected', actorUserId, reason ? { reason } : null);
                    context.res = { status: 200, headers, body: { message: 'Subscription rejected' } };
                    return;
                }
                if (action === 'cancel') {
                    const reason = getBodyValue(body, 'reason', 'Reason') || null;
                    const requestOnly = !!getBodyValue(body, 'requestOnly', 'RequestOnly');
                    const newStatus = requestOnly ? 'cancellation_requested' : 'cancelled';
                    const cancelClause = requestOnly ? '' : ', CancelledAt=GETUTCDATE()';
                    await pool.request()
                        .input('id', sql.Int, id)
                        .input('status', sql.NVarChar(30), newStatus)
                        .query(`UPDATE Subscriptions SET Status=@status${cancelClause}${hasColumn(subColumns, 'ModifiedDate') ? ', ModifiedDate=GETUTCDATE()' : ''} WHERE Id=@id`);
                    await logEvent(pool, id, requestOnly ? 'cancel_requested' : 'cancelled', actorUserId, reason ? { reason } : null);
                    context.res = { status: 200, headers, body: { message: requestOnly ? 'Cancellation requested' : 'Subscription cancelled' } };
                    return;
                }
                if (action === 'change-plan') {
                    const newPlanId = toIntOrNull(getBodyValue(body, 'planId', 'PlanId'));
                    if (!newPlanId) { context.res = { status: 400, headers, body: { error: 'planId is required' } }; return; }
                    const plan = await getPlanLimits(pool, newPlanId);
                    if (!plan) { context.res = { status: 400, headers, body: { error: 'Plan not found' } }; return; }
                    const clinicCount = await countSubscriptionClinics(pool, id);
                    if (Number(plan.MaxClinics || 1) < clinicCount) {
                        context.res = { status: 400, headers, body: { error: `Plan ${plan.Name} only allows ${plan.MaxClinics} clinic(s); subscription currently covers ${clinicCount}.` } };
                        return;
                    }
                    await pool.request()
                        .input('id', sql.Int, id)
                        .input('planId', sql.Int, newPlanId)
                        .query(`UPDATE Subscriptions SET PlanId=@planId${hasColumn(subColumns, 'ModifiedDate') ? ', ModifiedDate=GETUTCDATE()' : ''} WHERE Id=@id`);
                    await logEvent(pool, id, 'plan_changed', actorUserId, { newPlanId });
                    context.res = { status: 200, headers, body: { message: 'Plan changed' } };
                    return;
                }
                if (action === 'add-clinic') {
                    const clinicId = toIntOrNull(getBodyValue(body, 'clinicId', 'ClinicId'));
                    if (!clinicId) { context.res = { status: 400, headers, body: { error: 'clinicId is required' } }; return; }
                    // Validate plan limits
                    const subRes = await pool.request().input('id', sql.Int, id).query('SELECT PlanId FROM Subscriptions WHERE Id=@id');
                    const subRow = subRes.recordset[0];
                    if (!subRow) { context.res = { status: 404, headers, body: { error: 'Subscription not found' } }; return; }
                    const plan = await getPlanLimits(pool, subRow.PlanId);
                    const clinicCount = await countSubscriptionClinics(pool, id);
                    if (plan && Number(plan.MaxClinics || 1) <= clinicCount) {
                        context.res = { status: 400, headers, body: { error: `Plan ${plan.Name} allows up to ${plan.MaxClinics} clinic(s). Upgrade plan to add more.`, upgradeRequired: true } };
                        return;
                    }
                    try {
                        await pool.request()
                            .input('subId', sql.Int, id)
                            .input('clinicId', sql.Int, clinicId)
                            .query('INSERT INTO SubscriptionClinics (SubscriptionId, ClinicId) VALUES (@subId, @clinicId)');
                        await logEvent(pool, id, 'clinic_added', actorUserId, { clinicId });
                        context.res = { status: 201, headers, body: { message: 'Clinic added' } };
                    } catch (e) {
                        if (String(e.message || '').toLowerCase().indexOf('unique') !== -1 || (e.number === 2627 || e.number === 2601)) {
                            context.res = { status: 409, headers, body: { error: 'Clinic already covered by this subscription' } };
                        } else throw e;
                    }
                    return;
                }
                if (action === 'remove-clinic') {
                    const clinicId = toIntOrNull(subId !== null ? subId : getBodyValue(body, 'clinicId', 'ClinicId'));
                    if (!clinicId) { context.res = { status: 400, headers, body: { error: 'clinicId is required' } }; return; }
                    await pool.request()
                        .input('subId', sql.Int, id)
                        .input('clinicId', sql.Int, clinicId)
                        .query('DELETE FROM SubscriptionClinics WHERE SubscriptionId=@subId AND ClinicId=@clinicId');
                    await logEvent(pool, id, 'clinic_removed', actorUserId, { clinicId });
                    context.res = { status: 200, headers, body: { message: 'Clinic removed' } };
                    return;
                }
                if (action === 'note') {
                    const note = getBodyValue(body, 'note', 'Note', 'message') || '';
                    await logEvent(pool, id, 'note', actorUserId, { note });
                    context.res = { status: 200, headers, body: { message: 'Note added' } };
                    return;
                }
                if (action === 'welcome-email') {
                    // Placeholder: logs the intent until an email provider is wired up.
                    await logEvent(pool, id, 'welcome_email_sent', actorUserId, { sentAt: new Date().toISOString() });
                    context.res = { status: 200, headers, body: { message: 'Welcome email queued (placeholder — wire to your email provider).' } };
                    return;
                }
                context.res = { status: 400, headers, body: { error: `Unknown action: ${action}` } };
                return;
            }

            // Plain create (subscriber requesting a subscription).
            // The signup flow uses /api/signup, NOT this endpoint, so direct
            // POSTs here are an admin tool. Tenant users may request a
            // subscription only for THEMSELVES — they cannot create on behalf
            // of another user.
            const ownerUserId = toIntOrNull(getBodyValue(body, 'ownerUserId', 'OwnerUserId'));
            const planId = toIntOrNull(getBodyValue(body, 'planId', 'PlanId'));
            if (!ownerUserId) { context.res = { status: 400, headers, body: { error: 'ownerUserId is required' } }; return; }
            if (!planId) { context.res = { status: 400, headers, body: { error: 'planId is required' } }; return; }
            if (!callerIsPlatformAdmin) {
                if (!callerUserId || ownerUserId !== callerUserId) {
                    context.res = { status: 403, headers, body: { error: 'Forbidden: cannot create a subscription for another user.' } };
                    return;
                }
            }

            // Block duplicate active/pending subscription for the same owner
            const existing = await pool.request().input('owner', sql.Int, ownerUserId)
                .query("SELECT TOP 1 Id, Status FROM Subscriptions WHERE OwnerUserId=@owner AND Status IN ('pending','active','cancellation_requested','paused')");
            if (existing.recordset && existing.recordset.length > 0) {
                context.res = { status: 409, headers, body: { error: 'You already have an active or pending subscription.', existingId: existing.recordset[0].Id, existingStatus: existing.recordset[0].Status } };
                return;
            }

            const status = getBodyValue(body, 'status', 'Status') || 'pending';
            const finalStatus = VALID_STATUSES.indexOf(String(status).toLowerCase()) !== -1 ? String(status).toLowerCase() : 'pending';
            const notes = getBodyValue(body, 'notes', 'Notes') || null;
            const clinicIds = (() => {
                const raw = getBodyValue(body, 'clinicIds', 'ClinicIds');
                if (!raw) return [];
                if (Array.isArray(raw)) return raw.map(toIntOrNull).filter((n) => n !== null);
                return String(raw).split(',').map((s) => toIntOrNull(s.trim())).filter((n) => n !== null);
            })();

            const insertReq = pool.request()
                .input('owner', sql.Int, ownerUserId)
                .input('planId', sql.Int, planId)
                .input('status', sql.NVarChar(30), finalStatus)
                .input('notes', sql.NVarChar(sql.MAX), notes);
            const insertResult = await insertReq.query(`
                INSERT INTO Subscriptions (OwnerUserId, PlanId, Status, Notes, RequestedAt${finalStatus === 'active' ? ', ApprovedAt' : ''})
                OUTPUT INSERTED.Id
                VALUES (@owner, @planId, @status, @notes, GETUTCDATE()${finalStatus === 'active' ? ', GETUTCDATE()' : ''})`);
            const newId = insertResult.recordset[0].Id;
            await logEvent(pool, newId, 'requested', actorUserId || ownerUserId, { planId });

            // Add clinics if provided (and within plan limits)
            if (clinicIds.length > 0) {
                const plan = await getPlanLimits(pool, planId);
                const allowed = plan ? Math.max(1, Number(plan.MaxClinics || 1)) : 1;
                const toInsert = clinicIds.slice(0, allowed);
                for (const cid of toInsert) {
                    try {
                        await pool.request()
                            .input('subId', sql.Int, newId)
                            .input('clinicId', sql.Int, cid)
                            .query('INSERT INTO SubscriptionClinics (SubscriptionId, ClinicId) VALUES (@subId, @clinicId)');
                    } catch (_) {}
                }
            }
            context.res = { status: 201, headers, body: { id: newId, status: finalStatus } };
            return;
        }

        // ---- PUT (admin updates fields) ----
        if (req.method === 'PUT' && id) {
            // PUT writes status / planId / notes / renewal date — platform admin only.
            if (!callerIsPlatformAdmin) {
                context.res = { status: 403, headers, body: { error: 'Only the platform administrator can update subscription records.' } };
                return;
            }
            const sets = [];
            const r = pool.request().input('id', sql.Int, id);
            const status = getBodyValue(body, 'status', 'Status');
            if (status && VALID_STATUSES.indexOf(String(status).toLowerCase()) !== -1) {
                r.input('status', sql.NVarChar(30), String(status).toLowerCase());
                sets.push('Status=@status');
            }
            if (Object.prototype.hasOwnProperty.call(body, 'notes') || Object.prototype.hasOwnProperty.call(body, 'Notes')) {
                r.input('notes', sql.NVarChar(sql.MAX), getBodyValue(body, 'notes', 'Notes'));
                sets.push('Notes=@notes');
            }
            const planId = toIntOrNull(getBodyValue(body, 'planId', 'PlanId'));
            if (planId) {
                r.input('planId', sql.Int, planId);
                sets.push('PlanId=@planId');
            }
            if (Object.prototype.hasOwnProperty.call(body, 'nextRenewalDate') || Object.prototype.hasOwnProperty.call(body, 'NextRenewalDate')) {
                r.input('renewal', sql.Date, getBodyValue(body, 'nextRenewalDate', 'NextRenewalDate') || null);
                sets.push('NextRenewalDate=@renewal');
            }
            if (sets.length === 0) { context.res = { status: 400, headers, body: { error: 'No valid fields provided' } }; return; }
            if (hasColumn(subColumns, 'ModifiedDate')) sets.push('ModifiedDate=GETUTCDATE()');
            await r.query(`UPDATE Subscriptions SET ${sets.join(', ')} WHERE Id=@id`);
            await logEvent(pool, id, 'updated', actorUserId, { fields: Object.keys(body) });
            context.res = { status: 200, headers, body: { message: 'Subscription updated' } };
            return;
        }

        // ---- DELETE ----
        if (req.method === 'DELETE' && id) {
            if (!callerIsPlatformAdmin) {
                context.res = { status: 403, headers, body: { error: 'Only the platform administrator can delete subscription records.' } };
                return;
            }
            await pool.request().input('id', sql.Int, id).query('DELETE FROM Subscriptions WHERE Id=@id');
            context.res = { status: 200, headers, body: { message: 'Subscription deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        context.log.error('Subscriptions error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
