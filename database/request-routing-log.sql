-- Routing / forwarding log for the Requests workflow

IF OBJECT_ID('dbo.RequestRoutingLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestRoutingLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        FromUser NVARCHAR(255) NULL,
        ToUser NVARCHAR(255) NOT NULL,
        Action NVARCHAR(50) NOT NULL, -- assigned | added | forwarded | removed
        Note NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestRoutingLog_CreatedAt DEFAULT (SYSDATETIME())
    );

    CREATE INDEX IX_RequestRoutingLog_RequestId_CreatedAt
    ON dbo.RequestRoutingLog (RequestId, CreatedAt DESC);
END;
