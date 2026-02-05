-- Requests workflow main table

IF OBJECT_ID('dbo.Requests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Requests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Type NVARCHAR(100) NULL,
        Priority NVARCHAR(50) NULL,
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Requests_Status DEFAULT ('New'),
        RequestedBy NVARCHAR(255) NULL,
        AssignedTo NVARCHAR(MAX) NULL, -- can be a single username or a comma-separated / JSON list
        NeededBy DATE NULL,
        Location NVARCHAR(255) NULL,
        Equipment NVARCHAR(255) NULL,
        Vendor NVARCHAR(255) NULL,
        Description NVARCHAR(MAX) NULL,
        RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_Requests_RequestedAt DEFAULT (SYSDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Requests_UpdatedAt DEFAULT (SYSDATETIME())
    );

    CREATE INDEX IX_Requests_RequestedAt
    ON dbo.Requests (RequestedAt DESC);

    CREATE INDEX IX_Requests_Status
    ON dbo.Requests (Status);
END;

-- Backfill/upgrade existing Requests table (safe no-op if already upgraded)
IF OBJECT_ID('dbo.Requests', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Requests', 'Equipment') IS NULL
        ALTER TABLE dbo.Requests ADD Equipment NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.Requests', 'Vendor') IS NULL
        ALTER TABLE dbo.Requests ADD Vendor NVARCHAR(255) NULL;
END;
