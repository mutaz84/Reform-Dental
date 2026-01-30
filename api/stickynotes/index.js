const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

function getMissingSqlEnvVars() {
    const required = ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD'];
    return required.filter((key) => {
        const v = process.env[key];
        return v === undefined || v === null || String(v).trim() === '';
    });
}

module.exports = async function (context, req) {
    context.log('Sticky Notes API triggered');

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const missingEnv = getMissingSqlEnvVars();
        if (missingEnv.length > 0) {
            context.log.error('Sticky Notes API misconfigured. Missing env vars:', missingEnv);
            context.res = {
                status: 500,
                headers,
                body: {
                    error: 'Server misconfiguration',
                    details: `Missing required environment variables: ${missingEnv.join(', ')}`
                }
            };
            return;
        }

        await sql.connect(config);

        const rawUserId = (req.query && req.query.userId) || (req.body && req.body.userId);
        const userId = rawUserId !== undefined && rawUserId !== null && rawUserId !== '' ? parseInt(rawUserId, 10) : null;

        const includeDeleted = String(req.query?.includeDeleted || '').toLowerCase() === 'true';
        const deletedOnly = String(req.query?.deletedOnly || '').toLowerCase() === 'true';
        const permanent = String(req.query?.permanent || '').toLowerCase() === 'true' || String(req.query?.permanent || '') === '1';

        if (req.method === 'GET') {
            // Get all sticky notes for a specific user
            if (!Number.isInteger(userId)) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'userId is required' }
                };
                return;
            }

            let whereClause = 'UserId = @userId';
            if (deletedOnly) {
                whereClause += ' AND ISNULL(IsDeleted, 0) = 1';
            } else if (!includeDeleted) {
                whereClause += ' AND ISNULL(IsDeleted, 0) = 0';
            }

            const result = await new sql.Request()
                .input('userId', sql.Int, userId)
                .query(`SELECT * FROM StickyNotes WHERE ${whereClause} ORDER BY Id DESC`);
            
            // Map Content to Text for frontend compatibility
            const notes = result.recordset.map(note => ({
                Id: note.Id,
                Text: note.Content,
                PositionX: note.PositionX || 100,
                PositionY: note.PositionY || 100,
                Color: note.Color || 'yellow',
                UserId: note.UserId,
                IsDeleted: note.IsDeleted,
                CreatedDate: note.CreatedDate,
                ModifiedDate: note.ModifiedDate
            }));
            
            context.res = {
                status: 200,
                headers,
                body: notes
            };

        } else if (req.method === 'POST') {
            // Create a new sticky note
            const { text, positionX, positionY, color } = req.body;

            if (!Number.isInteger(userId)) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'userId is required' }
                };
                return;
            }

            const result = await new sql.Request()
                .input('content', sql.NVarChar(sql.MAX), text || '')
                .input('color', sql.NVarChar(50), color || 'yellow')
                .input('positionX', sql.Int, Number.isFinite(positionX) ? positionX : null)
                .input('positionY', sql.Int, Number.isFinite(positionY) ? positionY : null)
                .input('userId', sql.Int, userId)
                .query(`
                    INSERT INTO StickyNotes (Content, Color, UserId, PositionX, PositionY, IsDeleted, CreatedDate, ModifiedDate)
                    OUTPUT INSERTED.*
                    VALUES (@content, @color, @userId, @positionX, @positionY, 0, SYSUTCDATETIME(), SYSUTCDATETIME())
                `);

            const note = result.recordset[0];
            context.res = {
                status: 201,
                headers,
                body: {
                    Id: note.Id,
                    Text: note.Content,
                    PositionX: note.PositionX || 100,
                    PositionY: note.PositionY || 100,
                    Color: note.Color,
                    UserId: note.UserId,
                    IsDeleted: note.IsDeleted
                }
            };

        } else if (req.method === 'PUT') {
            // Update an existing sticky note
            const id = req.query.id || req.body.id;
            const { text, color, positionX, positionY } = req.body;
            const isDeleted = req.body && Object.prototype.hasOwnProperty.call(req.body, 'isDeleted') ? req.body.isDeleted : undefined;

            if (!Number.isInteger(userId)) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'userId is required' }
                };
                return;
            }

            if (!id) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Sticky note ID is required' }
                };
                return;
            }

            const result = await new sql.Request()
                .input('id', sql.Int, id)
                .input('userId', sql.Int, userId)
                .input('content', sql.NVarChar(sql.MAX), text)
                .input('color', sql.NVarChar(50), color)
                .input('positionX', sql.Int, Number.isFinite(positionX) ? positionX : null)
                .input('positionY', sql.Int, Number.isFinite(positionY) ? positionY : null)
                .input('isDeleted', sql.Bit, isDeleted === undefined ? null : (isDeleted ? 1 : 0))
                .query(`
                    UPDATE StickyNotes
                    SET Content = COALESCE(@content, Content),
                        Color = COALESCE(@color, Color),
                        PositionX = COALESCE(@positionX, PositionX),
                        PositionY = COALESCE(@positionY, PositionY),
                        IsDeleted = COALESCE(@isDeleted, IsDeleted),
                        ModifiedDate = SYSUTCDATETIME()
                    OUTPUT INSERTED.*
                    WHERE Id = @id AND UserId = @userId
                `);

            if (result.recordset.length === 0) {
                context.res = {
                    status: 404,
                    headers,
                    body: { error: 'Sticky note not found' }
                };
                return;
            }

            const note = result.recordset[0];
            context.res = {
                status: 200,
                headers,
                body: {
                    Id: note.Id,
                    Text: note.Content,
                    PositionX: note.PositionX || 100,
                    PositionY: note.PositionY || 100,
                    Color: note.Color,
                    UserId: note.UserId,
                    IsDeleted: note.IsDeleted
                }
            };

        } else if (req.method === 'DELETE') {
            // Delete a sticky note
            const id = req.query.id;

            if (!Number.isInteger(userId)) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'userId is required' }
                };
                return;
            }

            if (!id) {
                if (permanent && deletedOnly) {
                    const deleteAllDeleted = await new sql.Request()
                        .input('userId', sql.Int, userId)
                        .query('DELETE FROM StickyNotes WHERE UserId = @userId AND ISNULL(IsDeleted, 0) = 1');
                    context.res = {
                        status: 200,
                        headers,
                        body: { message: 'Deleted notes permanently removed', deletedCount: deleteAllDeleted.rowsAffected?.[0] || 0 }
                    };
                    return;
                }

                if (permanent) {
                    const deleteAllResult = await new sql.Request()
                        .input('userId', sql.Int, userId)
                        .query('DELETE FROM StickyNotes WHERE UserId = @userId');
                    context.res = {
                        status: 200,
                        headers,
                        body: { message: 'All sticky notes permanently deleted', deletedCount: deleteAllResult.rowsAffected?.[0] || 0 }
                    };
                    return;
                }

                // Soft-delete all active notes (move to recycle bin)
                const softDeleteAll = await new sql.Request()
                    .input('userId', sql.Int, userId)
                    .query(`
                        UPDATE StickyNotes
                        SET IsDeleted = 1,
                            ModifiedDate = SYSUTCDATETIME()
                        WHERE UserId = @userId AND ISNULL(IsDeleted, 0) = 0
                    `);

                context.res = {
                    status: 200,
                    headers,
                    body: { message: 'All sticky notes moved to recycle bin', deletedCount: softDeleteAll.rowsAffected?.[0] || 0 }
                };
                return;
            }

            const deleteResult = permanent
                ? await new sql.Request()
                    .input('id', sql.Int, id)
                    .input('userId', sql.Int, userId)
                    .query('DELETE FROM StickyNotes WHERE Id = @id AND UserId = @userId')
                : await new sql.Request()
                    .input('id', sql.Int, id)
                    .input('userId', sql.Int, userId)
                    .query(`
                        UPDATE StickyNotes
                        SET IsDeleted = 1,
                            ModifiedDate = SYSUTCDATETIME()
                        WHERE Id = @id AND UserId = @userId
                    `);

            if (!deleteResult.rowsAffected || deleteResult.rowsAffected[0] === 0) {
                context.res = {
                    status: 404,
                    headers,
                    body: { error: 'Sticky note not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                headers,
                body: { message: permanent ? 'Sticky note permanently deleted' : 'Sticky note moved to recycle bin' }
            };

        } else {
            context.res = {
                status: 405,
                headers,
                body: { error: 'Method not allowed' }
            };
        }

    } catch (error) {
        context.log.error('Sticky Notes API error:', error);
        context.res = {
            status: 500,
            headers,
            body: { error: 'Internal server error', details: error.message }
        };
    } finally {
        await sql.close();
    }
};
