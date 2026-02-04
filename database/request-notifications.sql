-- Request notifications for the Requests workflow
-- Stores status changes, reminders, escalations, etc. for a specific recipient user.

IF OBJECT_ID('dbo.RequestNotifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestNotifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        ToUser NVARCHAR(255) NOT NULL,
        FromUser NVARCHAR(255) NULL,
        NotificationType NVARCHAR(50) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestNotifications_CreatedAt DEFAULT (SYSDATETIME()),
        IsRead BIT NOT NULL CONSTRAINT DF_RequestNotifications_IsRead DEFAULT (0),
        ReadAt DATETIME2 NULL
    );

    -- Optional FK (uncomment if dbo.Requests exists in your DB and you want hard referential integrity)
    -- ALTER TABLE dbo.RequestNotifications
    -- ADD CONSTRAINT FK_RequestNotifications_Requests
    -- FOREIGN KEY (RequestId) REFERENCES dbo.Requests(Id) ON DELETE CASCADE;

    CREATE INDEX IX_RequestNotifications_ToUser_IsRead_CreatedAt
    ON dbo.RequestNotifications (ToUser, IsRead, CreatedAt DESC);
END;
