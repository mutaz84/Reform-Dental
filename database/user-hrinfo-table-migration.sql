-- Create independent HR info table linked 1:1 with Users.
-- Safe to run multiple times.

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    THROW 50000, 'dbo.Users table not found.', 1;
END;

IF OBJECT_ID('dbo.UserHRInfo', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserHRInfo (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        HRData NVARCHAR(MAX) NULL,
        LastUpdated DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_LastUpdated DEFAULT SYSUTCDATETIME(),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_CreatedAt DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_UserHRInfo_UserId'
      AND object_id = OBJECT_ID('dbo.UserHRInfo')
)
BEGIN
    CREATE UNIQUE INDEX UX_UserHRInfo_UserId ON dbo.UserHRInfo(UserId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_UserHRInfo_Users_UserId'
)
BEGIN
    ALTER TABLE dbo.UserHRInfo
    ADD CONSTRAINT FK_UserHRInfo_Users_UserId
        FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
        ON DELETE CASCADE;
END;

-- Backfill from legacy Users.HRInfo column if it exists and contains data.
IF COL_LENGTH('dbo.Users', 'HRInfo') IS NOT NULL
BEGIN
    MERGE dbo.UserHRInfo AS target
    USING (
        SELECT u.Id AS UserId, u.HRInfo AS HRData
        FROM dbo.Users u
        WHERE u.HRInfo IS NOT NULL
    ) AS source
    ON target.UserId = source.UserId
    WHEN MATCHED THEN
        UPDATE SET
            target.HRData = source.HRData,
            target.LastUpdated = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (UserId, HRData, LastUpdated, CreatedAt)
        VALUES (source.UserId, source.HRData, SYSUTCDATETIME(), SYSUTCDATETIME());
END;

-- Verification
SELECT TOP 20
    u.Id,
    u.Username,
    h.HRData,
    h.LastUpdated
FROM dbo.Users u
LEFT JOIN dbo.UserHRInfo h ON h.UserId = u.Id
ORDER BY u.Id DESC;
