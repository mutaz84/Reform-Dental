const { sql, getPool, resetPool } = require('../shared/database');
const { getRequestUserId, tenantClinicScopeSql, resolveWritableClinicId, TENANT_PARAM } = require('../shared/tenant');

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
        // Ensure optional Links column exists for arbitrary external URLs per instrument.
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'Links' AND Object_ID = Object_ID(N'Instruments'))
                BEGIN ALTER TABLE Instruments ADD Links NVARCHAR(MAX) NULL; END
            `);
        } catch (_) {}
        const id = req.params.id;
        const tenantUserId = getRequestUserId(req);

        if (req.method === 'GET') {
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
            if (!tenantUserId) {
                context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                return;
            }
            const visibleClinicId = await resolveWritableClinicId(pool, body, tenantUserId);
            if (!visibleClinicId) {
                context.res = { status: 403, headers, body: { error: 'Clinic is outside the current subscription.' } };
                return;
            }
            const result = await pool.request()
                .input('name', sql.NVarChar, body.name)
                .input('skuNumber', sql.NVarChar, body.skuNumber || null)
                .input('category', sql.NVarChar, body.category)
                .input('description', sql.NVarChar(sql.MAX), body.description)
                .input('quantity', sql.Int, body.quantity || 1)
                .input('status', sql.NVarChar, body.status || 'available')
                .input('clinicId', sql.Int, visibleClinicId)
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
            if (!tenantUserId) {
                context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                return;
            }
            const visibleClinicId = await resolveWritableClinicId(pool, body, tenantUserId);
            if (!visibleClinicId) {
                context.res = { status: 403, headers, body: { error: 'Clinic is outside the current subscription.' } };
                return;
            }
            const result = await pool.request()
                .input('id', sql.Int, id)
                .input(TENANT_PARAM, sql.Int, tenantUserId)
                .input('name', sql.NVarChar, body.name)
                .input('skuNumber', sql.NVarChar, body.skuNumber || null)
                .input('category', sql.NVarChar, body.category)
                .input('description', sql.NVarChar(sql.MAX), body.description || null)
                .input('quantity', sql.Int, body.quantity)
                .input('status', sql.NVarChar, body.status)
                .input('clinicId', sql.Int, visibleClinicId)
                .input('sterilizationRequired', sql.Bit, body.sterilizationRequired !== false)
                .input('icon', sql.NVarChar, body.icon || null)
                .input('notes', sql.NVarChar(sql.MAX), body.notes)
                .input('warnings', sql.NVarChar(sql.MAX), body.warnings)
                .input('imageUrl', sql.NVarChar(sql.MAX), body.imageUrl)
                .input('documentUrl', sql.NVarChar(sql.MAX), body.documentUrl)
                .input('links', sql.NVarChar(sql.MAX), body.links == null ? null : body.links)
                .query(`UPDATE Instruments SET Name=@name, SkuNumber=@skuNumber, Category=@category, Description=@description, Quantity=@quantity, Status=@status, ClinicId=@clinicId, SterilizationRequired=@sterilizationRequired, Icon=@icon, Notes=@notes, Warnings=@warnings, ImageUrl=@imageUrl, DocumentUrl=@documentUrl, Links=@links, ModifiedDate=GETUTCDATE() WHERE Id=@id AND ${tenantClinicScopeSql('ClinicId')}`);
            if (!result.rowsAffected || result.rowsAffected[0] === 0) {
                context.res = { status: 404, headers, body: { error: 'Instrument not found in current subscription.' } };
                return;
            }
            context.res = { status: 200, headers, body: { message: 'Instrument updated' } };
        } else if (req.method === 'DELETE' && id) {
            if (!tenantUserId) {
                context.res = { status: 403, headers, body: { error: 'Tenant user is required.' } };
                return;
            }
            const result = await pool.request()
                .input('id', sql.Int, id)
                .input(TENANT_PARAM, sql.Int, tenantUserId)
                .query(`DELETE FROM Instruments WHERE Id = @id AND ${tenantClinicScopeSql('ClinicId')}`);
            if (!result.rowsAffected || result.rowsAffected[0] === 0) {
                context.res = { status: 404, headers, body: { error: 'Instrument not found in current subscription.' } };
                return;
            }
            context.res = { status: 200, headers, body: { message: 'Instrument deleted' } };
        }
    } catch (err) {
        context.log.error('Database error:', err);
        await resetPool();
        context.res = { status: 500, headers, body: { error: err.message } };
    }
};
