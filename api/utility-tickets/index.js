const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
};

function jsonResponse(context, status, body) {
    context.res = {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}

async function getTableColumns(pool, tableName) {
    const result = await pool.request().query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`
    );
    return result.recordset.map(r => r.COLUMN_NAME.toLowerCase());
}

module.exports = async function (context, req) {
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: CORS_HEADERS, body: '' };
        return;
    }

    let pool;
    try {
        pool = await getPool();
    } catch (err) {
        context.log.error('DB connect error:', err.message);
        return jsonResponse(context, 503, { error: 'Database unavailable', detail: err.message });
    }

    const id = req.params?.id;
    const method = req.method.toUpperCase();

    try {
        // GET: list all tickets (optionally filter by utilityId) or single ticket
        if (method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            if (!tenantUserId) {
                if (id) return jsonResponse(context, 404, { error: 'Not found' });
                return jsonResponse(context, 200, []);
            }
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, parseInt(id))
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT t.* FROM UtilityTickets t
                            INNER JOIN Utilities u ON u.Id = t.UtilityId
                            WHERE t.Id = @id AND ${tenantClinicScopeSql('u.ClinicId')}`);
                if (!result.recordset.length) return jsonResponse(context, 404, { error: 'Not found' });
                return jsonResponse(context, 200, result.recordset[0]);
            } else {
                const utilityId = req.query?.utilityId;
                let query = `SELECT t.* FROM UtilityTickets t
                             INNER JOIN Utilities u ON u.Id = t.UtilityId
                             WHERE ${tenantClinicScopeSql('u.ClinicId')}`;
                const request = pool.request().input(TENANT_PARAM, sql.Int, tenantUserId);
                if (utilityId) {
                    query += ' AND t.UtilityId = @utilityId';
                    request.input('utilityId', sql.Int, parseInt(utilityId));
                }
                query += ' ORDER BY t.TicketDate DESC, t.CreatedDate DESC';
                const result = await request.query(query);
                return jsonResponse(context, 200, result.recordset);
            }
        }

        // POST: create new ticket
        if (method === 'POST') {
            const body = req.body || {};
            const cols = await getTableColumns(pool, 'UtilityTickets');
            const request = pool.request();
            const colNames = [];
            const paramNames = [];

            function addCol(col, type, value) {
                if (!cols.includes(col.toLowerCase())) return;
                colNames.push(col);
                paramNames.push('@' + col);
                request.input(col, type, value);
            }

            addCol('UtilityId',    sql.Int,          parseInt(body.UtilityId ?? body.utilityId) || 0);
            addCol('Title',        sql.NVarChar(255), String(body.Title ?? body.title ?? '').trim());
            addCol('TicketType',   sql.NVarChar(100), String(body.TicketType ?? body.ticketType ?? 'Maintenance').trim());
            addCol('Status',       sql.NVarChar(50),  String(body.Status ?? body.status ?? 'Open').trim());
            addCol('Priority',     sql.NVarChar(50),  String(body.Priority ?? body.priority ?? 'Medium').trim());
            addCol('Frequency',    sql.NVarChar(50),  String(body.Frequency ?? body.frequency ?? 'One-Time').trim());
            addCol('TicketDate',   sql.Date,          body.TicketDate ?? body.ticketDate ?? null);
            addCol('TicketTime',   sql.NVarChar(20),  String(body.TicketTime ?? body.ticketTime ?? '').trim() || null);
            addCol('AssignedTo',   sql.NVarChar(255), String(body.AssignedTo ?? body.assignedTo ?? '').trim() || null);
            addCol('Cost',         sql.Decimal(10,2), body.Cost != null ? parseFloat(body.Cost) : null);
            addCol('Description',  sql.NVarChar(sql.MAX), String(body.Description ?? body.description ?? '').trim() || null);
            addCol('Notes',        sql.NVarChar(sql.MAX), String(body.Notes ?? body.notes ?? '').trim() || null);
            addCol('CompletedDate',sql.Date,          body.CompletedDate ?? body.completedDate ?? null);
            addCol('IsActive',     sql.Bit,           1);
            addCol('CreatedDate',  sql.DateTime,      new Date());
            addCol('ModifiedDate', sql.DateTime,      new Date());

            if (!colNames.length) return jsonResponse(context, 400, { error: 'No valid columns' });

            const result = await request.query(
                `INSERT INTO UtilityTickets (${colNames.join(',')}) OUTPUT INSERTED.Id VALUES (${paramNames.join(',')})`
            );
            return jsonResponse(context, 201, { Id: result.recordset[0].Id });
        }

        // PUT: update ticket
        if (method === 'PUT') {
            if (!id) return jsonResponse(context, 400, { error: 'ID required' });
            const body = req.body || {};
            const cols = await getTableColumns(pool, 'UtilityTickets');
            const request = pool.request();
            const setClauses = [];

            function addSet(col, type, value) {
                if (!cols.includes(col.toLowerCase())) return;
                setClauses.push(`${col} = @${col}`);
                request.input(col, type, value);
            }

            if (body.Title !== undefined)        addSet('Title',        sql.NVarChar(255),       String(body.Title ?? '').trim());
            if (body.TicketType !== undefined)   addSet('TicketType',   sql.NVarChar(100),       String(body.TicketType ?? 'Maintenance').trim());
            if (body.Status !== undefined)       addSet('Status',       sql.NVarChar(50),        String(body.Status ?? 'Open').trim());
            if (body.Priority !== undefined)     addSet('Priority',     sql.NVarChar(50),        String(body.Priority ?? 'Medium').trim());
            if (body.Frequency !== undefined)    addSet('Frequency',    sql.NVarChar(50),        String(body.Frequency ?? 'One-Time').trim());
            if (body.TicketDate !== undefined)   addSet('TicketDate',   sql.Date,                body.TicketDate ?? null);
            if (body.TicketTime !== undefined)   addSet('TicketTime',   sql.NVarChar(20),        String(body.TicketTime ?? '').trim() || null);
            if (body.AssignedTo !== undefined)   addSet('AssignedTo',   sql.NVarChar(255),       String(body.AssignedTo ?? '').trim() || null);
            if (body.Cost !== undefined)         addSet('Cost',         sql.Decimal(10,2),       body.Cost != null ? parseFloat(body.Cost) : null);
            if (body.Description !== undefined)  addSet('Description',  sql.NVarChar(sql.MAX),   String(body.Description ?? '').trim() || null);
            if (body.Notes !== undefined)        addSet('Notes',        sql.NVarChar(sql.MAX),   String(body.Notes ?? '').trim() || null);
            if (body.CompletedDate !== undefined) addSet('CompletedDate', sql.Date,              body.CompletedDate ?? null);

            addSet('ModifiedDate', sql.DateTime, new Date());

            if (!setClauses.length) return jsonResponse(context, 400, { error: 'No fields to update' });

            request.input('id', sql.Int, parseInt(id));
            await request.query(`UPDATE UtilityTickets SET ${setClauses.join(', ')} WHERE Id = @id`);
            return jsonResponse(context, 200, { updated: true });
        }

        // DELETE: remove ticket
        if (method === 'DELETE') {
            if (!id) return jsonResponse(context, 400, { error: 'ID required' });
            const request = pool.request();
            request.input('id', sql.Int, parseInt(id));
            await request.query('DELETE FROM UtilityTickets WHERE Id = @id');
            return jsonResponse(context, 200, { deleted: true });
        }

        return jsonResponse(context, 405, { error: 'Method not allowed' });

    } catch (err) {
        context.log.error('utility-tickets error:', err.message);
        try { resetPool(); } catch (_) {}
        return jsonResponse(context, 500, { error: 'Internal server error', detail: err.message });
    }
};
