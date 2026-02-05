-- Request attachments for the Requests workflow
-- Stores attachment binary in SQL (VARBINARY(MAX)). For large files, consider Azure Blob Storage instead.

IF OBJECT_ID('dbo.RequestAttachments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestAttachments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        ContentType NVARCHAR(150) NOT NULL,
        SizeBytes INT NOT NULL,
        Data VARBINARY(MAX) NOT NULL,
        UploadedBy NVARCHAR(255) NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestAttachments_UploadedAt DEFAULT (SYSDATETIME())
    );

    -- Optional FK (uncomment if dbo.Requests exists in your DB and you want hard referential integrity)
    -- ALTER TABLE dbo.RequestAttachments
    -- ADD CONSTRAINT FK_RequestAttachments_Requests
    -- FOREIGN KEY (RequestId) REFERENCES dbo.Requests(Id) ON DELETE CASCADE;

    CREATE INDEX IX_RequestAttachments_RequestId_UploadedAt
    ON dbo.RequestAttachments (RequestId, UploadedAt ASC);
END;
