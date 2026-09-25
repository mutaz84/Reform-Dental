-- Users permissions storage migration and diagnostics
-- Run in the Reform Dental SQL database.

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    THROW 50000, 'dbo.Users table not found.', 1;
END;

IF COL_LENGTH('dbo.Users', 'Permissions') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD Permissions NVARCHAR(MAX) NULL;
END;

SELECT
    COUNT(*) AS TotalUsers,
    SUM(CASE WHEN Permissions IS NULL OR LTRIM(RTRIM(Permissions)) = '' THEN 1 ELSE 0 END) AS MissingPermissions,
    SUM(CASE WHEN Permissions IS NOT NULL AND LTRIM(RTRIM(Permissions)) <> '' AND ISJSON(Permissions) <> 1 THEN 1 ELSE 0 END) AS InvalidPermissionJson,
    SUM(CASE WHEN Permissions IS NOT NULL AND LTRIM(RTRIM(Permissions)) <> '' AND ISJSON(Permissions) = 1 THEN 1 ELSE 0 END) AS UsersWithPermissionJson
FROM dbo.Users;

SELECT
    Id,
    Username,
    Role,
    IsActive,
    CASE
        WHEN Permissions IS NULL OR LTRIM(RTRIM(Permissions)) = '' THEN 'missing'
        WHEN ISJSON(Permissions) <> 1 THEN 'invalid-json'
        ELSE 'json-present'
    END AS PermissionStatus,
    LEN(Permissions) AS PermissionLength,
    ModifiedDate
FROM dbo.Users
WHERE Permissions IS NULL
   OR LTRIM(RTRIM(Permissions)) = ''
   OR ISJSON(Permissions) <> 1
ORDER BY Username, Id;

SELECT
    LOWER(LTRIM(RTRIM(Username))) AS NormalizedUsername,
    COUNT(*) AS DuplicateCount,
    STRING_AGG(CONVERT(VARCHAR(20), Id), ',') AS UserIds
FROM dbo.Users
WHERE Username IS NOT NULL AND LTRIM(RTRIM(Username)) <> ''
GROUP BY LOWER(LTRIM(RTRIM(Username)))
HAVING COUNT(*) > 1
ORDER BY NormalizedUsername;
