const sql = require('mssql');

const DEFAULT_TABLE = 'Requests';

function getConnectionString() {
  return process.env.SQL_CONNECTION_STRING || process.env.AZURE_SQL_CONNECTION_STRING || '';
}

function getTableName() {
  return process.env.REQUESTS_TABLE || DEFAULT_TABLE;
}

async function ensureTable(pool) {
  const table = getTableName();
  const query = `
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName)
    BEGIN
      CREATE TABLE ${table} (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        type NVARCHAR(100) NOT NULL,
        priority NVARCHAR(50) NOT NULL,
        status NVARCHAR(50) NOT NULL,
        requestedBy NVARCHAR(255) NOT NULL,
        assignedTo NVARCHAR(255) NULL,
        requestedAt DATETIME2 NULL,
        neededBy DATETIME2 NULL,
        location NVARCHAR(255) NULL,
        equipment NVARCHAR(255) NULL,
        vendor NVARCHAR(255) NULL,
        description NVARCHAR(MAX) NULL
      );
    END
  `;

  await pool.request()
    .input('tableName', sql.NVarChar, table)
    .query(query);
}

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    priority: row.priority,
    status: row.status,
    requestedBy: row.requestedBy,
    assignedTo: row.assignedTo,
    requestedAt: row.requestedAt,
    neededBy: row.neededBy,
    location: row.location,
    equipment: row.equipment,
    vendor: row.vendor,
    description: row.description
  };
}

module.exports = async function (context, req) {
  const connectionString = getConnectionString();
  if (!connectionString) {
    context.res = {
      status: 500,
      body: { error: 'SQL connection string not configured.' }
    };
    return;
  }

  let pool;
  try {
    pool = await sql.connect(connectionString);
    await ensureTable(pool);

    const table = getTableName();
    const id = req.params && req.params.id ? String(req.params.id) : '';

    if (req.method === 'GET') {
      if (id) {
        const result = await pool.request()
          .input('id', sql.NVarChar, id)
          .query(`SELECT * FROM ${table} WHERE id = @id`);
        const row = result.recordset && result.recordset[0];
        context.res = {
          status: row ? 200 : 404,
          body: row ? mapRow(row) : { error: 'Request not found' }
        };
        return;
      }

      const result = await pool.request().query(`SELECT * FROM ${table} ORDER BY requestedAt DESC`);
      context.res = {
        status: 200,
        body: (result.recordset || []).map(mapRow)
      };
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const requestId = body.id || `REQ-${Date.now()}`;
      await pool.request()
        .input('id', sql.NVarChar, requestId)
        .input('title', sql.NVarChar, body.title || '')
        .input('type', sql.NVarChar, body.type || '')
        .input('priority', sql.NVarChar, body.priority || '')
        .input('status', sql.NVarChar, body.status || '')
        .input('requestedBy', sql.NVarChar, body.requestedBy || '')
        .input('assignedTo', sql.NVarChar, body.assignedTo || null)
        .input('requestedAt', sql.DateTime2, body.requestedAt ? new Date(body.requestedAt) : null)
        .input('neededBy', sql.DateTime2, body.neededBy ? new Date(body.neededBy) : null)
        .input('location', sql.NVarChar, body.location || null)
        .input('equipment', sql.NVarChar, body.equipment || null)
        .input('vendor', sql.NVarChar, body.vendor || null)
        .input('description', sql.NVarChar, body.description || null)
        .query(`
          INSERT INTO ${table} (id, title, type, priority, status, requestedBy, assignedTo, requestedAt, neededBy, location, equipment, vendor, description)
          VALUES (@id, @title, @type, @priority, @status, @requestedBy, @assignedTo, @requestedAt, @neededBy, @location, @equipment, @vendor, @description)
        `);

      context.res = { status: 201, body: { id: requestId } };
      return;
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const requestId = id || body.id;

      if (!requestId) {
        context.res = { status: 400, body: { error: 'Missing request id.' } };
        return;
      }

      await pool.request()
        .input('id', sql.NVarChar, requestId)
        .input('title', sql.NVarChar, body.title || '')
        .input('type', sql.NVarChar, body.type || '')
        .input('priority', sql.NVarChar, body.priority || '')
        .input('status', sql.NVarChar, body.status || '')
        .input('requestedBy', sql.NVarChar, body.requestedBy || '')
        .input('assignedTo', sql.NVarChar, body.assignedTo || null)
        .input('requestedAt', sql.DateTime2, body.requestedAt ? new Date(body.requestedAt) : null)
        .input('neededBy', sql.DateTime2, body.neededBy ? new Date(body.neededBy) : null)
        .input('location', sql.NVarChar, body.location || null)
        .input('equipment', sql.NVarChar, body.equipment || null)
        .input('vendor', sql.NVarChar, body.vendor || null)
        .input('description', sql.NVarChar, body.description || null)
        .query(`
          MERGE ${table} AS target
          USING (SELECT @id AS id) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET
              title = @title,
              type = @type,
              priority = @priority,
              status = @status,
              requestedBy = @requestedBy,
              assignedTo = @assignedTo,
              requestedAt = @requestedAt,
              neededBy = @neededBy,
              location = @location,
              equipment = @equipment,
              vendor = @vendor,
              description = @description
          WHEN NOT MATCHED THEN
            INSERT (id, title, type, priority, status, requestedBy, assignedTo, requestedAt, neededBy, location, equipment, vendor, description)
            VALUES (@id, @title, @type, @priority, @status, @requestedBy, @assignedTo, @requestedAt, @neededBy, @location, @equipment, @vendor, @description);
        `);

      context.res = { status: 200, body: { id: requestId } };
      return;
    }

    context.res = { status: 405, body: { error: 'Method not allowed' } };
  } catch (error) {
    context.log.error(error);
    context.res = { status: 500, body: { error: 'Server error' } };
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (_) {}
    }
  }
};
