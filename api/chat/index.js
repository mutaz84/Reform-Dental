const sql = require('mssql');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=tcp:([^,]+)/i);
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
    context.log('Chat API triggered');
    
    // Handle CORS
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
        const method = req.method;
        const action = req.query.action || '';
        const messageId = req.params.id;

        // GET - Fetch conversations or messages
        if (method === 'GET') {
            // Get total unread count for a user
            if (action === 'unreadCount') {
                const userId = req.query.userId;
                if (!userId) {
                    context.res = { status: 400, headers, body: { error: 'userId required' } };
                    return;
                }
                
                const result = await sql.query`
                    SELECT COUNT(*) AS UnreadCount
                    FROM ChatMessages
                    WHERE ReceiverId = ${userId} AND IsRead = 0`;
                
                context.res = { status: 200, headers, body: { unreadCount: result.recordset[0].UnreadCount } };
                return;
            }
            
            // Get conversations list for a user
            if (action === 'conversations') {
                const userId = req.query.userId;
                if (!userId) {
                    context.res = { status: 400, headers, body: { error: 'userId required' } };
                    return;
                }
                
                // Get all conversations with last message and unread count
                const result = await sql.query`
                    WITH LastMessages AS (
                        SELECT 
                            CASE 
                                WHEN SenderId = ${userId} THEN ReceiverId 
                                ELSE SenderId 
                            END AS OtherUserId,
                            Message,
                            SentAt,
                            IsRead,
                            SenderId,
                            ROW_NUMBER() OVER (
                                PARTITION BY 
                                    CASE WHEN SenderId = ${userId} THEN ReceiverId ELSE SenderId END
                                ORDER BY SentAt DESC
                            ) AS rn
                        FROM ChatMessages
                        WHERE SenderId = ${userId} OR ReceiverId = ${userId}
                    ),
                    UnreadCounts AS (
                        SELECT 
                            SenderId AS OtherUserId,
                            COUNT(*) AS UnreadCount
                        FROM ChatMessages
                        WHERE ReceiverId = ${userId} AND IsRead = 0
                        GROUP BY SenderId
                    )
                    SELECT 
                        lm.OtherUserId,
                        u.FirstName,
                        u.LastName,
                        u.Role,
                        u.IsOnline,
                        u.LastSeen,
                        lm.Message AS LastMessage,
                        lm.SentAt AS LastMessageTime,
                        lm.SenderId AS LastMessageSenderId,
                        ISNULL(uc.UnreadCount, 0) AS UnreadCount
                    FROM LastMessages lm
                    JOIN Users u ON u.Id = lm.OtherUserId
                    LEFT JOIN UnreadCounts uc ON uc.OtherUserId = lm.OtherUserId
                    WHERE lm.rn = 1
                    ORDER BY lm.SentAt DESC`;
                
                context.res = { status: 200, headers, body: result.recordset };
                return;
            }
            
            // Get messages between two users
            if (action === 'messages') {
                const userId = req.query.userId;
                const otherUserId = req.query.otherUserId;
                
                if (!userId || !otherUserId) {
                    context.res = { status: 400, headers, body: { error: 'userId and otherUserId required' } };
                    return;
                }
                
                // Mark messages as read
                await sql.query`
                    UPDATE ChatMessages 
                    SET IsRead = 1, ReadAt = GETDATE()
                    WHERE SenderId = ${otherUserId} AND ReceiverId = ${userId} AND IsRead = 0`;
                
                // Get messages
                const result = await sql.query`
                    SELECT 
                        m.Id,
                        m.SenderId,
                        m.ReceiverId,
                        m.Message,
                        m.SentAt,
                        m.IsRead,
                        m.ReadAt,
                        s.FirstName AS SenderFirstName,
                        s.LastName AS SenderLastName
                    FROM ChatMessages m
                    JOIN Users s ON s.Id = m.SenderId
                    WHERE (m.SenderId = ${userId} AND m.ReceiverId = ${otherUserId})
                       OR (m.SenderId = ${otherUserId} AND m.ReceiverId = ${userId})
                    ORDER BY m.SentAt ASC`;
                
                context.res = { status: 200, headers, body: result.recordset };
                return;
            }
            
            // Get all users for starting new conversation
            if (action === 'users') {
                const userId = req.query.userId;
                const result = await sql.query`
                    SELECT Id, FirstName, LastName, Role, IsOnline, LastSeen
                    FROM Users 
                    WHERE Id != ${userId} AND IsActive = 1
                    ORDER BY FirstName, LastName`;
                
                context.res = { status: 200, headers, body: result.recordset };
                return;
            }
            
            // Get unread count for a user (for notification badge)
            if (action === 'unreadCount') {
                const userId = req.query.userId;
                const result = await sql.query`
                    SELECT COUNT(*) AS UnreadCount
                    FROM ChatMessages
                    WHERE ReceiverId = ${userId} AND IsRead = 0`;
                
                context.res = { status: 200, headers, body: result.recordset[0] };
                return;
            }
            
            // Get new messages (for polling)
            if (action === 'newMessages') {
                const userId = req.query.userId;
                const since = req.query.since;
                
                const result = await sql.query`
                    SELECT 
                        m.Id,
                        m.SenderId,
                        m.ReceiverId,
                        m.Message,
                        m.SentAt,
                        m.IsRead,
                        s.FirstName AS SenderFirstName,
                        s.LastName AS SenderLastName
                    FROM ChatMessages m
                    JOIN Users s ON s.Id = m.SenderId
                    WHERE m.ReceiverId = ${userId} 
                      AND m.SentAt > ${since}
                    ORDER BY m.SentAt ASC`;
                
                context.res = { status: 200, headers, body: result.recordset };
                return;
            }
        }

        // POST - Send a new message
        if (method === 'POST') {
            const { senderId, receiverId, message } = req.body;
            
            if (!senderId || !receiverId || !message) {
                context.res = { status: 400, headers, body: { error: 'senderId, receiverId, and message required' } };
                return;
            }
            
            const result = await sql.query`
                INSERT INTO ChatMessages (SenderId, ReceiverId, Message, SentAt, IsRead)
                OUTPUT INSERTED.*
                VALUES (${senderId}, ${receiverId}, ${message}, GETDATE(), 0)`;
            
            context.res = { status: 201, headers, body: result.recordset[0] };
            return;
        }

        // PUT - Update online status
        if (method === 'PUT') {
            if (action === 'status') {
                const { userId, isOnline } = req.body;
                
                await sql.query`
                    UPDATE Users 
                    SET IsOnline = ${isOnline ? 1 : 0}, LastSeen = GETDATE()
                    WHERE Id = ${userId}`;
                
                context.res = { status: 200, headers, body: { success: true } };
                return;
            }
            
            // Mark all messages as read from a specific user
            if (action === 'markRead') {
                const { userId, otherUserId } = req.body;
                
                await sql.query`
                    UPDATE ChatMessages 
                    SET IsRead = 1, ReadAt = GETDATE()
                    WHERE SenderId = ${otherUserId} AND ReceiverId = ${userId} AND IsRead = 0`;
                
                context.res = { status: 200, headers, body: { success: true } };
                return;
            }
        }

        // DELETE - Delete a message
        if (method === 'DELETE' && messageId) {
            await sql.query`DELETE FROM ChatMessages WHERE Id = ${messageId}`;
            context.res = { status: 200, headers, body: { success: true } };
            return;
        }

        context.res = { status: 400, headers, body: { error: 'Invalid request' } };
        
    } catch (error) {
        context.log.error('Chat API Error:', error);
        context.res = {
            status: 500,
            headers,
            body: { error: 'Database error', details: error.message }
        };
    }
};
