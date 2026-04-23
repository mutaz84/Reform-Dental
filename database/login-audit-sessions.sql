-- Login session tracking + audit history
-- Run this script once on your Azure SQL database.

IF OBJECT_ID('dbo.UserLoginSessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserLoginSessions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SessionId NVARCHAR(120) NOT NULL,
        UserId INT NULL,
        Username NVARCHAR(120) NOT NULL,
        DisplayName NVARCHAR(200) NULL,
        UserRole NVARCHAR(60) NULL,
        Source NVARCHAR(60) NULL,
        LoginAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        LastSeenAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        LogoutAt DATETIME2(3) NULL,
        LogoutReason NVARCHAR(80) NULL,
        ForcedLogoutAt DATETIME2(3) NULL,
        ForcedBy NVARCHAR(120) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_UserLoginSessions_SessionId UNIQUE (SessionId)
    );
END;

IF OBJECT_ID('dbo.UserLoginAudit', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserLoginAudit (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        SessionId NVARCHAR(120) NULL,
        UserId INT NULL,
        Username NVARCHAR(120) NOT NULL,
        DisplayName NVARCHAR(200) NULL,
        UserRole NVARCHAR(60) NULL,
        EventType NVARCHAR(80) NOT NULL,
        EventSource NVARCHAR(60) NULL,
        EventAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        ForcedBy NVARCHAR(120) NULL,
        Note NVARCHAR(400) NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserLoginSessions_Active_LastSeen' AND object_id = OBJECT_ID('dbo.UserLoginSessions'))
BEGIN
    CREATE INDEX IX_UserLoginSessions_Active_LastSeen
        ON dbo.UserLoginSessions(IsActive, LastSeenAt DESC)
        INCLUDE (SessionId, Username, DisplayName, UserRole, LoginAt, ForcedLogoutAt, ForcedBy);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserLoginSessions_Username' AND object_id = OBJECT_ID('dbo.UserLoginSessions'))
BEGIN
    CREATE INDEX IX_UserLoginSessions_Username
        ON dbo.UserLoginSessions(Username)
        INCLUDE (SessionId, IsActive, LastSeenAt, ForcedLogoutAt);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserLoginAudit_EventAt' AND object_id = OBJECT_ID('dbo.UserLoginAudit'))
BEGIN
    CREATE INDEX IX_UserLoginAudit_EventAt
        ON dbo.UserLoginAudit(EventAt DESC)
        INCLUDE (Username, DisplayName, UserRole, EventType, SessionId, ForcedBy);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserLoginAudit_Username_EventAt' AND object_id = OBJECT_ID('dbo.UserLoginAudit'))
BEGIN
    CREATE INDEX IX_UserLoginAudit_Username_EventAt
        ON dbo.UserLoginAudit(Username, EventAt DESC)
        INCLUDE (EventType, SessionId, ForcedBy);
END;
