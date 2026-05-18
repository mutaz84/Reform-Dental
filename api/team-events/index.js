const { sql, getPool, resetPool } = require('../shared/database');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(context, status, body) {
    context.res = {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}

function safeJson(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || trimmed === 'null') return null;
        try { return JSON.parse(trimmed); } catch { return trimmed; }
    }
    return value;
}

function toBitOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return 1;
    if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return 0;
    return null;
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
        // GET: list all events (optionally filter by teamId) or single event
        if (method === 'GET') {
            if (id) {
                const result = await pool.request()
                    .input('id', sql.Int, parseInt(id))
                    .query('SELECT * FROM TeamEvents WHERE Id = @id');
                if (!result.recordset.length) return jsonResponse(context, 404, { error: 'Not found' });
                const row = result.recordset[0];
                row.AssignedMembers = safeJson(row.AssignedMembers);
                row.Attachments = safeJson(row.Attachments);
                return jsonResponse(context, 200, row);
            } else {
                const teamId = req.query?.teamId;
                let query = 'SELECT * FROM TeamEvents';
                const request = pool.request();
                if (teamId) {
                    query += ' WHERE TeamId = @teamId';
                    request.input('teamId', sql.Int, parseInt(teamId));
                }
                query += ' ORDER BY EventDate DESC, CreatedDate DESC';
                const result = await request.query(query);
                const rows = result.recordset.map(row => ({
                    ...row,
                    AssignedMembers: safeJson(row.AssignedMembers),
                    Attachments: safeJson(row.Attachments)
                }));
                return jsonResponse(context, 200, rows);
            }
        }

        // POST: create new event
        if (method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const columns = await getTableColumns(pool, 'TeamEvents');

            const fields = [];
            const values = [];
            const request = pool.request();

            function addCol(colName, sqlType, value) {
                if (!columns.includes(colName.toLowerCase())) return;
                fields.push(colName);
                values.push(`@${colName}`);
                request.input(colName, sqlType, value);
            }

            addCol('TeamId',         sql.Int,           parseInt(body.TeamId ?? body.teamId) || null);
            addCol('Title',          sql.NVarChar(255),  String(body.Title ?? body.title ?? '').trim() || null);
            addCol('EventType',      sql.NVarChar(100),  String(body.EventType ?? body.eventType ?? 'Meeting').trim());
            addCol('Status',         sql.NVarChar(50),   String(body.Status ?? body.status ?? 'Scheduled').trim());
            addCol('Priority',       sql.NVarChar(50),   String(body.Priority ?? body.priority ?? 'Medium').trim());
            addCol('EventDate',      sql.Date,           body.EventDate ?? body.eventDate ?? null);
            addCol('EventTime',      sql.NVarChar(20),   String(body.EventTime ?? body.eventTime ?? '').trim() || null);
            addCol('Frequency',      sql.NVarChar(50),   String(body.Frequency ?? body.frequency ?? 'One-Time').trim());
            addCol('Location',       sql.NVarChar(255),  String(body.Location ?? body.location ?? '').trim() || null);
            addCol('AssignedMembers',sql.NVarChar(sql.MAX), body.AssignedMembers != null ? JSON.stringify(body.AssignedMembers) : null);
            addCol('Description',    sql.NVarChar(sql.MAX), String(body.Description ?? body.description ?? '').trim() || null);
            addCol('Notes',          sql.NVarChar(sql.MAX), String(body.Notes ?? body.notes ?? '').trim() || null);
            addCol('Attachments',    sql.NVarChar(sql.MAX), body.Attachments != null ? JSON.stringify(body.Attachments) : null);
            addCol('DocumentUrl',    sql.NVarChar(sql.MAX), String(body.DocumentUrl ?? body.documentUrl ?? '').trim() || null);
            addCol('CompletedDate',  sql.Date,           body.CompletedDate ?? body.completedDate ?? null);
            addCol('IsActive',       sql.Bit,            toBitOrNull(body.IsActive ?? body.isActive) ?? 1);
            addCol('CreatedDate',    sql.DateTime,       new Date());
            addCol('ModifiedDate',   sql.DateTime,       new Date());

            const insertSql = `INSERT INTO TeamEvents (${fields.join(', ')}) OUTPUT INSERTED.Id VALUES (${values.join(', ')})`;
            const result = await request.query(insertSql);
            const newId = result.recordset[0]?.Id;

            const fetched = await pool.request().input('nid', sql.Int, newId).query('SELECT * FROM TeamEvents WHERE Id = @nid');
            const row = fetched.recordset[0];
            row.AssignedMembers = safeJson(row.AssignedMembers);
            row.Attachments = safeJson(row.Attachments);
            return jsonResponse(context, 201, row);
        }

        // PUT: update event
        if (method === 'PUT') {
            if (!id) return jsonResponse(context, 400, { error: 'Id required for update' });
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const columns = await getTableColumns(pool, 'TeamEvents');

            const setClauses = [];
            const request = pool.request();
            request.input('id', sql.Int, parseInt(id));

            function addSet(colName, sqlType, value) {
                if (!columns.includes(colName.toLowerCase())) return;
                setClauses.push(`${colName} = @${colName}`);
                request.input(colName, sqlType, value);
            }

            if (body.Title !== undefined)           addSet('Title',          sql.NVarChar(255),      String(body.Title ?? '').trim() || null);
            if (body.EventType !== undefined)       addSet('EventType',      sql.NVarChar(100),      String(body.EventType ?? 'Meeting').trim());
            if (body.Status !== undefined)          addSet('Status',         sql.NVarChar(50),       String(body.Status ?? 'Scheduled').trim());
            if (body.Priority !== undefined)        addSet('Priority',       sql.NVarChar(50),       String(body.Priority ?? 'Medium').trim());
            if (body.EventDate !== undefined)       addSet('EventDate',      sql.Date,               body.EventDate ?? null);
            if (body.EventTime !== undefined)       addSet('EventTime',      sql.NVarChar(20),       String(body.EventTime ?? '').trim() || null);
            if (body.Frequency !== undefined)       addSet('Frequency',      sql.NVarChar(50),       String(body.Frequency ?? 'One-Time').trim());
            if (body.Location !== undefined)        addSet('Location',       sql.NVarChar(255),      String(body.Location ?? '').trim() || null);
            if (body.AssignedMembers !== undefined) addSet('AssignedMembers',sql.NVarChar(sql.MAX),  body.AssignedMembers != null ? JSON.stringify(body.AssignedMembers) : null);
            if (body.Description !== undefined)     addSet('Description',    sql.NVarChar(sql.MAX),  String(body.Description ?? '').trim() || null);
            if (body.Notes !== undefined)           addSet('Notes',          sql.NVarChar(sql.MAX),  String(body.Notes ?? '').trim() || null);
            if (body.Attachments !== undefined)     addSet('Attachments',    sql.NVarChar(sql.MAX),  body.Attachments != null ? JSON.stringify(body.Attachments) : null);
            if (body.DocumentUrl !== undefined)     addSet('DocumentUrl',    sql.NVarChar(sql.MAX),  String(body.DocumentUrl ?? '').trim() || null);
            if (body.CompletedDate !== undefined)   addSet('CompletedDate',  sql.Date,               body.CompletedDate ?? null);
            if (body.IsActive !== undefined)        addSet('IsActive',       sql.Bit,                toBitOrNull(body.IsActive));

            addSet('ModifiedDate', sql.DateTime, new Date());

            if (!setClauses.length) return jsonResponse(context, 400, { error: 'No fields to update' });

            await request.query(`UPDATE TeamEvents SET ${setClauses.join(', ')} WHERE Id = @id`);
            const fetched = await pool.request().input('fid', sql.Int, parseInt(id)).query('SELECT * FROM TeamEvents WHERE Id = @fid');
            if (!fetched.recordset.length) return jsonResponse(context, 404, { error: 'Not found' });
            const row = fetched.recordset[0];
            row.AssignedMembers = safeJson(row.AssignedMembers);
            row.Attachments = safeJson(row.Attachments);
            return jsonResponse(context, 200, row);
        }

        // DELETE: delete event
        if (method === 'DELETE') {
            if (!id) return jsonResponse(context, 400, { error: 'Id required for delete' });
            await pool.request().input('id', sql.Int, parseInt(id)).query('DELETE FROM TeamEvents WHERE Id = @id');
            return jsonResponse(context, 200, { success: true });
        }

        return jsonResponse(context, 405, { error: 'Method not allowed' });

    } catch (err) {
        context.log.error('TeamEvents error:', err.message);
        resetPool();
        return jsonResponse(context, 500, { error: 'Internal server error', detail: err.message });
    }
};
