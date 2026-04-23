/*
Compatibility rebuild script for Users + HRInfo.
- No TRY/CATCH/THROW (for editors/endpoints that fail parsing those blocks)
- Idempotent: safe to run multiple times
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    SELECT 'ERROR: dbo.Users table not found.' AS ErrorMessage;
    RETURN;
END;

BEGIN TRAN;

IF COL_LENGTH('dbo.Users', 'HRInfo') IS NULL
    ALTER TABLE dbo.Users ADD HRInfo NVARCHAR(MAX) NULL;

UPDATE u
SET
    StaffType = CASE
        WHEN u.StaffType IN ('clinical', 'non-clinical') THEN u.StaffType
        WHEN LOWER(ISNULL(u.StaffType, '')) IN ('clinical', 'provider', 'assistant') THEN 'clinical'
        ELSE 'non-clinical'
    END,
    EmployeeType = CASE
        WHEN u.EmployeeType IN ('provider', 'assistant') THEN u.EmployeeType
        WHEN LOWER(ISNULL(u.EmployeeType, '')) IN ('provider', 'doctor', 'dentist') THEN 'provider'
        WHEN LOWER(ISNULL(u.EmployeeType, '')) IN ('assistant', 'full-time', 'full time', 'part-time', 'part time', 'temp', 'temporary', 'contract') THEN 'assistant'
        WHEN LOWER(ISNULL(u.JobTitle, '')) LIKE '%dentist%' OR LOWER(ISNULL(u.JobTitle, '')) LIKE '%doctor%' THEN 'provider'
        WHEN LOWER(ISNULL(u.StaffType, '')) = 'clinical' THEN 'provider'
        ELSE 'assistant'
    END,
    EmployeeStatus = CASE
        WHEN u.EmployeeStatus IN ('Active', 'Inactive', 'On Leave', 'Terminated') THEN u.EmployeeStatus
        WHEN LOWER(ISNULL(u.EmployeeStatus, '')) = 'active' THEN 'Active'
        WHEN LOWER(ISNULL(u.EmployeeStatus, '')) = 'inactive' THEN 'Inactive'
        WHEN LOWER(ISNULL(u.EmployeeStatus, '')) IN ('on leave', 'onleave', 'leave') THEN 'On Leave'
        WHEN LOWER(ISNULL(u.EmployeeStatus, '')) = 'terminated' THEN 'Terminated'
        ELSE 'Active'
    END,
    Role = CASE
        WHEN u.Role IN ('user', 'manager', 'admin') THEN u.Role
        WHEN LOWER(ISNULL(u.Role, '')) IN ('user', 'manager', 'admin') THEN LOWER(u.Role)
        ELSE 'user'
    END,
    FailedLoginAttempts = CASE WHEN u.FailedLoginAttempts IS NULL OR u.FailedLoginAttempts < 0 THEN 0 ELSE u.FailedLoginAttempts END,
    HourlyRate = CASE WHEN u.HourlyRate < 0 THEN 0 ELSE u.HourlyRate END,
    Salary = CASE WHEN u.Salary < 0 THEN 0 ELSE u.Salary END,
    IsActive = ISNULL(u.IsActive, 1),
    IsOnline = ISNULL(u.IsOnline, 0),
    ModifiedDate = GETUTCDATE()
FROM dbo.Users u;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Users') AND c.name = 'Role'
)
    ALTER TABLE dbo.Users ADD CONSTRAINT DF_Users_Role DEFAULT ('user') FOR Role;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Users') AND c.name = 'IsActive'
)
    ALTER TABLE dbo.Users ADD CONSTRAINT DF_Users_IsActive DEFAULT ((1)) FOR IsActive;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Users') AND c.name = 'IsOnline'
)
    ALTER TABLE dbo.Users ADD CONSTRAINT DF_Users_IsOnline DEFAULT ((0)) FOR IsOnline;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Users') AND c.name = 'FailedLoginAttempts'
)
    ALTER TABLE dbo.Users ADD CONSTRAINT DF_Users_FailedLoginAttempts DEFAULT ((0)) FOR FailedLoginAttempts;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_EmployeeType' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_EmployeeType;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_EmployeeType CHECK (EmployeeType IN ('provider', 'assistant'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_StaffType' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_StaffType;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_StaffType CHECK (StaffType IN ('clinical', 'non-clinical'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_EmployeeStatus' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_EmployeeStatus;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_EmployeeStatus CHECK (EmployeeStatus IN ('Active', 'Inactive', 'On Leave', 'Terminated'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Role;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_Role CHECK (Role IN ('user', 'manager', 'admin'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_FailedLoginAttempts' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_FailedLoginAttempts;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_FailedLoginAttempts CHECK (FailedLoginAttempts >= 0);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_HourlyRate' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_HourlyRate;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_HourlyRate CHECK (HourlyRate IS NULL OR HourlyRate >= 0);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Salary' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Salary;
ALTER TABLE dbo.Users WITH CHECK ADD CONSTRAINT CK_Users_Salary CHECK (Salary IS NULL OR Salary >= 0);

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

IF COL_LENGTH('dbo.UserHRInfo', 'UserId') IS NULL ALTER TABLE dbo.UserHRInfo ADD UserId INT NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'HRDataJson') IS NULL ALTER TABLE dbo.UserHRInfo ADD HRDataJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'BenefitsJson') IS NULL ALTER TABLE dbo.UserHRInfo ADD BenefitsJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'LastUpdated') IS NULL ALTER TABLE dbo.UserHRInfo ADD LastUpdated DATETIME2(3) NULL;
IF COL_LENGTH('dbo.UserHRInfo', 'CreatedAt') IS NULL ALTER TABLE dbo.UserHRInfo ADD CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_CreatedAt_2 DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.UserHRInfo', 'UpdatedAt') IS NULL ALTER TABLE dbo.UserHRInfo ADD UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_UpdatedAt_2 DEFAULT SYSUTCDATETIME();

;WITH d AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY UserId ORDER BY COALESCE(UpdatedAt, CreatedAt, LastUpdated, SYSUTCDATETIME()) DESC, Id DESC) rn
    FROM dbo.UserHRInfo
    WHERE UserId IS NOT NULL
)
DELETE FROM d WHERE rn > 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_UserHRInfo_UserId' AND object_id = OBJECT_ID('dbo.UserHRInfo')
)
    CREATE UNIQUE INDEX UX_UserHRInfo_UserId ON dbo.UserHRInfo(UserId);

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_UserHRInfo_Users_UserId' AND parent_object_id = OBJECT_ID('dbo.UserHRInfo')
)
    ALTER TABLE dbo.UserHRInfo ADD CONSTRAINT FK_UserHRInfo_Users_UserId FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE;

IF OBJECT_ID('dbo.UserHRBenefits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserHRBenefits (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserHRBenefits PRIMARY KEY,
        UserHRInfoId INT NOT NULL,
        BenefitKey NVARCHAR(150) NOT NULL,
        BenefitName NVARCHAR(200) NULL,
        IsEnabled BIT NOT NULL CONSTRAINT DF_UserHRBenefits_IsEnabled DEFAULT ((0)),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;

IF COL_LENGTH('dbo.UserHRBenefits', 'BenefitName') IS NULL ALTER TABLE dbo.UserHRBenefits ADD BenefitName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.UserHRBenefits', 'CreatedAt') IS NULL ALTER TABLE dbo.UserHRBenefits ADD CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_CreatedAt_2 DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.UserHRBenefits', 'UpdatedAt') IS NULL ALTER TABLE dbo.UserHRBenefits ADD UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_UpdatedAt_2 DEFAULT SYSUTCDATETIME();

;WITH d AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY UserHRInfoId, BenefitKey ORDER BY COALESCE(UpdatedAt, CreatedAt, SYSUTCDATETIME()) DESC, Id DESC) rn
    FROM dbo.UserHRBenefits
)
DELETE FROM d WHERE rn > 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_UserHRBenefits_UserHRInfoId_BenefitKey' AND object_id = OBJECT_ID('dbo.UserHRBenefits')
)
    CREATE UNIQUE INDEX UX_UserHRBenefits_UserHRInfoId_BenefitKey ON dbo.UserHRBenefits(UserHRInfoId, BenefitKey);

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_UserHRBenefits_UserHRInfo_UserHRInfoId' AND parent_object_id = OBJECT_ID('dbo.UserHRBenefits')
)
    ALTER TABLE dbo.UserHRBenefits ADD CONSTRAINT FK_UserHRBenefits_UserHRInfo_UserHRInfoId FOREIGN KEY (UserHRInfoId) REFERENCES dbo.UserHRInfo(Id) ON DELETE CASCADE;

;WITH src AS (
    SELECT u.Id AS UserId, u.HRInfo AS HrJson
    FROM dbo.Users u
    WHERE u.HRInfo IS NOT NULL AND ISJSON(u.HRInfo) = 1
)
MERGE dbo.UserHRInfo AS target
USING (
    SELECT
        s.UserId,
        s.HrJson,
        JSON_VALUE(s.HrJson, '$.employmentType') AS EmploymentType,
        JSON_VALUE(s.HrJson, '$.activeStatus') AS ActiveStatus,
        JSON_VALUE(s.HrJson, '$.payType') AS PayType,
        TRY_CONVERT(DECIMAL(12,2), JSON_VALUE(s.HrJson, '$.salary')) AS Salary,
        TRY_CONVERT(DECIMAL(10,2), JSON_VALUE(s.HrJson, '$.hourlyRate')) AS HourlyRate,
        TRY_CONVERT(DECIMAL(6,2), JSON_VALUE(s.HrJson, '$.expectedHours')) AS ExpectedHours,
        TRY_CONVERT(DATE, JSON_VALUE(s.HrJson, '$.benefitStartDate')) AS BenefitStartDate,
        TRY_CONVERT(DATE, JSON_VALUE(s.HrJson, '$.benefitEndDate')) AS BenefitEndDate,
        JSON_VALUE(s.HrJson, '$.notes') AS Notes,
        JSON_QUERY(s.HrJson, '$.benefits') AS BenefitsJson,
        TRY_CONVERT(DATETIME2(3), JSON_VALUE(s.HrJson, '$.lastUpdated')) AS LastUpdated,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, '$.benefits.health_insurance'), JSON_VALUE(s.HrJson, '$.benefits.health'), 'false')) IN ('true','1') THEN 1 ELSE 0 END AS HealthInsurance,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, '$.benefits.dental_insurance'), JSON_VALUE(s.HrJson, '$.benefits.dental'), 'false')) IN ('true','1') THEN 1 ELSE 0 END AS DentalInsurance,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, '$.benefits.vision_insurance'), JSON_VALUE(s.HrJson, '$.benefits.vision'), 'false')) IN ('true','1') THEN 1 ELSE 0 END AS VisionInsurance,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, '$.benefits.401_k_retirement'), JSON_VALUE(s.HrJson, '$.benefits.retirement'), 'false')) IN ('true','1') THEN 1 ELSE 0 END AS Retirement401K,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, '$.benefits.paid_time_off'), JSON_VALUE(s.HrJson, '$.benefits.pto'), 'false')) IN ('true','1') THEN 1 ELSE 0 END AS PaidTimeOff,
        CASE WHEN LOWER(COALESCE(JSON_VALUE(s.HrJson, '$.benefits.life_insurance'), JSON_VALUE(s.HrJson, '$.benefits.life'), 'false')) IN ('true','1') THEN 1 ELSE 0 END AS LifeInsurance
    FROM src s
) AS source
ON target.UserId = source.UserId
WHEN MATCHED THEN UPDATE SET
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
WHEN NOT MATCHED THEN INSERT (
    UserId, EmploymentType, ActiveStatus, PayType, Salary, HourlyRate, ExpectedHours,
    BenefitStartDate, BenefitEndDate, Notes,
    HealthInsurance, DentalInsurance, VisionInsurance, Retirement401K, PaidTimeOff, LifeInsurance,
    BenefitsJson, HRDataJson, LastUpdated, CreatedAt, UpdatedAt
) VALUES (
    source.UserId, source.EmploymentType, source.ActiveStatus, source.PayType, source.Salary, source.HourlyRate, source.ExpectedHours,
    source.BenefitStartDate, source.BenefitEndDate, source.Notes,
    source.HealthInsurance, source.DentalInsurance, source.VisionInsurance, source.Retirement401K, source.PaidTimeOff, source.LifeInsurance,
    source.BenefitsJson, source.HrJson, COALESCE(source.LastUpdated, SYSUTCDATETIME()), SYSUTCDATETIME(), SYSUTCDATETIME()
);

COMMIT;

SELECT
    COUNT(*) AS TotalUsers,
    SUM(CASE WHEN EmployeeType NOT IN ('provider', 'assistant') OR EmployeeType IS NULL THEN 1 ELSE 0 END) AS InvalidEmployeeType,
    SUM(CASE WHEN StaffType NOT IN ('clinical', 'non-clinical') OR StaffType IS NULL THEN 1 ELSE 0 END) AS InvalidStaffType,
    SUM(CASE WHEN EmployeeStatus NOT IN ('Active', 'Inactive', 'On Leave', 'Terminated') OR EmployeeStatus IS NULL THEN 1 ELSE 0 END) AS InvalidEmployeeStatus,
    SUM(CASE WHEN Role NOT IN ('user', 'manager', 'admin') OR Role IS NULL THEN 1 ELSE 0 END) AS InvalidRole
FROM dbo.Users;

SELECT TOP 50
    u.Id,
    u.Username,
    u.StaffType,
    u.EmployeeType,
    u.EmployeeStatus,
    u.Role,
    h.LastUpdated,
    h.UpdatedAt
FROM dbo.Users u
LEFT JOIN dbo.UserHRInfo h ON h.UserId = u.Id
ORDER BY u.Id DESC;
