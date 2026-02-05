-- Request comments for the Requests workflow

IF OBJECT_ID('dbo.RequestComments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestComments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        CommentText NVARCHAR(MAX) NOT NULL,
        CreatedBy NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestComments_CreatedAt DEFAULT (SYSDATETIME())
    );

    -- Optional FK (uncomment if dbo.Requests exists in your DB and you want hard referential integrity)
    -- ALTER TABLE dbo.RequestComments
    -- ADD CONSTRAINT FK_RequestComments_Requests
    -- FOREIGN KEY (RequestId) REFERENCES dbo.Requests(Id) ON DELETE CASCADE;

    CREATE INDEX IX_RequestComments_RequestId_CreatedAt
    ON dbo.RequestComments (RequestId, CreatedAt ASC);
END;
