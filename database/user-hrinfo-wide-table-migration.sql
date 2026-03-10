SET NOCOUNT ON;

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    THROW 50000, 'dbo.Users table not found.', 1;
END;

IF OBJECT_ID('dbo.UserHRInfo', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserHRInfo (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserHRInfo PRIMARY KEY,
        UserId INT NOT NULL,
        EmploymentType NVARCHAR(100) NULL,
        ActiveStatus NVARCHAR(50) NULL,
        PayType NVARCHAR(50) NULL,
        Salary DECIMAL(12,2) NULL,
        HourlyRate DECIMAL(10,2) NULL,
        ExpectedHours DECIMAL(6,2) NULL,
        BenefitStartDate DATE NULL,
        BenefitEndDate DATE NULL,
        Notes NVARCHAR(MAX) NULL,
        HealthInsurance BIT NULL,
        DentalInsurance BIT NULL,
        VisionInsurance BIT NULL,
        Retirement401K BIT NULL,
        PaidTimeOff BIT NULL,
        LifeInsurance BIT NULL,
        BenefitsJson NVARCHAR(MAX) NULL,
        HRDataJson NVARCHAR(MAX) NULL,
        LastUpdated DATETIME2(3) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;

IF COL_LENGTH('dbo.UserHRInfo', 'EmploymentType') IS NULL ALTER TABLE dbo.UserHRInfo ADD EmploymentType NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'ActiveStatus') IS NULL ALTER TABLE dbo.UserHRInfo ADD ActiveStatus NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'PayType') IS NULL ALTER TABLE dbo.UserHRInfo ADD PayType NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'Salary') IS NULL ALTER TABLE dbo.UserHRInfo ADD Salary DECIMAL(12,2) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'HourlyRate') IS NULL ALTER TABLE dbo.UserHRInfo ADD HourlyRate DECIMAL(10,2) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'ExpectedHours') IS NULL ALTER TABLE dbo.UserHRInfo ADD ExpectedHours DECIMAL(6,2) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'BenefitStartDate') IS NULL ALTER TABLE dbo.UserHRInfo ADD BenefitStartDate DATE NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'BenefitEndDate') IS NULL ALTER TABLE dbo.UserHRInfo ADD BenefitEndDate DATE NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'Notes') IS NULL ALTER TABLE dbo.UserHRInfo ADD Notes NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'HealthInsurance') IS NULL ALTER TABLE dbo.UserHRInfo ADD HealthInsurance BIT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'DentalInsurance') IS NULL ALTER TABLE dbo.UserHRInfo ADD DentalInsurance BIT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'VisionInsurance') IS NULL ALTER TABLE dbo.UserHRInfo ADD VisionInsurance BIT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'Retirement401K') IS NULL ALTER TABLE dbo.UserHRInfo ADD Retirement401K BIT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'PaidTimeOff') IS NULL ALTER TABLE dbo.UserHRInfo ADD PaidTimeOff BIT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'LifeInsurance') IS NULL ALTER TABLE dbo.UserHRInfo ADD LifeInsurance BIT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'BenefitsJson') IS NULL ALTER TABLE dbo.UserHRInfo ADD BenefitsJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'HRDataJson') IS NULL ALTER TABLE dbo.UserHRInfo ADD HRDataJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'LastUpdated') IS NULL ALTER TABLE dbo.UserHRInfo ADD LastUpdated DATETIME2(3) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'CreatedAt') IS NULL ALTER TABLE dbo.UserHRInfo ADD CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_CreatedAt2 DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.UserHRInfo', 'UpdatedAt') IS NULL ALTER TABLE dbo.UserHRInfo ADD UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_UpdatedAt2 DEFAULT SYSUTCDATETIME();

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
      AND parent_object_id = OBJECT_ID('dbo.UserHRInfo')
)
BEGIN
    ALTER TABLE dbo.UserHRInfo
    ADD CONSTRAINT FK_UserHRInfo_Users_UserId
        FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
        ON DELETE CASCADE;
END;

IF OBJECT_ID('dbo.UserHRBenefits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserHRBenefits (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserHRBenefits PRIMARY KEY,
        UserHRInfoId INT NOT NULL,
        BenefitKey NVARCHAR(150) NOT NULL,
        BenefitName NVARCHAR(200) NULL,
        IsEnabled BIT NOT NULL CONSTRAINT DF_UserHRBenefits_IsEnabled DEFAULT 0,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;

IF COL_LENGTH('dbo.UserHRBenefits', 'BenefitName') IS NULL ALTER TABLE dbo.UserHRBenefits ADD BenefitName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.UserHRBenefits', 'CreatedAt') IS NULL ALTER TABLE dbo.UserHRBenefits ADD CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_CreatedAt2 DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.UserHRBenefits', 'UpdatedAt') IS NULL ALTER TABLE dbo.UserHRBenefits ADD UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_UpdatedAt2 DEFAULT SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_UserHRBenefits_UserHRInfoId_BenefitKey'
      AND object_id = OBJECT_ID('dbo.UserHRBenefits')
)
BEGIN
    CREATE UNIQUE INDEX UX_UserHRBenefits_UserHRInfoId_BenefitKey
    ON dbo.UserHRBenefits(UserHRInfoId, BenefitKey);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_UserHRBenefits_UserHRInfo_UserHRInfoId'
      AND parent_object_id = OBJECT_ID('dbo.UserHRBenefits')
)
BEGIN
    ALTER TABLE dbo.UserHRBenefits
    ADD CONSTRAINT FK_UserHRBenefits_UserHRInfo_UserHRInfoId
        FOREIGN KEY (UserHRInfoId) REFERENCES dbo.UserHRInfo(Id)
        ON DELETE CASCADE;
END;

DECLARE @hasUsersHrInfo BIT = CASE WHEN COL_LENGTH('dbo.Users', 'HRInfo') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasUserHrJson BIT = CASE WHEN COL_LENGTH('dbo.UserHRInfo', 'HRDataJson') IS NOT NULL THEN 1 ELSE 0 END;

DECLARE @hrExpr NVARCHAR(200) =
    CASE
        WHEN @hasUsersHrInfo = 1 AND @hasUserHrJson = 1 THEN 'COALESCE(h.HRDataJson, u.HRInfo)'
        WHEN @hasUsersHrInfo = 1 AND @hasUserHrJson = 0 THEN 'u.HRInfo'
        WHEN @hasUsersHrInfo = 0 AND @hasUserHrJson = 1 THEN 'h.HRDataJson'
        ELSE 'NULL'
    END;

DECLARE @sql NVARCHAR(MAX) = N'
;WITH src AS (
    SELECT
        u.Id AS UserId,
        ' + @hrExpr + N' AS HrJson
    FROM dbo.Users u
    LEFT JOIN dbo.UserHRInfo h ON h.UserId = u.Id
    WHERE ' + @hrExpr + N' IS NOT NULL
)
MERGE dbo.UserHRInfo AS target
USING (
    SELECT
        s.UserId,
        s.HrJson,
        JSON_VALUE(s.HrJson, ''$.employmentType'') AS EmploymentType,
        JSON_VALUE(s.HrJson, ''$.activeStatus'') AS ActiveStatus,
        JSON_VALUE(s.HrJson, ''$.payType'') AS PayType,
        TRY_CONVERT(DECIMAL(12,2), JSON_VALUE(s.HrJson, ''$.salary'')) AS Salary,
        TRY_CONVERT(DECIMAL(10,2), JSON_VALUE(s.HrJson, ''$.hourlyRate'')) AS HourlyRate,
        TRY_CONVERT(DECIMAL(6,2), JSON_VALUE(s.HrJson, ''$.expectedHours'')) AS ExpectedHours,
        TRY_CONVERT(DATE, JSON_VALUE(s.HrJson, ''$.benefitStartDate'')) AS BenefitStartDate,
        TRY_CONVERT(DATE, JSON_VALUE(s.HrJson, ''$.benefitEndDate'')) AS BenefitEndDate,
        JSON_VALUE(s.HrJson, ''$.notes'') AS Notes,
        JSON_QUERY(s.HrJson, ''$.benefits'') AS BenefitsJson,
        TRY_CONVERT(DATETIME2(3), JSON_VALUE(s.HrJson, ''$.lastUpdated'')) AS LastUpdated,

        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, ''$.benefits.health_insurance''), JSON_VALUE(s.HrJson, ''$.benefits.health''), ''false'')) IN (''true'',''1'') THEN 1 ELSE 0 END AS HealthInsurance,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, ''$.benefits.dental_insurance''), JSON_VALUE(s.HrJson, ''$.benefits.dental''), ''false'')) IN (''true'',''1'') THEN 1 ELSE 0 END AS DentalInsurance,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, ''$.benefits.vision_insurance''), JSON_VALUE(s.HrJson, ''$.benefits.vision''), ''false'')) IN (''true'',''1'') THEN 1 ELSE 0 END AS VisionInsurance,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, ''$.benefits.401_k_retirement''), JSON_VALUE(s.HrJson, ''$.benefits.retirement''), ''false'')) IN (''true'',''1'') THEN 1 ELSE 0 END AS Retirement401K,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, ''$.benefits.paid_time_off''), JSON_VALUE(s.HrJson, ''$.benefits.pto''), ''false'')) IN (''true'',''1'') THEN 1 ELSE 0 END AS PaidTimeOff,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, ''$.benefits.life_insurance''), JSON_VALUE(s.HrJson, ''$.benefits.life''), ''false'')) IN (''true'',''1'') THEN 1 ELSE 0 END AS LifeInsurance
    FROM src s
) AS source
ON target.UserId = source.UserId
WHEN MATCHED THEN
    UPDATE SET
        target.EmploymentType = source.EmploymentType,
        target.ActiveStatus = source.ActiveStatus,
        target.PayType = source.PayType,
        target.Salary = source.Salary,
        target.HourlyRate = source.HourlyRate,
        target.ExpectedHours = source.ExpectedHours,
        target.BenefitStartDate = source.BenefitStartDate,
        target.BenefitEndDate = source.BenefitEndDate,
        target.Notes = source.Notes,
        target.HealthInsurance = source.HealthInsurance,
        target.DentalInsurance = source.DentalInsurance,
        target.VisionInsurance = source.VisionInsurance,
        target.Retirement401K = source.Retirement401K,
        target.PaidTimeOff = source.PaidTimeOff,
        target.LifeInsurance = source.LifeInsurance,
        target.BenefitsJson = source.BenefitsJson,
        target.HRDataJson = source.HrJson,
        target.LastUpdated = COALESCE(source.LastUpdated, SYSUTCDATETIME()),
        target.UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (
        UserId, EmploymentType, ActiveStatus, PayType, Salary, HourlyRate, ExpectedHours,
        BenefitStartDate, BenefitEndDate, Notes,
        HealthInsurance, DentalInsurance, VisionInsurance, Retirement401K, PaidTimeOff, LifeInsurance,
        BenefitsJson, HRDataJson, LastUpdated, CreatedAt, UpdatedAt
    )
    VALUES (
        source.UserId, source.EmploymentType, source.ActiveStatus, source.PayType, source.Salary, source.HourlyRate, source.ExpectedHours,
        source.BenefitStartDate, source.BenefitEndDate, source.Notes,
        source.HealthInsurance, source.DentalInsurance, source.VisionInsurance, source.Retirement401K, source.PaidTimeOff, source.LifeInsurance,
        source.BenefitsJson, source.HrJson, COALESCE(source.LastUpdated, SYSUTCDATETIME()), SYSUTCDATETIME(), SYSUTCDATETIME()
    );
';

EXEC sp_executesql @sql;

-- Backfill normalized benefits rows from HRDataJson/BenefitsJson.
DELETE b
FROM dbo.UserHRBenefits b
JOIN dbo.UserHRInfo h ON h.Id = b.UserHRInfoId
WHERE h.HRDataJson IS NOT NULL OR h.BenefitsJson IS NOT NULL;

INSERT INTO dbo.UserHRBenefits (UserHRInfoId, BenefitKey, BenefitName, IsEnabled, CreatedAt, UpdatedAt)
SELECT
    h.Id AS UserHRInfoId,
    j.[key] AS BenefitKey,
    REPLACE(UPPER(LEFT(j.[key], 1)) + SUBSTRING(j.[key], 2, 200), '_', ' ') AS BenefitName,
    CASE WHEN LOWER(COALESCE(CONVERT(NVARCHAR(20), j.[value]), 'false')) IN ('true', '1') THEN 1 ELSE 0 END AS IsEnabled,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
FROM dbo.UserHRInfo h
CROSS APPLY OPENJSON(COALESCE(JSON_QUERY(h.HRDataJson, '$.benefits'), h.BenefitsJson)) j
WHERE COALESCE(JSON_QUERY(h.HRDataJson, '$.benefits'), h.BenefitsJson) IS NOT NULL;

SELECT TOP 50
    u.Id,
    u.Username,
    h.EmploymentType,
    h.ActiveStatus,
    h.PayType,
    h.Salary,
    h.HourlyRate,
    h.ExpectedHours,
    h.BenefitStartDate,
    h.BenefitEndDate,
    h.HealthInsurance,
    h.DentalInsurance,
    h.VisionInsurance,
    h.Retirement401K,
    h.PaidTimeOff,
    h.LifeInsurance,
    h.LastUpdated,
    h.UpdatedAt
FROM dbo.Users u
LEFT JOIN dbo.UserHRInfo h ON h.UserId = u.Id
ORDER BY u.Id DESC;
