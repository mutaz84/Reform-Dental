-- ============================================================
-- Reform Dental - Black Sky support schema repair v2
-- Target database: ReformDental_BlackSky
--
-- Safe to rerun. Adds non-subscription support objects from the
-- original database export that are required by the deployed APIs.
-- It intentionally does NOT create subscription tables.
-- ============================================================

SET NOCOUNT ON;

PRINT '=== Black Sky support schema repair v2 ===';
PRINT 'Current database: ' + DB_NAME();

IF DB_NAME() <> N'ReformDental_BlackSky'
    PRINT 'WARNING: This script is intended for ReformDental_BlackSky. Check the database selector before continuing.';

-- ------------------------------------------------------------
-- Users columns required by chat, roles, login tracking, and API inserts.
-- ------------------------------------------------------------
IF COL_LENGTH('dbo.Users', 'IsOnline') IS NULL
    ALTER TABLE dbo.Users ADD IsOnline BIT NOT NULL CONSTRAINT DF_Users_IsOnline_BlackSky DEFAULT (0);
IF COL_LENGTH('dbo.Users', 'LastSeen') IS NULL
    ALTER TABLE dbo.Users ADD LastSeen DATETIME NULL;
IF COL_LENGTH('dbo.Users', 'RoleId') IS NULL
    ALTER TABLE dbo.Users ADD RoleId INT NULL;
IF COL_LENGTH('dbo.Users', 'Title') IS NULL
    ALTER TABLE dbo.Users ADD Title NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'FailedLoginAttempts') IS NULL
    ALTER TABLE dbo.Users ADD FailedLoginAttempts INT NOT NULL CONSTRAINT DF_Users_FailedLoginAttempts_BlackSky DEFAULT (0);
IF COL_LENGTH('dbo.Users', 'SubscriptionId') IS NULL
    ALTER TABLE dbo.Users ADD SubscriptionId INT NULL;

-- ------------------------------------------------------------
-- UserClinics: direct clinic membership for subscription-free tenancy.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NULL
BEGIN
    PRINT 'Creating UserClinics';
    CREATE TABLE dbo.UserClinics (
        UserId INT NOT NULL,
        ClinicId INT NOT NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_UserClinics_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserClinics PRIMARY KEY (UserId, ClinicId)
    );
END;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.UserClinics)
BEGIN
    INSERT INTO dbo.UserClinics (UserId, ClinicId)
    SELECT u.Id, c.Id
    FROM dbo.Users u
    CROSS JOIN dbo.Clinics c
    WHERE LOWER(u.Username) = N'admin'
      AND ISNULL(c.IsActive, 1) = 1;
END;

-- ------------------------------------------------------------
-- Clinic working hours. complete-schema.sql normally creates this;
-- these checks repair databases that were partially created.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.ClinicWorkingHours', N'U') IS NULL
BEGIN
    PRINT 'Creating ClinicWorkingHours';
    CREATE TABLE dbo.ClinicWorkingHours (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClinicId INT NOT NULL,
        DayKey NVARCHAR(20) NOT NULL,
        IsOpen BIT NOT NULL CONSTRAINT DF_ClinicWorkingHours_IsOpen_BlackSky DEFAULT (0),
        OpenTime TIME NULL,
        CloseTime TIME NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ClinicWorkingHours_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_ClinicWorkingHours_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Equipment service tickets. The current API expects GUID ids.
-- If v1 created the empty INT version, replace it with the GUID table.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.EquipmentServiceTickets', N'U') IS NOT NULL
   AND EXISTS (
        SELECT 1
        FROM sys.columns c
        JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID(N'dbo.EquipmentServiceTickets')
          AND c.name = N'Id'
          AND t.name <> N'uniqueidentifier'
   )
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.EquipmentServiceTickets)
    BEGIN
        PRINT 'Replacing empty INT EquipmentServiceTickets table with GUID schema';
        DROP TABLE dbo.EquipmentServiceTickets;
    END
    ELSE
    BEGIN
        PRINT 'WARNING: EquipmentServiceTickets has rows and a non-GUID Id. Review before converting.';
    END;
END;

IF OBJECT_ID(N'dbo.EquipmentServiceTickets', N'U') IS NULL
BEGIN
    PRINT 'Creating EquipmentServiceTickets';
    CREATE TABLE dbo.EquipmentServiceTickets (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_EquipmentServiceTickets_Id_BlackSky DEFAULT NEWID() PRIMARY KEY,
        EquipmentId INT NOT NULL,
        ServiceType NVARCHAR(30) NOT NULL CONSTRAINT DF_EquipmentServiceTickets_ServiceType_BlackSky DEFAULT N'Preventive',
        Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_EquipmentServiceTickets_Priority_BlackSky DEFAULT N'Medium',
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_EquipmentServiceTickets_Status_BlackSky DEFAULT N'Open',
        ScheduledDate DATE NULL,
        CompletedDate DATE NULL,
        Vendor NVARCHAR(120) NULL,
        Cost DECIMAL(12,2) NULL,
        Description NVARCHAR(500) NULL,
        Notes NVARCHAR(MAX) NULL,
        IsAutoGenerated BIT NOT NULL CONSTRAINT DF_EquipmentServiceTickets_IsAutoGenerated_BlackSky DEFAULT (0),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_EquipmentServiceTickets_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_EquipmentServiceTickets_UpdatedAt_BlackSky DEFAULT SYSUTCDATETIME(),
        Title NVARCHAR(200) NULL,
        Links NVARCHAR(MAX) NULL
    );
END;

-- ------------------------------------------------------------
-- Shift builder tables used inside Manage Schedules.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NULL
BEGIN
    PRINT 'Creating ShiftBuilderShifts';
    CREATE TABLE dbo.ShiftBuilderShifts (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ShiftDate DATE NULL,
        Title NVARCHAR(255) NOT NULL CONSTRAINT DF_ShiftBuilderShifts_Title_BlackSky DEFAULT N'Open Shift',
        Status NVARCHAR(40) NOT NULL CONSTRAINT DF_ShiftBuilderShifts_Status_BlackSky DEFAULT N'open',
        UseClinicDefaultTime BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_UseClinicDefaultTime_BlackSky DEFAULT (1),
        LinkMainCalendar BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_LinkMainCalendar_BlackSky DEFAULT (1),
        LinkMySchedule BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_LinkMySchedule_BlackSky DEFAULT (1),
        Notes NVARCHAR(MAX) NULL,
        CreatedByUserId INT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderShifts_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF OBJECT_ID(N'dbo.ShiftBuilderEmployeeRows', N'U') IS NULL
BEGIN
    PRINT 'Creating ShiftBuilderEmployeeRows';
    CREATE TABLE dbo.ShiftBuilderEmployeeRows (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ShiftId INT NOT NULL,
        EmployeeId INT NULL,
        RoleId INT NULL,
        RoleName NVARCHAR(120) NULL,
        ProviderId INT NULL,
        ClinicId INT NULL,
        RoomId INT NULL,
        AssistantUserId INT NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_SortOrder_BlackSky DEFAULT (0),
        Notes NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF OBJECT_ID(N'dbo.ShiftBuilderRowItems', N'U') IS NULL
BEGIN
    PRINT 'Creating ShiftBuilderRowItems';
    CREATE TABLE dbo.ShiftBuilderRowItems (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EmployeeShiftId INT NOT NULL,
        ItemType NVARCHAR(80) NOT NULL,
        ItemId INT NULL,
        ItemName NVARCHAR(255) NULL,
        PayloadJson NVARCHAR(MAX) NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_SortOrder_BlackSky DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

-- ------------------------------------------------------------
-- Request child tables used by the Requests workflow.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.RequestAttachments', N'U') IS NULL
BEGIN
    PRINT 'Creating RequestAttachments';
    CREATE TABLE dbo.RequestAttachments (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RequestId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        ContentType NVARCHAR(150) NOT NULL,
        SizeBytes INT NOT NULL,
        Data VARBINARY(MAX) NOT NULL,
        UploadedBy NVARCHAR(255) NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestAttachments_UploadedAt_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.RequestComments', N'U') IS NULL
BEGIN
    PRINT 'Creating RequestComments';
    CREATE TABLE dbo.RequestComments (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RequestId INT NOT NULL,
        CommentText NVARCHAR(MAX) NOT NULL,
        CreatedBy NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestComments_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.RequestNotifications', N'U') IS NULL
BEGIN
    PRINT 'Creating RequestNotifications';
    CREATE TABLE dbo.RequestNotifications (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RequestId INT NOT NULL,
        ToUser NVARCHAR(255) NOT NULL,
        FromUser NVARCHAR(255) NULL,
        NotificationType NVARCHAR(50) NOT NULL CONSTRAINT DF_RequestNotifications_Type_BlackSky DEFAULT N'update',
        Message NVARCHAR(1000) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestNotifications_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME(),
        IsRead BIT NOT NULL CONSTRAINT DF_RequestNotifications_IsRead_BlackSky DEFAULT (0),
        ReadAt DATETIME2 NULL
    );
END;

IF OBJECT_ID(N'dbo.RequestRoutingLog', N'U') IS NULL
BEGIN
    PRINT 'Creating RequestRoutingLog';
    CREATE TABLE dbo.RequestRoutingLog (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RequestId INT NOT NULL,
        EventType NVARCHAR(50) NOT NULL,
        Actor NVARCHAR(200) NULL,
        FromUser NVARCHAR(200) NULL,
        ToUser NVARCHAR(200) NULL,
        Message NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RequestRoutingLog_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Utility tickets used by /api/utility-tickets.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.UtilityTickets', N'U') IS NULL
BEGIN
    PRINT 'Creating UtilityTickets';
    CREATE TABLE dbo.UtilityTickets (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UtilityId INT NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        TicketType NVARCHAR(100) NULL,
        Status NVARCHAR(50) NULL CONSTRAINT DF_UtilityTickets_Status_BlackSky DEFAULT N'Open',
        Priority NVARCHAR(50) NULL CONSTRAINT DF_UtilityTickets_Priority_BlackSky DEFAULT N'Medium',
        Frequency NVARCHAR(50) NULL,
        TicketDate DATE NULL,
        TicketTime NVARCHAR(20) NULL,
        AssignedTo NVARCHAR(255) NULL,
        Cost DECIMAL(10,2) NULL,
        Description NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        CompletedDate DATE NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_UtilityTickets_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_UtilityTickets_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_UtilityTickets_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Stationary API self-repairs its table too, but creating it here
-- keeps fresh client databases quiet on first load.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.StationaryTemplates', N'U') IS NULL
BEGIN
    PRINT 'Creating StationaryTemplates';
    CREATE TABLE dbo.StationaryTemplates (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TemplateKey NVARCHAR(120) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        HeaderLine1 NVARCHAR(MAX) NULL,
        HeaderLine2 NVARCHAR(MAX) NULL,
        FooterText NVARCHAR(MAX) NULL,
        Elements NVARCHAR(MAX) NULL,
        ClinicId INT NULL,
        OwnerUsername NVARCHAR(100) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_StationaryTemplates_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_StationaryTemplates_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_StationaryTemplates_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        TemplateName NVARCHAR(255) NULL,
        TemplateJson NVARCHAR(MAX) NULL
    );
END;

PRINT '=== Black Sky support schema repair v2 complete ===';