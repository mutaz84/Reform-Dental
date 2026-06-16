const { sql, getPool, resetPool } = require('../shared/database');

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('tableName', sql.NVarChar(128), tableName)
        .query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
    return new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasColumn(columns, name) {
    return columns.has(String(name).toLowerCase());
}

function toIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDecimalOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toBitOrNull(value) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
}

function getBodyValue(body, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
            return body[key];
        }
    }
    return undefined;
}

function normalizeBillingCycle(value) {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'yearly' || v === 'annual' || v === 'year') return 'yearly';
    return 'monthly';
}

function serializeFeatures(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        // If already JSON, leave it; otherwise treat as newline/comma list.
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) return trimmed;
        const parts = trimmed.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
        return JSON.stringify(parts);
    }
    if (Array.isArray(value)) {
        return JSON.stringify(value.map((v) => String(v)).filter(Boolean));
    }
    return JSON.stringify(value);
}

function addColumnValue(request, columns, definitions, columnName, paramName, type, value) {
    if (!hasColumn(columns, columnName)) return;
    request.input(paramName, type, value);
    definitions.push({ columnName, paramName });
}

function buildPlanColumnDefinitions(request, columns, body) {
    const definitions = [];
    addColumnValue(request, columns, definitions, 'Name', 'name', sql.NVarChar(255),
        getBodyValue(body, 'name', 'Name') || null);
    addColumnValue(request, columns, definitions, 'Description', 'description', sql.NVarChar(sql.MAX),
        getBodyValue(body, 'description', 'Description') || null);
    addColumnValue(request, columns, definitions, 'Price', 'price', sql.Decimal(10, 2),
        toDecimalOrNull(getBodyValue(body, 'price', 'Price')));
    addColumnValue(request, columns, definitions, 'BillingCycle', 'billingCycle', sql.NVarChar(20),
        normalizeBillingCycle(getBodyValue(body, 'billingCycle', 'BillingCycle')));
    addColumnValue(request, columns, definitions, 'MaxClinics', 'maxClinics', sql.Int,
        toIntOrNull(getBodyValue(body, 'maxClinics', 'MaxClinics')) ?? 1);
    addColumnValue(request, columns, definitions, 'MaxUsers', 'maxUsers', sql.Int,
        toIntOrNull(getBodyValue(body, 'maxUsers', 'MaxUsers')));
    addColumnValue(request, columns, definitions, 'Features', 'features', sql.NVarChar(sql.MAX),
        serializeFeatures(getBodyValue(body, 'features', 'Features')));
    addColumnValue(request, columns, definitions, 'SortOrder', 'sortOrder', sql.Int,
        toIntOrNull(getBodyValue(body, 'sortOrder', 'SortOrder')) ?? 0);
    const isActiveValue = toBitOrNull(getBodyValue(body, 'isActive', 'IsActive'));
    addColumnValue(request, columns, definitions, 'IsActive', 'isActive', sql.Bit,
        isActiveValue === null ? true : isActiveValue);
    return definitions;
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

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        const planColumns = await getTableColumns(pool, 'SubscriptionPlans');
        if (planColumns.size === 0) {
            context.res = {
                status: 500,
                headers,
                body: { error: 'SubscriptionPlans table not found. Run database/subscriptions-setup.sql in Azure SQL.' }
            };
            return;
        }

        const orderClause = hasColumn(planColumns, 'SortOrder')
            ? 'ORDER BY SortOrder ASC, Id ASC'
            : 'ORDER BY Id ASC';
        const id = req.params.id;

        if (req.method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM SubscriptionPlans WHERE Id = @id');
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                const result = await pool.request()
                    .query(`SELECT * FROM SubscriptionPlans ${orderClause}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body || {};
            if (!getBodyValue(body, 'name', 'Name')) {
                context.res = { status: 400, headers, body: { error: 'Plan name is required.' } };
                return;
            }
            const request = pool.request();
            const definitions = buildPlanColumnDefinitions(request, planColumns, body);
            const columnList = definitions.map((d) => d.columnName).join(', ');
            const valueList = definitions.map((d) => `@${d.paramName}`).join(', ');
            const result = await request.query(
                `INSERT INTO SubscriptionPlans (${columnList}) OUTPUT INSERTED.Id VALUES (${valueList})`
            );
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const request = pool.request().input('id', sql.Int, id);
            const definitions = buildPlanColumnDefinitions(request, planColumns, body);
            if (definitions.length === 0 && !hasColumn(planColumns, 'ModifiedDate')) {
                context.res = { status: 400, headers, body: { error: 'No valid fields were provided for update.' } };
                return;
            }
            const setClause = definitions
                .map((d) => `${d.columnName}=@${d.paramName}`)
                .concat(hasColumn(planColumns, 'ModifiedDate') ? ['ModifiedDate=GETUTCDATE()'] : [])
                .join(', ');
            await request.query(`UPDATE SubscriptionPlans SET ${setClause} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Subscription plan updated' } };
        } else if (req.method === 'DELETE' && id) {
            // Soft-delete by toggling IsActive when in use; hard-delete otherwise.
            const inUseResult = await pool.request()
                .input('planId', sql.Int, id)
                .query('SELECT TOP 1 1 AS InUse FROM Subscriptions WHERE PlanId = @planId');
            if (inUseResult.recordset && inUseResult.recordset.length > 0 && hasColumn(planColumns, 'IsActive')) {
                await pool.request()
                    .input('id', sql.Int, id)
                    .query('UPDATE SubscriptionPlans SET IsActive = 0' +
                        (hasColumn(planColumns, 'ModifiedDate') ? ', ModifiedDate = GETUTCDATE()' : '') +
                        ' WHERE Id = @id');
                context.res = { status: 200, headers, body: { message: 'Plan is in use; deactivated instead of deleted.', deactivated: true } };
            } else {
                await pool.request()
                    .input('id', sql.Int, id)
                    .query('DELETE FROM SubscriptionPlans WHERE Id = @id');
                context.res = { status: 200, headers, body: { message: 'Subscription plan deleted' } };
            }
        } else {
            context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
        }
    } catch (err) {
        context.log.error('SubscriptionPlans error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
