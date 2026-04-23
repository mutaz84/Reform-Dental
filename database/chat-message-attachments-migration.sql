IF OBJECT_ID('dbo.ChatMessageAttachments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatMessageAttachments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MessageId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        ContentType NVARCHAR(200) NOT NULL,
        FileSize INT NOT NULL DEFAULT 0,
        FileData NVARCHAR(MAX) NOT NULL,
        CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ChatMessageAttachments_Message FOREIGN KEY (MessageId) REFERENCES dbo.ChatMessages(Id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ChatMessageAttachments_MessageId'
      AND object_id = OBJECT_ID('dbo.ChatMessageAttachments')
)
BEGIN
    CREATE INDEX IX_ChatMessageAttachments_MessageId ON dbo.ChatMessageAttachments(MessageId);
END
GO
