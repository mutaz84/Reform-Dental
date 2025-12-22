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

        if (req.method === 'GET') {
            // Get all sticky notes for the current user (or all if userId not specified)
            const userId = req.query.userId || null;
            
            let query = 'SELECT * FROM StickyNotes';
            if (userId) {
                query += ' WHERE UserId = @userId';
            }
            query += ' ORDER BY CreatedDate DESC';

            const request = new sql.Request();
            if (userId) {
                request.input('userId', sql.Int, userId);
            }
            
            const result = await request.query(query);
            
            context.res = {
                status: 200,
                headers,
                body: result.recordset
            };

        } else if (req.method === 'POST') {
            // Create a new sticky note
            const { text, positionX, positionY, color, userId } = req.body;

            const result = await new sql.Request()
                .input('text', sql.NVarChar(sql.MAX), text || '')
                .input('positionX', sql.Int, positionX || 100)
                .input('positionY', sql.Int, positionY || 100)
                .input('color', sql.NVarChar(50), color || 'yellow')
                .input('userId', sql.Int, userId || null)
                .query(`
                    INSERT INTO StickyNotes (Text, PositionX, PositionY, Color, UserId, CreatedDate)
                    OUTPUT INSERTED.*
                    VALUES (@text, @positionX, @positionY, @color, @userId, GETUTCDATE())
                `);

            context.res = {
                status: 201,
                headers,
                body: result.recordset[0]
            };

        } else if (req.method === 'PUT') {
            // Update an existing sticky note
            const id = req.query.id || req.body.id;
            const { text, positionX, positionY, color } = req.body;

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
                .input('text', sql.NVarChar(sql.MAX), text)
                .input('positionX', sql.Int, positionX)
                .input('positionY', sql.Int, positionY)
                .input('color', sql.NVarChar(50), color)
                .query(`
                    UPDATE StickyNotes 
                    SET Text = COALESCE(@text, Text),
                        PositionX = COALESCE(@positionX, PositionX),
                        PositionY = COALESCE(@positionY, PositionY),
                        Color = COALESCE(@color, Color),
                        ModifiedDate = GETUTCDATE()
                    OUTPUT INSERTED.*
                    WHERE Id = @id
                `);

            if (result.recordset.length === 0) {
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
                body: result.recordset[0]
            };

        } else if (req.method === 'DELETE') {
            // Delete a sticky note
            const id = req.query.id;

            if (!id) {
                context.res = {
                    status: 400,
                    headers,
                    body: { error: 'Sticky note ID is required' }
                };
                return;
            }

            await new sql.Request()
                .input('id', sql.Int, id)
                .query('DELETE FROM StickyNotes WHERE Id = @id');

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
