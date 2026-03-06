-- =============================================
-- Copilot Conversations Migration
-- Adds persistent cross-machine DentaBrain history tables
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CopilotConversations' AND xtype='U')
BEGIN
    CREATE TABLE CopilotConversations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        ConversationId NVARCHAR(100) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedDate DATETIME2 DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 DEFAULT SYSUTCDATETIME(),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CopilotConversations_User_Conversation' AND object_id = OBJECT_ID('CopilotConversations'))
BEGIN
    CREATE UNIQUE INDEX UX_CopilotConversations_User_Conversation
    ON CopilotConversations(UserId, ConversationId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CopilotConversations_User_ModifiedDate' AND object_id = OBJECT_ID('CopilotConversations'))
BEGIN
    CREATE INDEX IX_CopilotConversations_User_ModifiedDate
    ON CopilotConversations(UserId, ModifiedDate DESC);
END
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CopilotConversationMessages' AND xtype='U')
BEGIN
    CREATE TABLE CopilotConversationMessages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ConversationPkId INT NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        MessageOrder INT NOT NULL,
        CreatedDate DATETIME2 DEFAULT SYSUTCDATETIME(),
        FOREIGN KEY (ConversationPkId) REFERENCES CopilotConversations(Id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CopilotConversationMessages_Conversation_Order' AND object_id = OBJECT_ID('CopilotConversationMessages'))
BEGIN
    CREATE INDEX IX_CopilotConversationMessages_Conversation_Order
    ON CopilotConversationMessages(ConversationPkId, MessageOrder);
END
GO
