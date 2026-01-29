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
        await sql.connect(config);

        const rawUserId = (req.query && req.query.userId) || (req.body && req.body.userId);
        const userId = rawUserId !== undefined && rawUserId !== null && rawUserId !== '' ? parseInt(rawUserId, 10) : null;

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

            const result = await new sql.Request()
                .input('userId', sql.Int, userId)
                .query('SELECT * FROM StickyNotes WHERE UserId = @userId ORDER BY Id DESC');
            
            // Map Content to Text for frontend compatibility
            const notes = result.recordset.map(note => ({
                Id: note.Id,
                Text: note.Content,
                PositionX: note.PositionX || 100,
                PositionY: note.PositionY || 100,
                Color: note.Color || 'yellow',
                UserId: note.UserId,
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
                .input('userId', sql.Int, userId)
                .query(`
                    INSERT INTO StickyNotes (Content, Color, UserId)
                    OUTPUT INSERTED.*
                    VALUES (@content, @color, @userId)
                `);

            const note = result.recordset[0];
            context.res = {
                status: 201,
                headers,
                body: {
                    Id: note.Id,
                    Text: note.Content,
                    PositionX: positionX || 100,
                    PositionY: positionY || 100,
                    Color: note.Color,
                    UserId: note.UserId
                }
            };

        } else if (req.method === 'PUT') {
            // Update an existing sticky note
            const id = req.query.id || req.body.id;
            const { text, color } = req.body;

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
                .query(`
                    UPDATE StickyNotes
                    SET Content = COALESCE(@content, Content),
                        Color = COALESCE(@color, Color)
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
                    Color: note.Color,
                    UserId: note.UserId
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
                const deleteAllResult = await new sql.Request()
                    .input('userId', sql.Int, userId)
                    .query('DELETE FROM StickyNotes WHERE UserId = @userId');

                context.res = {
                    status: 200,
                    headers,
                    body: { message: 'All sticky notes deleted successfully', deletedCount: deleteAllResult.rowsAffected?.[0] || 0 }
                };
                return;
            }

            const deleteResult = await new sql.Request()
                .input('id', sql.Int, id)
                .input('userId', sql.Int, userId)
                .query('DELETE FROM StickyNotes WHERE Id = @id AND UserId = @userId');

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
                body: { message: 'Sticky note deleted successfully' }
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
