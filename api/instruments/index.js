const sql = require('mssql');
const { getRequestUserId, tenantClinicScopeSql, TENANT_PARAM } = require('../shared/tenant');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=(?:tcp:)?([^,;]+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);
        
        return {
            server: serverMatch ? serverMatch[1] : '',
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: { encrypt: true, trustServerCertificate: false }
        };
    }
    return {};
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await sql.connect(getConfig());
        // Ensure optional Links column exists for arbitrary external URLs per instrument.
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'Links' AND Object_ID = Object_ID(N'Instruments'))
                BEGIN ALTER TABLE Instruments ADD Links NVARCHAR(MAX) NULL; END
            `);
        } catch (_) {}
        const id = req.params.id;

        if (req.method === 'GET') {
            const tenantUserId = getRequestUserId(req);
            if (id) {
                if (!tenantUserId) {
                    context.res = { status: 200, headers, body: null };
                    return;
                }
                const result = await pool.request()
                    .input('id', sql.Int, id)
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT * FROM Instruments WHERE Id = @id AND ${tenantClinicScopeSql('ClinicId')}`);
                context.res = { status: 200, headers, body: result.recordset[0] || null };
            } else {
                if (!tenantUserId) {
                    context.res = { status: 200, headers, body: [] };
                    return;
                }
                const result = await pool.request()
                    .input(TENANT_PARAM, sql.Int, tenantUserId)
                    .query(`SELECT * FROM Instruments WHERE ${tenantClinicScopeSql('ClinicId')} ORDER BY Name`);
                context.res = { status: 200, headers, body: result.recordset };
            }
        } else if (req.method === 'POST') {
            const body = req.body;
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('skuNumber', sql.NVarChar, body.skuNumber || null)
                .input('category', sql.NVarChar, body.category)
                .input('description', sql.NVarChar(sql.MAX), body.description)
                .input('quantity', sql.Int, body.quantity || 1)
                .input('status', sql.NVarChar, body.status || 'available')
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('sterilizationRequired', sql.Bit, body.sterilizationRequired !== false)
                .input('icon', sql.NVarChar, body.icon)
                .input('notes', sql.NVarChar(sql.MAX), body.notes || null)
                .input('warnings', sql.NVarChar(sql.MAX), body.warnings || null)
                .input('imageUrl', sql.NVarChar(sql.MAX), body.imageUrl || null)
                .input('documentUrl', sql.NVarChar(sql.MAX), body.documentUrl || null)
                .input('links', sql.NVarChar(sql.MAX), body.links || null)
                .query(`INSERT INTO Instruments (Name, SkuNumber, Category, Description, Quantity, Status, ClinicId, SterilizationRequired, Icon, Notes, Warnings, ImageUrl, DocumentUrl, Links) 
                        OUTPUT INSERTED.Id VALUES (@name, @skuNumber, @category, @description, @quantity, @status, @clinicId, @sterilizationRequired, @icon, @notes, @warnings, @imageUrl, @documentUrl, @links)`);
            context.res = { status: 201, headers, body: { id: result.recordset[0].Id } };
        } else if (req.method === 'PUT' && id) {
            const body = req.body;
            await pool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, body.name)
                .input('skuNumber', sql.NVarChar, body.skuNumber || null)
                .input('category', sql.NVarChar, body.category)
                .input('description', sql.NVarChar(sql.MAX), body.description || null)
                .input('quantity', sql.Int, body.quantity)
                .input('status', sql.NVarChar, body.status)
                .input('clinicId', sql.Int, body.clinicId || null)
                .input('sterilizationRequired', sql.Bit, body.sterilizationRequired !== false)
                .input('icon', sql.NVarChar, body.icon || null)
                .input('notes', sql.NVarChar(sql.MAX), body.notes)
                .input('warnings', sql.NVarChar(sql.MAX), body.warnings)
                .input('imageUrl', sql.NVarChar(sql.MAX), body.imageUrl)
                .input('documentUrl', sql.NVarChar(sql.MAX), body.documentUrl)
                .input('links', sql.NVarChar(sql.MAX), body.links == null ? null : body.links)
                .query(`UPDATE Instruments SET Name=@name, SkuNumber=@skuNumber, Category=@category, Description=@description, Quantity=@quantity, Status=@status, ClinicId=@clinicId, SterilizationRequired=@sterilizationRequired, Icon=@icon, Notes=@notes, Warnings=@warnings, ImageUrl=@imageUrl, DocumentUrl=@documentUrl, Links=@links, ModifiedDate=GETUTCDATE() WHERE Id=@id`);
            context.res = { status: 200, headers, body: { message: 'Instrument updated' } };
        } else if (req.method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Instruments WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Instrument deleted' } };
        }

        await pool.close();
    } catch (err) {
        context.log.error('Database error:', err);
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
