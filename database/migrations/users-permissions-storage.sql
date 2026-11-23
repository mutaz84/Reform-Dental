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

IF OBJECT_ID('dbo.UserPermissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserPermissions (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserPermissions PRIMARY KEY,
        UserId INT NOT NULL,
        CategoryKey NVARCHAR(100) NOT NULL,
        PermissionKey NVARCHAR(100) NOT NULL,
        AccessLevel NVARCHAR(20) NOT NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_UserPermissions_CreatedDate DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_UserPermissions_ModifiedDate DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_UserPermissions_Users_UserId FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
        CONSTRAINT CK_UserPermissions_AccessLevel CHECK (AccessLevel IN ('full', 'readonly', 'hidden')),
        CONSTRAINT UX_UserPermissions_User_Category_Permission UNIQUE (UserId, CategoryKey, PermissionKey)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserPermissions_UserId' AND object_id = OBJECT_ID('dbo.UserPermissions'))
BEGIN
    CREATE INDEX IX_UserPermissions_UserId ON dbo.UserPermissions(UserId);
END;

IF EXISTS (
    SELECT 1
    FROM dbo.Users
    WHERE Permissions IS NOT NULL
      AND LTRIM(RTRIM(Permissions)) <> ''
      AND ISJSON(Permissions) = 1
)
BEGIN
    ;WITH ParsedPermissions AS (
        SELECT
            u.Id AS UserId,
            CONVERT(NVARCHAR(100), category.[key]) AS CategoryKey,
            CONVERT(NVARCHAR(100), permissionItem.[key]) AS PermissionKey,
            LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(20), permissionItem.[value])))) AS AccessLevel
        FROM dbo.Users u
        CROSS APPLY OPENJSON(u.Permissions) category
        CROSS APPLY OPENJSON(category.[value]) permissionItem
        WHERE u.Permissions IS NOT NULL
          AND LTRIM(RTRIM(u.Permissions)) <> ''
          AND ISJSON(u.Permissions) = 1
          AND category.[type] = 5
          AND permissionItem.[value] IS NOT NULL
    ), CleanPermissions AS (
        SELECT UserId, CategoryKey, PermissionKey, AccessLevel
        FROM ParsedPermissions
        WHERE AccessLevel IN ('full', 'readonly', 'hidden')
    )
    MERGE dbo.UserPermissions AS target
    USING CleanPermissions AS source
        ON target.UserId = source.UserId
       AND target.CategoryKey = source.CategoryKey
       AND target.PermissionKey = source.PermissionKey
    WHEN MATCHED AND target.AccessLevel <> source.AccessLevel THEN
        UPDATE SET AccessLevel = source.AccessLevel, ModifiedDate = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (UserId, CategoryKey, PermissionKey, AccessLevel)
        VALUES (source.UserId, source.CategoryKey, source.PermissionKey, source.AccessLevel);
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

SELECT
    COUNT(DISTINCT UserId) AS UsersWithPermissionRows,
    COUNT(*) AS PermissionRows
FROM dbo.UserPermissions;
