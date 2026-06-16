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

function safeJson(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return null; }
}

function addColumnValue(request, columns, definitions, columnName, paramName, type, value) {
    if (!hasColumn(columns, columnName)) return;
    request.input(paramName, type, value);
    definitions.push({ columnName, paramName });
}

async function ensureTeamsTable(pool) {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Teams') AND type = 'U')
        BEGIN
            CREATE TABLE Teams (
                Id            INT IDENTITY(1,1) PRIMARY KEY,
                TeamName      NVARCHAR(200) NOT NULL,
                Category      NVARCHAR(100),
                Description   NVARCHAR(1000),
                TeamLeadId    NVARCHAR(100),
                TeamLeadName  NVARCHAR(200),
                Members       NVARCHAR(MAX),
                OfficeId      NVARCHAR(50),
                Schedule      NVARCHAR(200),
                ImageData     NVARCHAR(MAX),
                DocumentData  NVARCHAR(MAX),
                DocumentName  NVARCHAR(500),
                Notes         NVARCHAR(MAX),
                Warnings      NVARCHAR(MAX),
                OperationsLog NVARCHAR(MAX),
                IsActive      BIT DEFAULT 1,
                CreatedDate   DATETIME2 DEFAULT GETUTCDATE(),
                ModifiedDate  DATETIME2
            )
        END
    `);
}

function buildTeamColumnDefinitions(request, columns, body) {
    const definitions = [];
    addColumnValue(request, columns, definitions, 'TeamName',       'teamName',       sql.NVarChar(200),     getBodyValue(body, 'teamName', 'TeamName', 'name', 'Name') || null);
    addColumnValue(request, columns, definitions, 'Category',       'category',       sql.NVarChar(100),     getBodyValue(body, 'category', 'Category') || null);
    addColumnValue(request, columns, definitions, 'Description',    'description',    sql.NVarChar(1000),    getBodyValue(body, 'description', 'Description') || null);
    addColumnValue(request, columns, definitions, 'TeamLeadId',     'teamLeadId',     sql.NVarChar(100),     getBodyValue(body, 'teamLeadId', 'TeamLeadId') || null);
    addColumnValue(request, columns, definitions, 'TeamLeadName',   'teamLeadName',   sql.NVarChar(200),     getBodyValue(body, 'teamLeadName', 'TeamLeadName') || null);
    addColumnValue(request, columns, definitions, 'Members',        'members',        sql.NVarChar(sql.MAX), safeJson(getBodyValue(body, 'members', 'Members')));
    addColumnValue(request, columns, definitions, 'OfficeId',       'officeId',       sql.NVarChar(50),      getBodyValue(body, 'officeId', 'OfficeId') || null);
    addColumnValue(request, columns, definitions, 'Schedule',       'schedule',       sql.NVarChar(200),     getBodyValue(body, 'schedule', 'Schedule') || null);
    addColumnValue(request, columns, definitions, 'ImageData',      'imageData',      sql.NVarChar(sql.MAX), getBodyValue(body, 'imageData', 'ImageData') || null);
    addColumnValue(request, columns, definitions, 'DocumentData',   'documentData',   sql.NVarChar(sql.MAX), getBodyValue(body, 'documentData', 'DocumentData') || null);
    addColumnValue(request, columns, definitions, 'DocumentName',   'documentName',   sql.NVarChar(500),     getBodyValue(body, 'documentName', 'DocumentName') || null);
    addColumnValue(request, columns, definitions, 'Notes',          'notes',          sql.NVarChar(sql.MAX), getBodyValue(body, 'notes', 'Notes') || null);
    addColumnValue(request, columns, definitions, 'Warnings',       'warnings',       sql.NVarChar(sql.MAX), getBodyValue(body, 'warnings', 'Warnings') || null);
    addColumnValue(request, columns, definitions, 'OperationsLog',  'operationsLog',  sql.NVarChar(sql.MAX), safeJson(getBodyValue(body, 'operationsLog', 'OperationsLog')));
    addColumnValue(request, columns, definitions, 'IsActive',       'isActive',       sql.Bit,               toBitOrNull(getBodyValue(body, 'isActive', 'IsActive')));
    return definitions;
}

const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

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
        await ensureTeamsTable(pool);
        const teamColumns = await getTableColumns(pool, 'Teams');

        const hasIsActive = hasColumn(teamColumns, 'IsActive');
        const orderBy = hasColumn(teamColumns, 'TeamName') ? 'ORDER BY TeamName' : 'ORDER BY Id';
        const id = req.params.id;

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            const hasClinicCol = hasColumn(teamColumns, 'ClinicId');
            if (id) {
                const reqBuilder = pool.request().input('id', sql.Int, id);
                let whereSql = 'Id = @id';
                if (hasClinicCol) {
                    if (!tenantUserId) {
                        context.res = { status: 200, headers, body: null };
                        return;
                    }
                    reqBuilder.input(TENANT_PARAM, sql.Int, tenantUserId);
                    whereSql += ` AND (ClinicId IS NULL OR ${tenantClinicScopeSql('ClinicId')})`;
                }
                const result = await reqBuilder.query(`SELECT * FROM Teams WHERE ${whereSql}`);
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
                    whereSql = `WHERE (ClinicId IS NULL OR ${tenantClinicScopeSql('ClinicId')})`;
                }
                const result = await reqBuilder.query(`SELECT * FROM Teams ${whereSql} ${orderBy}`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body || {};
            const request = pool.request();
            const definitions = buildTeamColumnDefinitions(request, teamColumns, body);
            if (definitions.length === 0) {
                context.res = { status: 400, headers, body: { error: 'No valid team fields were provided.' } };
                return;
            }
            const columnList = definitions.map((d) => d.columnName).join(', ');
            const valueList  = definitions.map((d) => `@${d.paramName}`).join(', ');
            const result = await request.query(
                `INSERT INTO Teams (${columnList}) OUTPUT INSERTED.Id VALUES (${valueList})`
            );
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body || {};
            const request = pool.request().input('id', sql.Int, id);
            const definitions = buildTeamColumnDefinitions(request, teamColumns, body);
            if (definitions.length === 0) {
                context.res = { status: 400, headers, body: { error: 'No valid team fields were provided for update.' } };
                return;
            }
            const setClause = definitions
                .map((d) => `${d.columnName}=@${d.paramName}`)
                .concat(hasColumn(teamColumns, 'ModifiedDate') ? ['ModifiedDate=GETUTCDATE()'] : [])
                .join(', ');
            await request.query(`UPDATE Teams SET ${setClause} WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Team updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Teams WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Team deleted' } };
        } else {
            context.res = { status: 405, headers, body: { error: 'Method not allowed.' } };
        }
    } catch (err) {
        context.log.error('Teams database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
