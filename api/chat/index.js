const sql = require('mssql');

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

function toInt(value) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toIsoString(value) {
    const parsed = new Date(value || Date.now());
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
}

function normalizeCopilotRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return role === 'assistant' ? 'assistant' : 'user';
}

function trimCopilotMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
        .map((item) => ({
            role: normalizeCopilotRole(item?.role),
            content: String(item?.content || '').trim(),
            timestamp: toIsoString(item?.timestamp)
        }))
        .filter((item) => item.content)
        .slice(-250);
}

async function getCopilotConversationDbId(userId, conversationId) {
    const result = await sql.query`
        SELECT TOP 1 Id
        FROM CopilotConversations
        WHERE UserId = ${userId} AND ConversationId = ${conversationId} AND ISNULL(IsDeleted, 0) = 0`;
    return result.recordset[0]?.Id || null;
}

async function upsertCopilotConversation({ userId, conversationId, title, createdAt, updatedAt, messages }) {
    const safeConversationId = String(conversationId || '').trim();
    if (!safeConversationId) {
        throw new Error('conversationId required');
    }

    const safeTitle = String(title || '').trim() || 'New conversation';
    const safeCreatedAt = toIsoString(createdAt);
    const safeUpdatedAt = toIsoString(updatedAt);
    const safeMessages = trimCopilotMessages(messages);

    let dbConversationId = await getCopilotConversationDbId(userId, safeConversationId);
    if (!dbConversationId) {
        const insertConversation = await sql.query`
            INSERT INTO CopilotConversations (UserId, ConversationId, Title, CreatedDate, ModifiedDate, IsDeleted)
            OUTPUT INSERTED.Id
            VALUES (${userId}, ${safeConversationId}, ${safeTitle}, ${safeCreatedAt}, ${safeUpdatedAt}, 0)`;
        dbConversationId = insertConversation.recordset[0]?.Id || null;
    } else {
        await sql.query`
            UPDATE CopilotConversations
            SET Title = ${safeTitle},
                ModifiedDate = ${safeUpdatedAt},
                IsDeleted = 0
            WHERE Id = ${dbConversationId}`;

        await sql.query`DELETE FROM CopilotConversationMessages WHERE ConversationPkId = ${dbConversationId}`;
    }

    for (let i = 0; i < safeMessages.length; i += 1) {
        const item = safeMessages[i];
        await sql.query`
            INSERT INTO CopilotConversationMessages (ConversationPkId, Role, Content, MessageOrder, CreatedDate)
            VALUES (${dbConversationId}, ${item.role}, ${item.content}, ${i + 1}, ${item.timestamp})`;
    }

    return {
        id: safeConversationId,
        title: safeTitle,
        createdAt: safeCreatedAt,
        updatedAt: safeUpdatedAt,
        messages: safeMessages
    };
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
            if (action === 'copilotConversations') {
                const userId = toInt(req.query.userId);
                if (!Number.isInteger(userId)) {
                    context.res = { status: 400, headers, body: { error: 'userId required' } };
                    return;
                }

                const result = await sql.query`
                    SELECT
                        c.ConversationId,
                        c.Title,
                        c.CreatedDate,
                        c.ModifiedDate,
                        COUNT(m.Id) AS MessageCount
                    FROM CopilotConversations c
                    LEFT JOIN CopilotConversationMessages m ON m.ConversationPkId = c.Id
                    WHERE c.UserId = ${userId} AND ISNULL(c.IsDeleted, 0) = 0
                    GROUP BY c.ConversationId, c.Title, c.CreatedDate, c.ModifiedDate
                    ORDER BY c.ModifiedDate DESC`;

                const sessions = (result.recordset || []).map((row) => ({
                    id: String(row.ConversationId || ''),
                    title: String(row.Title || 'New conversation'),
                    createdAt: row.CreatedDate,
                    updatedAt: row.ModifiedDate,
                    messageCount: Number(row.MessageCount || 0)
                }));

                context.res = { status: 200, headers, body: sessions };
                return;
            }

            if (action === 'copilotConversation') {
                const userId = toInt(req.query.userId);
                const conversationId = String(req.query.conversationId || '').trim();
                if (!Number.isInteger(userId) || !conversationId) {
                    context.res = { status: 400, headers, body: { error: 'userId and conversationId required' } };
                    return;
                }

                const convo = await sql.query`
                    SELECT TOP 1 Id, ConversationId, Title, CreatedDate, ModifiedDate
                    FROM CopilotConversations
                    WHERE UserId = ${userId} AND ConversationId = ${conversationId} AND ISNULL(IsDeleted, 0) = 0`;
                const row = convo.recordset[0];
                if (!row) {
                    context.res = { status: 404, headers, body: { error: 'Conversation not found' } };
                    return;
                }

                const messagesResult = await sql.query`
                    SELECT Role, Content, CreatedDate
                    FROM CopilotConversationMessages
                    WHERE ConversationPkId = ${row.Id}
                    ORDER BY MessageOrder ASC, Id ASC`;

                const messages = (messagesResult.recordset || []).map((item) => ({
                    role: normalizeCopilotRole(item.Role),
                    content: String(item.Content || ''),
                    timestamp: item.CreatedDate
                }));

                context.res = {
                    status: 200,
                    headers,
                    body: {
                        id: String(row.ConversationId || ''),
                        title: String(row.Title || 'New conversation'),
                        createdAt: row.CreatedDate,
                        updatedAt: row.ModifiedDate,
                        messages
                    }
                };
                return;
            }

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
            if (action === 'copilotConversation') {
                const userId = toInt(req.body?.userId);
                if (!Number.isInteger(userId)) {
                    context.res = { status: 400, headers, body: { error: 'userId required' } };
                    return;
                }

                const payload = await upsertCopilotConversation({
                    userId,
                    conversationId: req.body?.conversationId,
                    title: req.body?.title,
                    createdAt: req.body?.createdAt,
                    updatedAt: req.body?.updatedAt,
                    messages: req.body?.messages
                });

                context.res = { status: 201, headers, body: payload };
                return;
            }

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
        if (method === 'DELETE' && action === 'copilotConversation') {
            const userId = toInt(req.query.userId);
            const conversationId = String(req.query.conversationId || '').trim();
            if (!Number.isInteger(userId) || !conversationId) {
                context.res = { status: 400, headers, body: { error: 'userId and conversationId required' } };
                return;
            }

            await sql.query`
                UPDATE CopilotConversations
                SET IsDeleted = 1,
                    ModifiedDate = SYSUTCDATETIME()
                WHERE UserId = ${userId} AND ConversationId = ${conversationId}`;

            context.res = { status: 200, headers, body: { success: true } };
            return;
        }

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
