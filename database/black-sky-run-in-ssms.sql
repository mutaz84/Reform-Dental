-- Reform Dental Black Sky SQL repair bundle
-- Run this in SSMS with database selected: ReformDental_BlackSky
-- Generated from black-sky-support-schema.sql, v2, and v3.


PRINT 'Running database\black-sky-support-schema.sql';
GO
-- ============================================================
-- Reform Dental - Black Sky support schema repair
-- Target database: ReformDental_BlackSky
--
-- Safe to rerun. This creates only missing support tables/columns
-- used by deployed APIs that still run in the black-sky starter.
-- It intentionally does NOT create subscription tables.
-- ============================================================

SET NOCOUNT ON;

PRINT '=== Black Sky support schema repair ===';

-- ------------------------------------------------------------
-- Settings
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Settings', N'U') IS NULL
BEGIN
    PRINT 'Creating Settings';
    CREATE TABLE dbo.Settings (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(MAX) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE SettingKey = N'companyName')
    INSERT INTO dbo.Settings (SettingKey, SettingValue) VALUES (N'companyName', N'Black Sky Dental');
IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE SettingKey = N'tagline')
    INSERT INTO dbo.Settings (SettingKey, SettingValue) VALUES (N'tagline', N'Management System');
IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE SettingKey = N'logoData')
    INSERT INTO dbo.Settings (SettingKey, SettingValue) VALUES (N'logoData', NULL);

-- ------------------------------------------------------------
-- Roles
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    PRINT 'Creating Roles';
    CREATE TABLE dbo.Roles (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RoleName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Duties NVARCHAR(MAX) NULL,
        Responsibilities NVARCHAR(MAX) NULL,
        FileUrl NVARCHAR(500) NULL,
        FileName NVARCHAR(255) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Users', 'RoleId') IS NULL
    ALTER TABLE dbo.Users ADD RoleId INT NULL;

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'Admin')
BEGIN
    INSERT INTO dbo.Roles (RoleName, Description, Duties, Responsibilities) VALUES
        (N'Admin', N'System Administrator', N'Full system management', N'Manage all aspects of the system'),
        (N'Dentist', N'Dental Provider', N'Patient care and treatment', N'Provide dental services'),
        (N'Hygienist', N'Dental Hygienist', N'Cleanings and preventive care', N'Perform dental cleanings'),
        (N'Assistant', N'Dental Assistant', N'Assist with procedures', N'Support providers during procedures'),
        (N'Receptionist', N'Front Desk Staff', N'Patient scheduling', N'Manage appointments'),
        (N'Office Manager', N'Office Administration', N'Office operations', N'Oversee daily operations');
END;

-- ------------------------------------------------------------
-- Requests
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Requests', N'U') IS NULL
BEGIN
    PRINT 'Creating Requests';
    CREATE TABLE dbo.Requests (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Type NVARCHAR(100) NULL,
        Priority NVARCHAR(50) NULL DEFAULT N'Medium',
        Status NVARCHAR(50) NULL DEFAULT N'New',
        RequestedBy NVARCHAR(200) NULL,
        AssignedTo NVARCHAR(200) NULL,
        NeededBy DATE NULL,
        Location NVARCHAR(255) NULL,
        Description NVARCHAR(MAX) NULL,
        RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Duties
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Duties', N'U') IS NULL
BEGIN
    PRINT 'Creating Duties';
    CREATE TABLE dbo.Duties (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Schedule NVARCHAR(50) NULL,
        ScheduleTime NVARCHAR(20) NULL,
        ScheduleDay NVARCHAR(50) NULL,
        Location NVARCHAR(100) NULL,
        Priority NVARCHAR(20) NULL DEFAULT N'Medium',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.UserDutyAssignments', N'U') IS NULL
BEGIN
    PRINT 'Creating UserDutyAssignments';
    CREATE TABLE dbo.UserDutyAssignments (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        DutyId INT NOT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Equipment service tickets
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.EquipmentServiceTickets', N'U') IS NULL
BEGIN
    PRINT 'Creating EquipmentServiceTickets';
    CREATE TABLE dbo.EquipmentServiceTickets (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EquipmentId INT NOT NULL,
        Title NVARCHAR(200) NULL,
        ServiceType NVARCHAR(30) NOT NULL DEFAULT N'Preventive',
        Priority NVARCHAR(20) NOT NULL DEFAULT N'Medium',
        Status NVARCHAR(20) NOT NULL DEFAULT N'Open',
        ScheduledDate DATE NULL,
        CompletedDate DATE NULL,
        Vendor NVARCHAR(120) NULL,
        Cost DECIMAL(12,2) NOT NULL DEFAULT 0,
        Description NVARCHAR(500) NULL,
        Notes NVARCHAR(MAX) NULL,
        IsAutoGenerated BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Chat and Copilot conversations
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
BEGIN
    PRINT 'Creating ChatMessages';
    CREATE TABLE dbo.ChatMessages (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SenderId INT NOT NULL,
        ReceiverId INT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        MessageType NVARCHAR(50) NOT NULL DEFAULT N'text',
        SentAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ReadAt DATETIME2 NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.ChatMessageAttachments', N'U') IS NULL
BEGIN
    PRINT 'Creating ChatMessageAttachments';
    CREATE TABLE dbo.ChatMessageAttachments (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MessageId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        ContentType NVARCHAR(200) NOT NULL,
        FileSize INT NOT NULL DEFAULT 0,
        FileData NVARCHAR(MAX) NOT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.CopilotConversations', N'U') IS NULL
BEGIN
    PRINT 'Creating CopilotConversations';
    CREATE TABLE dbo.CopilotConversations (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        ConversationId NVARCHAR(100) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.CopilotConversationMessages', N'U') IS NULL
BEGIN
    PRINT 'Creating CopilotConversationMessages';
    CREATE TABLE dbo.CopilotConversationMessages (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ConversationPkId INT NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        MessageOrder INT NOT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Sticky notes. complete-schema.sql creates this table, but older
-- versions may miss the PositionX/PositionY columns used by the API.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.StickyNotes', N'U') IS NULL
BEGIN
    PRINT 'Creating StickyNotes';
    CREATE TABLE dbo.StickyNotes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Content NVARCHAR(MAX) NOT NULL,
        Color NVARCHAR(20) NULL DEFAULT N'#fef3c7',
        UserId INT NULL,
        PositionX INT NULL DEFAULT 100,
        PositionY INT NULL DEFAULT 100,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
ELSE
BEGIN
    IF COL_LENGTH('dbo.StickyNotes', 'PositionX') IS NULL
        ALTER TABLE dbo.StickyNotes ADD PositionX INT NULL DEFAULT 100;
    IF COL_LENGTH('dbo.StickyNotes', 'PositionY') IS NULL
        ALTER TABLE dbo.StickyNotes ADD PositionY INT NULL DEFAULT 100;
END;

-- ------------------------------------------------------------
-- Attendance and PTO support tables used by current APIs.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.AttendanceRecords', N'U') IS NULL
BEGIN
    PRINT 'Creating AttendanceRecords';
    CREATE TABLE dbo.AttendanceRecords (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        LocalRecordId NVARCHAR(120) NULL,
        UserId INT NULL,
        Username NVARCHAR(150) NOT NULL,
        DisplayName NVARCHAR(255) NULL,
        WorkDate DATE NOT NULL,
        ScheduledStart TIME NULL,
        ScheduledEnd TIME NULL,
        ClockIn DATETIME2 NULL,
        ClockOut DATETIME2 NULL,
        MinutesWorked INT NOT NULL DEFAULT 0,
        FlagsJson NVARCHAR(MAX) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.AttendancePolicies', N'U') IS NULL
BEGIN
    PRINT 'Creating AttendancePolicies';
    CREATE TABLE dbo.AttendancePolicies (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL UNIQUE,
        AllowFlex BIT NOT NULL DEFAULT 0,
        BeforeMins INT NOT NULL DEFAULT 0,
        AfterMins INT NOT NULL DEFAULT 0,
        ModifiedBy NVARCHAR(255) NULL,
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.AttendanceAbsences', N'U') IS NULL
BEGIN
    PRINT 'Creating AttendanceAbsences';
    CREATE TABLE dbo.AttendanceAbsences (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        DisplayName NVARCHAR(255) NULL,
        WorkDate DATE NOT NULL,
        Reason NVARCHAR(500) NULL,
        RecordedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.AttendanceNotifications', N'U') IS NULL
BEGIN
    PRINT 'Creating AttendanceNotifications';
    CREATE TABLE dbo.AttendanceNotifications (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        NotificationType NVARCHAR(50) NOT NULL DEFAULT N'info',
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.PtoCredits', N'U') IS NULL
BEGIN
    PRINT 'Creating PtoCredits';
    CREATE TABLE dbo.PtoCredits (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL UNIQUE,
        CreditHours DECIMAL(10,2) NOT NULL DEFAULT 0,
        ModifiedBy NVARCHAR(255) NULL,
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.PtoRequests', N'U') IS NULL
BEGIN
    PRINT 'Creating PtoRequests';
    CREATE TABLE dbo.PtoRequests (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        EmployeeName NVARCHAR(255) NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        Hours DECIMAL(10,2) NOT NULL DEFAULT 0,
        Reason NVARCHAR(MAX) NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT N'pending',
        ReviewedBy NVARCHAR(255) NULL,
        ReviewedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

PRINT '=== Black Sky support schema repair complete ===';
GO

PRINT 'Running database\black-sky-support-schema-v2.sql';
GO
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
GO

PRINT 'Running database\black-sky-support-schema-v3.sql';
GO
-- ============================================================
-- Reform Dental - Black Sky support schema repair v3
-- Target database: ReformDental_BlackSky
--
-- Safe to rerun. Adds remaining non-subscription operational
-- tables/columns from the original reformdentaldb schema so the
-- Black Sky starter can behave like a new client database.
-- ============================================================

SET NOCOUNT ON;

PRINT '=== Black Sky support schema repair v3 ===';
PRINT 'Current database: ' + DB_NAME();

IF DB_NAME() <> N'ReformDental_BlackSky'
    PRINT 'WARNING: This script is intended for ReformDental_BlackSky. Check the database selector before continuing.';

-- ------------------------------------------------------------
-- Safe column repairs for core tables from complete-schema.sql.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Schedules', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Schedules', 'ProviderId') IS NULL ALTER TABLE dbo.Schedules ADD ProviderId INT NULL;
    IF COL_LENGTH('dbo.Schedules', 'EmployeeId') IS NULL ALTER TABLE dbo.Schedules ADD EmployeeId INT NULL;
    IF COL_LENGTH('dbo.Schedules', 'ShiftBuilderShiftId') IS NULL ALTER TABLE dbo.Schedules ADD ShiftBuilderShiftId INT NULL;
    IF COL_LENGTH('dbo.Schedules', 'ShiftBuilderEmployeeRowId') IS NULL ALTER TABLE dbo.Schedules ADD ShiftBuilderEmployeeRowId INT NULL;
END;

IF OBJECT_ID(N'dbo.Supplies', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Supplies', 'SupplyType') IS NULL ALTER TABLE dbo.Supplies ADD SupplyType NVARCHAR(20) NULL;
END;

IF OBJECT_ID(N'dbo.Equipment', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Equipment', 'VideoUrl') IS NULL ALTER TABLE dbo.Equipment ADD VideoUrl NVARCHAR(MAX) NULL;
END;

IF OBJECT_ID(N'dbo.Instruments', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Instruments', 'Links') IS NULL ALTER TABLE dbo.Instruments ADD Links NVARCHAR(MAX) NULL;
END;

-- ------------------------------------------------------------
-- Utilities.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Utilities', N'U') IS NULL
BEGIN
    PRINT 'Creating Utilities';
    CREATE TABLE dbo.Utilities (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UtilityName NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        Provider NVARCHAR(200) NULL,
        Service NVARCHAR(200) NULL,
        AccountNumber NVARCHAR(100) NULL,
        ServiceStartDate DATE NULL,
        ContractTerm NVARCHAR(50) NULL,
        ClinicId INT NULL,
        MonthlyCost DECIMAL(10,2) NULL,
        Notes NVARCHAR(MAX) NULL,
        Warnings NVARCHAR(MAX) NULL,
        ImageUrl NVARCHAR(MAX) NULL,
        DocumentUrl NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Utilities_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME NOT NULL CONSTRAINT DF_Utilities_CreatedDate_BlackSky DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME NULL
    );
END;

-- ------------------------------------------------------------
-- Split inventory tables from the original database.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.DentalSupplies', N'U') IS NULL
BEGIN
    PRINT 'Creating DentalSupplies';
    CREATE TABLE dbo.DentalSupplies (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        SKU NVARCHAR(100) NULL,
        Description NVARCHAR(1000) NULL,
        ClinicId INT NULL,
        RoomId INT NULL,
        QuantityInStock INT NOT NULL CONSTRAINT DF_DentalSupplies_Quantity_BlackSky DEFAULT (0),
        MinimumStock INT NOT NULL CONSTRAINT DF_DentalSupplies_Minimum_BlackSky DEFAULT (0),
        Unit NVARCHAR(50) NULL,
        UnitCost DECIMAL(18,2) NULL,
        StorageLocation NVARCHAR(200) NULL,
        VendorId INT NULL,
        ExpirationDate DATE NULL,
        Notes NVARCHAR(MAX) NULL,
        Warnings NVARCHAR(MAX) NULL,
        ImageUrl NVARCHAR(1000) NULL,
        DocumentUrl NVARCHAR(1000) NULL,
        IsSubscription BIT NOT NULL CONSTRAINT DF_DentalSupplies_IsSubscription_BlackSky DEFAULT (0),
        SubscriptionPaused BIT NOT NULL CONSTRAINT DF_DentalSupplies_SubscriptionPaused_BlackSky DEFAULT (0),
        Frequency NVARCHAR(20) NULL,
        FrequencyDays INT NULL,
        QuantityPerOrder INT NULL,
        NextOrderDate DATE NULL,
        LastAutoOrderDate DATETIME2 NULL,
        AutoVendorId INT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_DentalSupplies_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_DentalSupplies_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_DentalSupplies_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.OfficeSupplies', N'U') IS NULL
BEGIN
    PRINT 'Creating OfficeSupplies';
    CREATE TABLE dbo.OfficeSupplies (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        SKU NVARCHAR(100) NULL,
        Description NVARCHAR(1000) NULL,
        ClinicId INT NULL,
        RoomId INT NULL,
        QuantityInStock INT NOT NULL CONSTRAINT DF_OfficeSupplies_Quantity_BlackSky DEFAULT (0),
        MinimumStock INT NOT NULL CONSTRAINT DF_OfficeSupplies_Minimum_BlackSky DEFAULT (0),
        Unit NVARCHAR(50) NULL,
        UnitCost DECIMAL(18,2) NULL,
        StorageLocation NVARCHAR(200) NULL,
        VendorId INT NULL,
        ExpirationDate DATE NULL,
        Notes NVARCHAR(MAX) NULL,
        Warnings NVARCHAR(MAX) NULL,
        ImageUrl NVARCHAR(1000) NULL,
        DocumentUrl NVARCHAR(1000) NULL,
        IsSubscription BIT NOT NULL CONSTRAINT DF_OfficeSupplies_IsSubscription_BlackSky DEFAULT (0),
        SubscriptionPaused BIT NOT NULL CONSTRAINT DF_OfficeSupplies_SubscriptionPaused_BlackSky DEFAULT (0),
        Frequency NVARCHAR(20) NULL,
        FrequencyDays INT NULL,
        QuantityPerOrder INT NULL,
        NextOrderDate DATE NULL,
        LastAutoOrderDate DATETIME2 NULL,
        AutoVendorId INT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_OfficeSupplies_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_OfficeSupplies_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_OfficeSupplies_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Office equipment.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NULL
BEGIN
    PRINT 'Creating OfficeEquipment';
    CREATE TABLE dbo.OfficeEquipment (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(255) NULL,
        Category NVARCHAR(255) NULL,
        Brand NVARCHAR(255) NULL,
        Model NVARCHAR(255) NULL,
        SerialNumber NVARCHAR(255) NULL,
        Description NVARCHAR(MAX) NULL,
        Condition NVARCHAR(100) NULL,
        Status NVARCHAR(100) NULL CONSTRAINT DF_OfficeEquipment_Status_BlackSky DEFAULT N'Operational',
        ClinicId INT NULL,
        RoomId INT NULL,
        VendorId INT NULL,
        PurchaseDate DATE NULL,
        PurchasePrice DECIMAL(12,2) NULL,
        WarrantyExpiry DATE NULL,
        MaintenanceSchedule NVARCHAR(255) NULL,
        LastMaintenanceDate DATE NULL,
        NextMaintenanceDate DATE NULL,
        ServiceIntervalDays INT NULL,
        LastServiceDate DATE NULL,
        NextServiceDate DATE NULL,
        ServiceVendor NVARCHAR(255) NULL,
        Notes NVARCHAR(MAX) NULL,
        Warnings NVARCHAR(MAX) NULL,
        ImageUrl NVARCHAR(MAX) NULL,
        DocumentUrl NVARCHAR(MAX) NULL,
        IsActive BIT NULL CONSTRAINT DF_OfficeEquipment_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NULL CONSTRAINT DF_OfficeEquipment_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

-- ------------------------------------------------------------
-- File/document tables.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.EquipmentFiles', N'U') IS NULL
BEGIN
    PRINT 'Creating EquipmentFiles';
    CREATE TABLE dbo.EquipmentFiles (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DocumentId NVARCHAR(255) NOT NULL UNIQUE,
        EquipmentId INT NOT NULL,
        Name NVARCHAR(500) NOT NULL CONSTRAINT DF_EquipmentFiles_Name_BlackSky DEFAULT N'equipment-document',
        MimeType NVARCHAR(255) NULL,
        Data NVARCHAR(MAX) NOT NULL,
        UploadedAt DATETIME2 NULL,
        CreatedDate DATETIME2 NULL CONSTRAINT DF_EquipmentFiles_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.InstrumentAdjustments', N'U') IS NULL
BEGIN
    PRINT 'Creating InstrumentAdjustments';
    CREATE TABLE dbo.InstrumentAdjustments (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Timestamp] NVARCHAR(50) NOT NULL UNIQUE,
        InstrumentId INT NULL,
        ApiInstrumentId INT NULL,
        InstrumentName NVARCHAR(255) NULL,
        UserName NVARCHAR(255) NULL,
        PreviousQty INT NULL,
        NewQty INT NULL,
        ChangeQty INT NULL,
        PurchaseOrderId NVARCHAR(100) NULL,
        Reason NVARCHAR(255) NULL,
        ReasonNotes NVARCHAR(MAX) NULL,
        DocumentId NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NULL CONSTRAINT DF_InstrumentAdjustments_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME(),
        DocumentIds NVARCHAR(MAX) NULL,
        VendorName NVARCHAR(255) NULL,
        PoNumber NVARCHAR(100) NULL,
        UnitCost DECIMAL(18,2) NULL
    );
END;

IF OBJECT_ID(N'dbo.InstrumentFiles', N'U') IS NULL
BEGIN
    PRINT 'Creating InstrumentFiles';
    CREATE TABLE dbo.InstrumentFiles (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DocumentId NVARCHAR(255) NOT NULL UNIQUE,
        InstrumentId INT NULL,
        AdjustmentTimestamp NVARCHAR(50) NULL,
        PurchaseOrderId NVARCHAR(100) NULL,
        Name NVARCHAR(500) NOT NULL CONSTRAINT DF_InstrumentFiles_Name_BlackSky DEFAULT N'instrument-document',
        MimeType NVARCHAR(255) NULL,
        Size INT NULL,
        Data NVARCHAR(MAX) NOT NULL,
        UploadedAt DATETIME2 NULL,
        CreatedDate DATETIME2 NULL CONSTRAINT DF_InstrumentFiles_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Purchase orders.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.PurchaseOrders', N'U') IS NULL
BEGIN
    PRINT 'Creating PurchaseOrders';
    CREATE TABLE dbo.PurchaseOrders (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClientId NVARCHAR(100) NOT NULL UNIQUE,
        InstrumentId INT NULL,
        Quantity INT NULL,
        VendorId NVARCHAR(50) NULL,
        VendorName NVARCHAR(255) NULL,
        PoNumber NVARCHAR(100) NULL,
        UnitCost DECIMAL(18,4) NULL,
        TotalCost DECIMAL(18,4) NULL,
        OrderDate DATE NULL,
        Notes NVARCHAR(MAX) NULL,
        DocumentId NVARCHAR(255) NULL,
        CreatedBy NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NULL,
        ModifiedDate DATETIME2 NULL CONSTRAINT DF_PurchaseOrders_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        OrderNumber NVARCHAR(100) NULL,
        ClinicId INT NULL,
        Status NVARCHAR(30) NOT NULL CONSTRAINT DF_PurchaseOrders_Status_BlackSky DEFAULT N'Draft',
        ExpectedDate DATE NULL,
        ReceivedDate DATETIME2 NULL,
        Subtotal DECIMAL(18,4) NULL CONSTRAINT DF_PurchaseOrders_Subtotal_BlackSky DEFAULT (0),
        Tax DECIMAL(18,4) NULL CONSTRAINT DF_PurchaseOrders_Tax_BlackSky DEFAULT (0),
        Shipping DECIMAL(18,4) NULL CONSTRAINT DF_PurchaseOrders_Shipping_BlackSky DEFAULT (0),
        Total DECIMAL(18,4) NULL CONSTRAINT DF_PurchaseOrders_Total_BlackSky DEFAULT (0),
        IsAutoGenerated BIT NULL CONSTRAINT DF_PurchaseOrders_IsAutoGenerated_BlackSky DEFAULT (0),
        CreatedDate DATETIME2 NULL CONSTRAINT DF_PurchaseOrders_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        SupplyType NVARCHAR(20) NULL,
        SupplyId INT NULL
    );
END;

IF OBJECT_ID(N'dbo.PurchaseOrderItems', N'U') IS NULL
BEGIN
    PRINT 'Creating PurchaseOrderItems';
    CREATE TABLE dbo.PurchaseOrderItems (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PurchaseOrderId INT NOT NULL,
        SupplyType NVARCHAR(10) NOT NULL,
        SupplyId INT NOT NULL,
        SupplyName NVARCHAR(200) NULL,
        Quantity INT NOT NULL,
        UnitCost DECIMAL(18,2) NULL,
        LineTotal DECIMAL(18,2) NULL
    );
END;

-- ------------------------------------------------------------
-- Teams and team events.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Teams', N'U') IS NULL
BEGIN
    PRINT 'Creating Teams';
    CREATE TABLE dbo.Teams (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TeamName NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        Description NVARCHAR(1000) NULL,
        TeamLeadId NVARCHAR(100) NULL,
        TeamLeadName NVARCHAR(200) NULL,
        Members NVARCHAR(MAX) NULL,
        OfficeId NVARCHAR(50) NULL,
        Schedule NVARCHAR(200) NULL,
        ImageData NVARCHAR(MAX) NULL,
        DocumentData NVARCHAR(MAX) NULL,
        DocumentName NVARCHAR(500) NULL,
        Notes NVARCHAR(MAX) NULL,
        Warnings NVARCHAR(MAX) NULL,
        OperationsLog NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Teams_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Teams_CreatedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_Teams_ModifiedDate_BlackSky DEFAULT SYSUTCDATETIME(),
        SubscriptionId INT NULL
    );
END;

IF OBJECT_ID(N'dbo.TeamEvents', N'U') IS NULL
BEGIN
    PRINT 'Creating TeamEvents';
    CREATE TABLE dbo.TeamEvents (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TeamId INT NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        EventType NVARCHAR(100) NOT NULL CONSTRAINT DF_TeamEvents_EventType_BlackSky DEFAULT N'Meeting',
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_TeamEvents_Status_BlackSky DEFAULT N'Scheduled',
        Priority NVARCHAR(50) NOT NULL CONSTRAINT DF_TeamEvents_Priority_BlackSky DEFAULT N'Medium',
        EventDate DATE NULL,
        EventTime NVARCHAR(20) NULL,
        Frequency NVARCHAR(50) NOT NULL CONSTRAINT DF_TeamEvents_Frequency_BlackSky DEFAULT N'One-Time',
        Location NVARCHAR(255) NULL,
        AssignedMembers NVARCHAR(MAX) NULL,
        Description NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        Attachments NVARCHAR(MAX) NULL,
        DocumentUrl NVARCHAR(MAX) NULL,
        CompletedDate DATE NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_TeamEvents_IsActive_BlackSky DEFAULT (1),
        CreatedDate DATETIME NOT NULL CONSTRAINT DF_TeamEvents_CreatedDate_BlackSky DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME NULL,
        SubscriptionId INT NULL
    );
END;

-- ------------------------------------------------------------
-- HR detail tables used by Users API.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.UserHRInfo', N'U') IS NULL
BEGIN
    PRINT 'Creating UserHRInfo';
    CREATE TABLE dbo.UserHRInfo (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL UNIQUE,
        HRData NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME(),
        LastUpdated DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_LastUpdated_BlackSky DEFAULT SYSUTCDATETIME(),
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
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRInfo_UpdatedAt_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.UserHRBenefits', N'U') IS NULL
BEGIN
    PRINT 'Creating UserHRBenefits';
    CREATE TABLE dbo.UserHRBenefits (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserHRInfoId INT NOT NULL,
        BenefitKey NVARCHAR(150) NOT NULL,
        BenefitName NVARCHAR(200) NULL,
        IsEnabled BIT NOT NULL CONSTRAINT DF_UserHRBenefits_IsEnabled_BlackSky DEFAULT (0),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_CreatedAt_BlackSky DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserHRBenefits_UpdatedAt_BlackSky DEFAULT SYSUTCDATETIME()
    );
END;

-- ------------------------------------------------------------
-- Schedule email log.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.ScheduleEmailLog', N'U') IS NULL
BEGIN
    PRINT 'Creating ScheduleEmailLog';
    CREATE TABLE dbo.ScheduleEmailLog (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SentAt DATETIME2(0) NOT NULL CONSTRAINT DF_ScheduleEmailLog_SentAt_BlackSky DEFAULT SYSUTCDATETIME(),
        RequestedBy NVARCHAR(150) NULL,
        Recipients NVARCHAR(MAX) NOT NULL,
        RecipientCount INT NOT NULL,
        Subject NVARCHAR(300) NOT NULL,
        Status NVARCHAR(30) NOT NULL,
        ErrorMessage NVARCHAR(MAX) NULL
    );
END;

-- ------------------------------------------------------------
-- Helpful indexes. Each is safe to rerun.
-- ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Utilities', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Utilities') AND name = N'IX_Utilities_ClinicId')
    CREATE INDEX IX_Utilities_ClinicId ON dbo.Utilities(ClinicId);
IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.OfficeEquipment') AND name = N'IX_OfficeEquipment_ClinicId')
    CREATE INDEX IX_OfficeEquipment_ClinicId ON dbo.OfficeEquipment(ClinicId);
IF OBJECT_ID(N'dbo.DentalSupplies', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.DentalSupplies') AND name = N'IX_DentalSupplies_ClinicId')
    CREATE INDEX IX_DentalSupplies_ClinicId ON dbo.DentalSupplies(ClinicId);
IF OBJECT_ID(N'dbo.OfficeSupplies', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.OfficeSupplies') AND name = N'IX_OfficeSupplies_ClinicId')
    CREATE INDEX IX_OfficeSupplies_ClinicId ON dbo.OfficeSupplies(ClinicId);
IF OBJECT_ID(N'dbo.PurchaseOrderItems', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.PurchaseOrderItems') AND name = N'IX_PurchaseOrderItems_PurchaseOrderId')
    CREATE INDEX IX_PurchaseOrderItems_PurchaseOrderId ON dbo.PurchaseOrderItems(PurchaseOrderId);
IF OBJECT_ID(N'dbo.ScheduleEmailLog', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ScheduleEmailLog') AND name = N'IX_ScheduleEmailLog_SentAt')
    CREATE INDEX IX_ScheduleEmailLog_SentAt ON dbo.ScheduleEmailLog(SentAt DESC);

PRINT '=== Black Sky support schema repair v3 complete ===';
GO
