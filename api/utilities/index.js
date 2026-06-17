const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, resolveVisibleClinicId, TENANT_PARAM } = require('../shared/tenant');

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
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDecimalOrNull(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toBitOrNull(value) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
}

function addColumnValue(request, columns, definitions, columnName, paramName, type, value) {
    if (!hasColumn(columns, columnName)) return;
    request.input(paramName, type, value);
    definitions.push({ columnName, paramName });
}

function getBodyValue(body, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
            return body[key];
        }
    }
    return undefined;
}

function buildUtilityColumnDefinitions(request, columns, body) {
    const definitions = [];
    addColumnValue(request, columns, definitions, 'UtilityName',    'utilityName',    sql.NVarChar(200),     getBodyValue(body, 'utilityName', 'UtilityName', 'name', 'Name') || null);
    addColumnValue(request, columns, definitions, 'Category',       'category',       sql.NVarChar(100),     getBodyValue(body, 'category', 'Category') || null);
    addColumnValue(request, columns, definitions, 'Provider',       'provider',       sql.NVarChar(200),     getBodyValue(body, 'provider', 'Provider') || null);
    addColumnValue(request, columns, definitions, 'Service',        'service',        sql.NVarChar(200),     getBodyValue(body, 'service', 'Service') || null);
    addColumnValue(request, columns, definitions, 'AccountNumber',  'accountNumber',  sql.NVarChar(100),     getBodyValue(body, 'accountNumber', 'AccountNumber') || null);
    addColumnValue(request, columns, definitions, 'ServiceStartDate','serviceStartDate', sql.Date,           getBodyValue(body, 'serviceStartDate', 'ServiceStartDate') || null);
    addColumnValue(request, columns, definitions, 'ContractTerm',   'contractTerm',   sql.NVarChar(50),      getBodyValue(body, 'contractTerm', 'ContractTerm') || null);
    addColumnValue(request, columns, definitions, 'ClinicId',       'clinicId',       sql.Int,               toIntOrNull(getBodyValue(body, 'clinicId', 'ClinicId')));
    addColumnValue(request, columns, definitions, 'MonthlyCost',    'monthlyCost',    sql.Decimal(10, 2),    toDecimalOrNull(getBodyValue(body, 'monthlyCost', 'MonthlyCost', 'cost', 'Cost')));
    addColumnValue(request, columns, definitions, 'Notes',          'notes',          sql.NVarChar(sql.MAX), getBodyValue(body, 'notes', 'Notes') || null);
    addColumnValue(request, columns, definitions, 'Warnings',       'warnings',       sql.NVarChar(sql.MAX), getBodyValue(body, 'warnings', 'Warnings') || null);
    addColumnValue(request, columns, definitions, 'ImageUrl',       'imageUrl',       sql.NVarChar(sql.MAX), getBodyValue(body, 'imageUrl', 'ImageUrl') || null);
    addColumnValue(request, columns, definitions, 'DocumentUrl',    'documentUrl',    sql.NVarChar(sql.MAX), getBodyValue(body, 'documentUrl', 'DocumentUrl') || null);
    addColumnValue(request, columns, definitions, 'Status',         'status',         sql.NVarChar(50),      getBodyValue(body, 'status', 'Status') || null);
    addColumnValue(request, columns, definitions, 'IsActive',       'isActive',       sql.Bit,               toBitOrNull(getBodyValue(body, 'isActive', 'IsActive')));
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        const utilityColumns = await getTableColumns(pool, 'Utilities');
        if (utilityColumns.size === 0) {
            context.res = { status: 500, headers, body: { error: 'Utilities table not found. Please run the database setup script.' } };
            return;
        }

        const hasIsActive = hasColumn(utilityColumns, 'IsActive');
        const orderBy = hasColumn(utilityColumns, 'UtilityName') ? 'ORDER BY UtilityName' : 'ORDER BY Id';
        const id = req.params.id;

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            const hasClinicCol = hasColumn(utilityColumns, 'ClinicId');
            if (id) {
                const reqBuilder = pool.request().input('id', sql.Int, id);
                let whereSql = 'Id = @id';
                if (hasClinicCol) {
                    if (!tenantUserId) {
                        context.res = { status: 200, headers, body: null };
                        return;
                    }
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    whereSql += ` AND ${tenantClinicScopeSql('ClinicId')}`;
                }
                const result = await reqBuilder.query(`SELECT * FROM Utilities WHERE ${whereSql}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                if (hasClinicCol && !tenantUserId) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                const reqBuilder = pool.request();
                let whereSql = '';
                if (hasClinicCol) {
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    whereSql = `WHERE ${tenantClinicScopeSql('ClinicId')}`;
                }
                const result = await reqBuilder.query(`SELECT * FROM Utilities ${whereSql} ${orderBy}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body || {};
            if (hasColumn(utilityColumns, 'ClinicId')) {
                const tenantUserId = getRequestUserId(req);
                if (!tenantUserId) {
                    context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                    return;
                }
                const visibleClinicId = await resolveVisibleClinicId(pool, getBodyValue(body, 'clinicId', 'ClinicId'), tenantUserId);
                if (!visibleClinicId) {
                    context.res = { status: 403, headers, body: { error: 'Clinic is outside the current subscription.' } };
                    return;
                }
                body.clinicId = visibleClinicId;
                body.ClinicId = visibleClinicId;
            }
            const request = pool.request();
            const definitions = buildUtilityColumnDefinitions(request, utilityColumns, body);
            if (definitions.length === 0) {
                context.res = { status: 400, headers, body: { error: 'No valid utility fields were provided.' } };
                return;
            }
            const columnList = definitions.map((d) => d.columnName).join(', ');
            const valueList  = definitions.map((d) => `@${d.paramName}`).join(', ');
            const result = await request.query(
                `INSERT INTO Utilities (${columnList}) OUTPUT INSERTED.Id VALUES (${valueList})`
            );
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const request = pool.request().input('id', sql.Int, id);
            let updateWhere = 'Id=@id';
            if (hasColumn(utilityColumns, 'ClinicId')) {
                const tenantUserId = getRequestUserId(req);
                if (!tenantUserId) {
                    context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                    return;
                }
                const visibleClinicId = await resolveVisibleClinicId(pool, getBodyValue(body, 'clinicId', 'ClinicId'), tenantUserId);
                if (!visibleClinicId) {
                    context.res = { status: 403, headers, body: { error: 'Clinic is outside the current subscription.' } };
                    return;
                }
                body.clinicId = visibleClinicId;
                body.ClinicId = visibleClinicId;
                request.input(TENANT_PARAM, sql.Int, tenantUserId);
                updateWhere += ` AND ${tenantClinicScopeSql('ClinicId')}`;
            }
            const definitions = buildUtilityColumnDefinitions(request, utilityColumns, body);
            if (definitions.length === 0) {
                context.res = { status: 400, headers, body: { error: 'No valid utility fields were provided for update.' } };
                return;
            }
            const setClause = definitions
                .map((d) => `${d.columnName}=@${d.paramName}`)
                .concat(hasColumn(utilityColumns, 'ModifiedDate') ? ['ModifiedDate=GETUTCDATE()'] : [])
                .join(', ');
            const result = await request.query(`UPDATE Utilities SET ${setClause} WHERE ${updateWhere}`);
            if (hasColumn(utilityColumns, 'ClinicId') && (!result.rowsAffected || result.rowsAffected[0] === 0)) {
                context.res = { status: 404, headers, body: { error: 'Utility not found in current subscription.' } };
                return;
            }
            context.res = { status: 200, headers, body: { message: 'Utility updated' } };
        } else if (req.method === 'DELETE' && id) {
            const request = pool.request().input('id', sql.Int, id);
            let deleteWhere = 'Id = @id';
            if (hasColumn(utilityColumns, 'ClinicId')) {
                const tenantUserId = getRequestUserId(req);
                if (!tenantUserId) {
                    context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                    return;
                }
                request.input(TENANT_PARAM, sql.Int, tenantUserId);
                deleteWhere += ` AND ${tenantClinicScopeSql('ClinicId')}`;
            }
            const result = await request.query(`DELETE FROM Utilities WHERE ${deleteWhere}`);
            if (hasColumn(utilityColumns, 'ClinicId') && (!result.rowsAffected || result.rowsAffected[0] === 0)) {
                context.res = { status: 404, headers, body: { error: 'Utility not found in current subscription.' } };
                return;
            }
            context.res = { status: 200, headers, body: { message: 'Utility deleted' } };
        } else {
            context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
        }
    } catch (err) {
        context.log.error('Utilities database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
