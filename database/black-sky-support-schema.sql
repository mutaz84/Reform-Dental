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