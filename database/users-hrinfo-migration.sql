-- Add HRInfo JSON storage to Users table for API-backed HR modal persistence.
-- Safe to run multiple times.

IF COL_LENGTH('dbo.Users', 'HRInfo') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD HRInfo NVARCHAR(MAX) NULL;
END;

-- Optional verification
SELECT TOP 1 Id, Username, HRInfo
FROM dbo.Users
ORDER BY Id DESC;
