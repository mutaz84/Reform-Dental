-- ============================================================
-- Reform Dental - Black Sky Starter Test Data Seed
-- Target: ReformDental_BlackSky / Reform Dental SQL database
-- Safe to rerun. Creates realistic starter records for clinics, rooms,
-- users, schedules, equipment, supplies, requests, tasks, and dashboard landing.
-- ============================================================

SET NOCOUNT ON;

PRINT '=== Black Sky starter test data seed ===';

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    PRINT 'Creating Users';
    CREATE TABLE dbo.Users (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(50) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        FirstName NVARCHAR(100) NULL,
        LastName NVARCHAR(100) NULL,
        WorkEmail NVARCHAR(255) NULL,
        JobTitle NVARCHAR(100) NULL,
        StaffType NVARCHAR(50) NULL,
        Department NVARCHAR(100) NULL,
        EmployeeStatus NVARCHAR(50) NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT N'user',
        Color NVARCHAR(20) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsOnline BIT NOT NULL DEFAULT 0,
        FailedLoginAttempts INT NOT NULL DEFAULT 0
    );
END;

IF COL_LENGTH('dbo.Users', 'PasswordHash') IS NULL ALTER TABLE dbo.Users ADD PasswordHash NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Users', 'FirstName') IS NULL ALTER TABLE dbo.Users ADD FirstName NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'LastName') IS NULL ALTER TABLE dbo.Users ADD LastName NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'WorkEmail') IS NULL ALTER TABLE dbo.Users ADD WorkEmail NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Users', 'JobTitle') IS NULL ALTER TABLE dbo.Users ADD JobTitle NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'StaffType') IS NULL ALTER TABLE dbo.Users ADD StaffType NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Users', 'Department') IS NULL ALTER TABLE dbo.Users ADD Department NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'EmployeeStatus') IS NULL ALTER TABLE dbo.Users ADD EmployeeStatus NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Users', 'Role') IS NULL ALTER TABLE dbo.Users ADD Role NVARCHAR(50) NOT NULL CONSTRAINT DF_Users_Role_DashboardSeed DEFAULT N'user';
IF COL_LENGTH('dbo.Users', 'Color') IS NULL ALTER TABLE dbo.Users ADD Color NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Users', 'CreatedDate') IS NULL ALTER TABLE dbo.Users ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Users', 'ModifiedDate') IS NULL ALTER TABLE dbo.Users ADD ModifiedDate DATETIME2 NULL;
IF COL_LENGTH('dbo.Users', 'IsActive') IS NULL ALTER TABLE dbo.Users ADD IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.Users', 'IsOnline') IS NULL ALTER TABLE dbo.Users ADD IsOnline BIT NOT NULL CONSTRAINT DF_Users_IsOnline_DashboardSeed DEFAULT 0;
IF COL_LENGTH('dbo.Users', 'FailedLoginAttempts') IS NULL ALTER TABLE dbo.Users ADD FailedLoginAttempts INT NOT NULL CONSTRAINT DF_Users_FailedLoginAttempts_DashboardSeed DEFAULT 0;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NULL
BEGIN
    PRINT 'Creating Clinics';
    CREATE TABLE dbo.Clinics (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Address NVARCHAR(255) NULL,
        City NVARCHAR(100) NULL,
        State NVARCHAR(50) NULL,
        ZipCode NVARCHAR(20) NULL,
        Phone NVARCHAR(20) NULL,
        MainPhone NVARCHAR(20) NULL,
        AfterHoursPhone NVARCHAR(20) NULL,
        Fax NVARCHAR(20) NULL,
        Email NVARCHAR(255) NULL,
        Website NVARCHAR(255) NULL,
        DefaultDentist NVARCHAR(200) NULL,
        TaxonomyNumber NVARCHAR(50) NULL,
        ClinicNPI NVARCHAR(50) NULL,
        ClinicTIN NVARCHAR(50) NULL,
        LegalName NVARCHAR(255) NULL,
        LegalAddress NVARCHAR(500) NULL,
        Status NVARCHAR(50) NULL,
        OperatingHours NVARCHAR(MAX) NULL,
        Color NVARCHAR(20) NULL,
        Icon NVARCHAR(50) NULL,
        Description NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Clinics', 'Address') IS NULL ALTER TABLE dbo.Clinics ADD Address NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Clinics', 'City') IS NULL ALTER TABLE dbo.Clinics ADD City NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Clinics', 'State') IS NULL ALTER TABLE dbo.Clinics ADD State NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Clinics', 'ZipCode') IS NULL ALTER TABLE dbo.Clinics ADD ZipCode NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Clinics', 'Phone') IS NULL ALTER TABLE dbo.Clinics ADD Phone NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Clinics', 'MainPhone') IS NULL ALTER TABLE dbo.Clinics ADD MainPhone NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Clinics', 'AfterHoursPhone') IS NULL ALTER TABLE dbo.Clinics ADD AfterHoursPhone NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Clinics', 'Fax') IS NULL ALTER TABLE dbo.Clinics ADD Fax NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Clinics', 'Email') IS NULL ALTER TABLE dbo.Clinics ADD Email NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Clinics', 'Website') IS NULL ALTER TABLE dbo.Clinics ADD Website NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Clinics', 'DefaultDentist') IS NULL ALTER TABLE dbo.Clinics ADD DefaultDentist NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Clinics', 'TaxonomyNumber') IS NULL ALTER TABLE dbo.Clinics ADD TaxonomyNumber NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Clinics', 'ClinicNPI') IS NULL ALTER TABLE dbo.Clinics ADD ClinicNPI NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Clinics', 'ClinicTIN') IS NULL ALTER TABLE dbo.Clinics ADD ClinicTIN NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Clinics', 'LegalName') IS NULL ALTER TABLE dbo.Clinics ADD LegalName NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Clinics', 'LegalAddress') IS NULL ALTER TABLE dbo.Clinics ADD LegalAddress NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Clinics', 'Status') IS NULL ALTER TABLE dbo.Clinics ADD Status NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Clinics', 'OperatingHours') IS NULL ALTER TABLE dbo.Clinics ADD OperatingHours NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Clinics', 'Color') IS NULL ALTER TABLE dbo.Clinics ADD Color NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Clinics', 'Icon') IS NULL ALTER TABLE dbo.Clinics ADD Icon NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Clinics', 'Description') IS NULL ALTER TABLE dbo.Clinics ADD Description NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Clinics', 'IsActive') IS NULL ALTER TABLE dbo.Clinics ADD IsActive BIT NOT NULL CONSTRAINT DF_Clinics_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.Clinics', 'CreatedDate') IS NULL ALTER TABLE dbo.Clinics ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Clinics_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Clinics', 'ModifiedDate') IS NULL ALTER TABLE dbo.Clinics ADD ModifiedDate DATETIME2 NULL;

IF OBJECT_ID(N'dbo.Rooms', N'U') IS NULL
BEGIN
    PRINT 'Creating Rooms';
    CREATE TABLE dbo.Rooms (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClinicId INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        RoomType NVARCHAR(50) NULL,
        Description NVARCHAR(MAX) NULL,
        Color NVARCHAR(20) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Rooms', 'ClinicId') IS NULL ALTER TABLE dbo.Rooms ADD ClinicId INT NULL;
IF COL_LENGTH('dbo.Rooms', 'Name') IS NULL ALTER TABLE dbo.Rooms ADD Name NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Rooms', 'RoomType') IS NULL ALTER TABLE dbo.Rooms ADD RoomType NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Rooms', 'Description') IS NULL ALTER TABLE dbo.Rooms ADD Description NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Rooms', 'Color') IS NULL ALTER TABLE dbo.Rooms ADD Color NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Rooms', 'IsActive') IS NULL ALTER TABLE dbo.Rooms ADD IsActive BIT NOT NULL CONSTRAINT DF_Rooms_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.Rooms', 'CreatedDate') IS NULL ALTER TABLE dbo.Rooms ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Rooms_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Rooms', 'ModifiedDate') IS NULL ALTER TABLE dbo.Rooms ADD ModifiedDate DATETIME2 NULL;

IF OBJECT_ID(N'dbo.Schedules', N'U') IS NULL
BEGIN
    PRINT 'Creating Schedules';
    CREATE TABLE dbo.Schedules (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        ClinicId INT NOT NULL,
        RoomId INT NULL,
        AssistantId INT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NULL,
        StartTime TIME NOT NULL,
        EndTime TIME NOT NULL,
        DaysOfWeek NVARCHAR(100) NULL,
        Color NVARCHAR(20) NULL,
        Notes NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Schedules', 'UserId') IS NULL ALTER TABLE dbo.Schedules ADD UserId INT NULL;
IF COL_LENGTH('dbo.Schedules', 'ClinicId') IS NULL ALTER TABLE dbo.Schedules ADD ClinicId INT NULL;
IF COL_LENGTH('dbo.Schedules', 'RoomId') IS NULL ALTER TABLE dbo.Schedules ADD RoomId INT NULL;
IF COL_LENGTH('dbo.Schedules', 'AssistantId') IS NULL ALTER TABLE dbo.Schedules ADD AssistantId INT NULL;
IF COL_LENGTH('dbo.Schedules', 'StartDate') IS NULL ALTER TABLE dbo.Schedules ADD StartDate DATE NULL;
IF COL_LENGTH('dbo.Schedules', 'EndDate') IS NULL ALTER TABLE dbo.Schedules ADD EndDate DATE NULL;
IF COL_LENGTH('dbo.Schedules', 'StartTime') IS NULL ALTER TABLE dbo.Schedules ADD StartTime TIME NULL;
IF COL_LENGTH('dbo.Schedules', 'EndTime') IS NULL ALTER TABLE dbo.Schedules ADD EndTime TIME NULL;
IF COL_LENGTH('dbo.Schedules', 'DaysOfWeek') IS NULL ALTER TABLE dbo.Schedules ADD DaysOfWeek NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Schedules', 'Color') IS NULL ALTER TABLE dbo.Schedules ADD Color NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Schedules', 'Notes') IS NULL ALTER TABLE dbo.Schedules ADD Notes NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Schedules', 'IsActive') IS NULL ALTER TABLE dbo.Schedules ADD IsActive BIT NOT NULL CONSTRAINT DF_Schedules_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.Schedules', 'CreatedDate') IS NULL ALTER TABLE dbo.Schedules ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Schedules_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Schedules', 'ModifiedDate') IS NULL ALTER TABLE dbo.Schedules ADD ModifiedDate DATETIME2 NULL;

IF OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NULL
BEGIN
    PRINT 'Creating ShiftBuilderShifts';
    CREATE TABLE dbo.ShiftBuilderShifts (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ShiftDate DATE NULL,
        Title NVARCHAR(255) NOT NULL DEFAULT N'Open Shift',
        Status NVARCHAR(40) NOT NULL DEFAULT N'open',
        UseClinicDefaultTime BIT NOT NULL DEFAULT 1,
        LinkMainCalendar BIT NOT NULL DEFAULT 1,
        LinkMySchedule BIT NOT NULL DEFAULT 1,
        Notes NVARCHAR(MAX) NULL,
        CreatedByUserId INT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.ShiftBuilderShifts', 'ShiftDate') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD ShiftDate DATE NULL;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'Title') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD Title NVARCHAR(255) NOT NULL CONSTRAINT DF_ShiftBuilderShifts_Title_DashboardSeed DEFAULT N'Open Shift';
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'Status') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD Status NVARCHAR(40) NOT NULL CONSTRAINT DF_ShiftBuilderShifts_Status_DashboardSeed DEFAULT N'open';
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'UseClinicDefaultTime') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD UseClinicDefaultTime BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_UseClinicDefaultTime_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'LinkMainCalendar') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD LinkMainCalendar BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_LinkMainCalendar_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'LinkMySchedule') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD LinkMySchedule BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_LinkMySchedule_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'Notes') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD Notes NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'CreatedByUserId') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD CreatedByUserId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'IsActive') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'CreatedDate') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderShifts_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.ShiftBuilderShifts', 'ModifiedDate') IS NULL ALTER TABLE dbo.ShiftBuilderShifts ADD ModifiedDate DATETIME2 NULL;

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
        SortOrder INT NOT NULL DEFAULT 0,
        Notes NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'ShiftId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD ShiftId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'EmployeeId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD EmployeeId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'RoleId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD RoleId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'RoleName') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD RoleName NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'ProviderId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD ProviderId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'ClinicId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD ClinicId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'RoomId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD RoomId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'AssistantUserId') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD AssistantUserId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'SortOrder') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD SortOrder INT NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_SortOrder_DashboardSeed DEFAULT 0;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'Notes') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD Notes NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'IsActive') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'CreatedDate') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.ShiftBuilderEmployeeRows', 'ModifiedDate') IS NULL ALTER TABLE dbo.ShiftBuilderEmployeeRows ADD ModifiedDate DATETIME2 NULL;

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
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'EmployeeShiftId') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD EmployeeShiftId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'ItemType') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD ItemType NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'ItemId') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD ItemId INT NULL;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'ItemName') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD ItemName NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'PayloadJson') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD PayloadJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'SortOrder') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD SortOrder INT NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_SortOrder_DashboardSeed DEFAULT 0;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'IsActive') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_IsActive_DashboardSeed DEFAULT 1;
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'CreatedDate') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.ShiftBuilderRowItems', 'ModifiedDate') IS NULL ALTER TABLE dbo.ShiftBuilderRowItems ADD ModifiedDate DATETIME2 NULL;

-- Tenant visibility: APIs scope most records by UserClinics.
IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NULL
BEGIN
    PRINT 'Creating UserClinics';
    CREATE TABLE dbo.UserClinics (
        UserId INT NOT NULL,
        ClinicId INT NOT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserClinics PRIMARY KEY (UserId, ClinicId)
    );
END;

IF OBJECT_ID(N'dbo.DashboardSeedMemberships', N'U') IS NULL
BEGIN
    PRINT 'Creating DashboardSeedMemberships audit table';
    CREATE TABLE dbo.DashboardSeedMemberships (
        UserId INT NOT NULL,
        ClinicId INT NOT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_DashboardSeedMemberships PRIMARY KEY (UserId, ClinicId)
    );
END;

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

IF OBJECT_ID(N'dbo.Tasks', N'U') IS NULL
BEGIN
    PRINT 'Creating Tasks';
    CREATE TABLE dbo.Tasks (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Category NVARCHAR(100) NULL,
        Priority NVARCHAR(20) NOT NULL DEFAULT N'Medium',
        Status NVARCHAR(50) NOT NULL DEFAULT N'Pending',
        DueDate DATE NULL,
        DueTime NVARCHAR(10) NULL,
        AssignedToId INT NULL,
        AssignedById INT NULL,
        ClinicId INT NULL,
        TaskType NVARCHAR(50) NULL DEFAULT N'Regular',
        Location NVARCHAR(100) NULL,
        TimeEstimate NVARCHAR(50) NULL,
        Assignee NVARCHAR(100) NULL,
        ComplianceFlag BIT NOT NULL DEFAULT 0,
        LinkedComplianceTitle NVARCHAR(255) NULL,
        LinkedComplianceStatus NVARCHAR(50) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Tasks', 'DueTime') IS NULL ALTER TABLE dbo.Tasks ADD DueTime NVARCHAR(10) NULL;
IF COL_LENGTH('dbo.Tasks', 'AssignedToId') IS NULL ALTER TABLE dbo.Tasks ADD AssignedToId INT NULL;
IF COL_LENGTH('dbo.Tasks', 'AssignedById') IS NULL ALTER TABLE dbo.Tasks ADD AssignedById INT NULL;
IF COL_LENGTH('dbo.Tasks', 'ClinicId') IS NULL ALTER TABLE dbo.Tasks ADD ClinicId INT NULL;
IF COL_LENGTH('dbo.Tasks', 'TaskType') IS NULL ALTER TABLE dbo.Tasks ADD TaskType NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Tasks', 'ComplianceFlag') IS NULL ALTER TABLE dbo.Tasks ADD ComplianceFlag BIT NOT NULL CONSTRAINT DF_Tasks_ComplianceFlag_DashboardSeed DEFAULT 0;
IF COL_LENGTH('dbo.Tasks', 'LinkedComplianceTitle') IS NULL ALTER TABLE dbo.Tasks ADD LinkedComplianceTitle NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Tasks', 'LinkedComplianceStatus') IS NULL ALTER TABLE dbo.Tasks ADD LinkedComplianceStatus NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Tasks', 'ModifiedDate') IS NULL ALTER TABLE dbo.Tasks ADD ModifiedDate DATETIME2 NULL;
IF COL_LENGTH('dbo.Tasks', 'Assignee') IS NULL ALTER TABLE dbo.Tasks ADD Assignee NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Tasks', 'Location') IS NULL ALTER TABLE dbo.Tasks ADD Location NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Tasks', 'TimeEstimate') IS NULL ALTER TABLE dbo.Tasks ADD TimeEstimate NVARCHAR(50) NULL;

IF OBJECT_ID(N'dbo.Supplies', N'U') IS NULL
BEGIN
    PRINT 'Creating Supplies';
    CREATE TABLE dbo.Supplies (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Category NVARCHAR(100) NULL,
        SKU NVARCHAR(50) NULL,
        Description NVARCHAR(MAX) NULL,
        Unit NVARCHAR(50) NULL,
        QuantityInStock INT NOT NULL DEFAULT 0,
        MinimumStock INT NOT NULL DEFAULT 0,
        ReorderPoint INT NOT NULL DEFAULT 0,
        UnitCost DECIMAL(10,2) NULL,
        ClinicId INT NULL,
        Notes NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        SupplyType NVARCHAR(20) NULL,
        NextOrderDate DATE NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Supplies', 'SupplyType') IS NULL ALTER TABLE dbo.Supplies ADD SupplyType NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Supplies', 'NextOrderDate') IS NULL ALTER TABLE dbo.Supplies ADD NextOrderDate DATE NULL;
IF COL_LENGTH('dbo.Supplies', 'IsActive') IS NULL ALTER TABLE dbo.Supplies ADD IsActive BIT NOT NULL CONSTRAINT DF_Supplies_IsActive_DashboardSeed DEFAULT 1;

IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.OfficeEquipment', 'MaintenanceSchedule') IS NULL ALTER TABLE dbo.OfficeEquipment ADD MaintenanceSchedule NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.OfficeEquipment', 'LastMaintenanceDate') IS NULL ALTER TABLE dbo.OfficeEquipment ADD LastMaintenanceDate DATE NULL;
    IF COL_LENGTH('dbo.OfficeEquipment', 'NextMaintenanceDate') IS NULL ALTER TABLE dbo.OfficeEquipment ADD NextMaintenanceDate DATE NULL;
    IF COL_LENGTH('dbo.OfficeEquipment', 'ServiceIntervalDays') IS NULL ALTER TABLE dbo.OfficeEquipment ADD ServiceIntervalDays INT NULL;
    IF COL_LENGTH('dbo.OfficeEquipment', 'IsActive') IS NULL ALTER TABLE dbo.OfficeEquipment ADD IsActive BIT NOT NULL CONSTRAINT DF_OfficeEquipment_IsActive_DashboardSeed DEFAULT 1;
    IF COL_LENGTH('dbo.OfficeEquipment', 'CreatedDate') IS NULL ALTER TABLE dbo.OfficeEquipment ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_OfficeEquipment_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('dbo.OfficeEquipment', 'ModifiedDate') IS NULL ALTER TABLE dbo.OfficeEquipment ADD ModifiedDate DATETIME2 NULL;
END;

IF OBJECT_ID(N'dbo.Equipment', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Equipment', 'MaintenanceSchedule') IS NULL ALTER TABLE dbo.Equipment ADD MaintenanceSchedule NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.Equipment', 'LastMaintenanceDate') IS NULL ALTER TABLE dbo.Equipment ADD LastMaintenanceDate DATE NULL;
    IF COL_LENGTH('dbo.Equipment', 'NextMaintenanceDate') IS NULL ALTER TABLE dbo.Equipment ADD NextMaintenanceDate DATE NULL;
    IF COL_LENGTH('dbo.Equipment', 'ServiceIntervalDays') IS NULL ALTER TABLE dbo.Equipment ADD ServiceIntervalDays INT NULL;
    IF COL_LENGTH('dbo.Equipment', 'IsActive') IS NULL ALTER TABLE dbo.Equipment ADD IsActive BIT NOT NULL CONSTRAINT DF_Equipment_IsActive_DashboardSeed DEFAULT 1;
    IF COL_LENGTH('dbo.Equipment', 'CreatedDate') IS NULL ALTER TABLE dbo.Equipment ADD CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Equipment_CreatedDate_DashboardSeed DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('dbo.Equipment', 'ModifiedDate') IS NULL ALTER TABLE dbo.Equipment ADD ModifiedDate DATETIME2 NULL;
END;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NULL
BEGIN
    THROW 51000, 'Clinics table is required before running dashboard-test-data-seed.sql.', 1;
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    THROW 51001, 'Users table is required before running dashboard-test-data-seed.sql.', 1;
END;

DECLARE @Today DATE = CAST(GETDATE() AS DATE);
DECLARE @Yesterday DATE = DATEADD(DAY, -1, @Today);
DECLARE @Tomorrow DATE = DATEADD(DAY, 1, @Today);
DECLARE @NextWeek DATE = DATEADD(DAY, 7, @Today);
DECLARE @ClinicId INT;
DECLARE @ManagerId INT;
DECLARE @SarahId INT;
DECLARE @MariaId INT;
DECLARE @MikeId INT;
DECLARE @ChristinaId INT;
DECLARE @Room1Id INT;
DECLARE @Room2Id INT;
DECLARE @Room3Id INT;
DECLARE @SterilizationRoomId INT;
DECLARE @ShiftId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Clinics WHERE Name = N'Black Sky Dental - Downtown')
BEGIN
    INSERT INTO dbo.Clinics (Name, Address, City, State, ZipCode, Phone, MainPhone, AfterHoursPhone, Fax, Email, Website, DefaultDentist, TaxonomyNumber, ClinicNPI, ClinicTIN, LegalName, LegalAddress, Status, OperatingHours, Color, Icon, Description, IsActive, CreatedDate, ModifiedDate)
    VALUES (N'Black Sky Dental - Downtown', N'1840 Meridian Avenue', N'Spokane', N'WA', N'99201', N'509-555-0140', N'509-555-0140', N'509-555-0199', N'509-555-0141', N'downtown@blackskydental.test', N'https://blackskydental.test/downtown', N'Dr. Elise Warren', N'1223G0001X', N'1841329057', N'91-5550140', N'Black Sky Dental PLLC', N'1840 Meridian Avenue, Suite 210, Spokane, WA 99201', N'Active', N'{"monday":{"isOpen":true,"open":"07:30","close":"17:00"},"tuesday":{"isOpen":true,"open":"07:30","close":"17:00"},"wednesday":{"isOpen":true,"open":"07:30","close":"17:00"},"thursday":{"isOpen":true,"open":"07:30","close":"17:00"},"friday":{"isOpen":true,"open":"08:00","close":"14:00"},"saturday":{"isOpen":false,"open":"","close":""},"sunday":{"isOpen":false,"open":"","close":""}}', N'#0f9f9a', N'tooth', N'Dashboard seed clinic for realistic operational testing.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;
ELSE
BEGIN
    UPDATE dbo.Clinics
    SET Phone = COALESCE(NULLIF(Phone, N''), N'509-555-0140'),
        MainPhone = COALESCE(NULLIF(MainPhone, N''), Phone, N'509-555-0140'),
        AfterHoursPhone = COALESCE(NULLIF(AfterHoursPhone, N''), N'509-555-0199'),
        Fax = COALESCE(NULLIF(Fax, N''), N'509-555-0141'),
        Email = COALESCE(NULLIF(Email, N''), N'downtown@blackskydental.test'),
        Website = COALESCE(NULLIF(Website, N''), N'https://blackskydental.test/downtown'),
        DefaultDentist = COALESCE(NULLIF(DefaultDentist, N''), N'Dr. Elise Warren'),
        TaxonomyNumber = COALESCE(NULLIF(TaxonomyNumber, N''), N'1223G0001X'),
        ClinicNPI = COALESCE(NULLIF(ClinicNPI, N''), N'1841329057'),
        ClinicTIN = COALESCE(NULLIF(ClinicTIN, N''), N'91-5550140'),
        LegalName = COALESCE(NULLIF(LegalName, N''), N'Black Sky Dental PLLC'),
        LegalAddress = COALESCE(NULLIF(LegalAddress, N''), N'1840 Meridian Avenue, Suite 210, Spokane, WA 99201'),
        Status = COALESCE(NULLIF(Status, N''), N'Active'),
        OperatingHours = COALESCE(NULLIF(OperatingHours, N''), N'{"monday":{"isOpen":true,"open":"07:30","close":"17:00"},"tuesday":{"isOpen":true,"open":"07:30","close":"17:00"},"wednesday":{"isOpen":true,"open":"07:30","close":"17:00"},"thursday":{"isOpen":true,"open":"07:30","close":"17:00"},"friday":{"isOpen":true,"open":"08:00","close":"14:00"},"saturday":{"isOpen":false,"open":"","close":""},"sunday":{"isOpen":false,"open":"","close":""}}'),
        ModifiedDate = SYSUTCDATETIME()
    WHERE Name = N'Black Sky Dental - Downtown';
END;
SELECT @ClinicId = Id FROM dbo.Clinics WHERE Name = N'Black Sky Dental - Downtown';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'dashboard.manager')
    INSERT INTO dbo.Users (Username, PasswordHash, FirstName, LastName, WorkEmail, JobTitle, StaffType, Department, EmployeeStatus, Role, Color, CreatedDate, ModifiedDate, IsActive, IsOnline, FailedLoginAttempts)
    VALUES (N'dashboard.manager', N'dashboard-seed-not-for-login', N'Christina', N'Morgan', N'christina.morgan@blackskydental.test', N'Office Manager', N'Administration', N'Operations', N'active', N'admin', N'#0f9f9a', SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0, 0);
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'sarah.dashboard')
    INSERT INTO dbo.Users (Username, PasswordHash, FirstName, LastName, WorkEmail, JobTitle, StaffType, Department, EmployeeStatus, Role, Color, CreatedDate, ModifiedDate, IsActive, IsOnline, FailedLoginAttempts)
    VALUES (N'sarah.dashboard', N'dashboard-seed-not-for-login', N'Sarah', N'Patel', N'sarah.patel@blackskydental.test', N'Dental Assistant', N'Clinical', N'Clinical', N'active', N'user', N'#155eef', SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0, 0);
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'maria.dashboard')
    INSERT INTO dbo.Users (Username, PasswordHash, FirstName, LastName, WorkEmail, JobTitle, StaffType, Department, EmployeeStatus, Role, Color, CreatedDate, ModifiedDate, IsActive, IsOnline, FailedLoginAttempts)
    VALUES (N'maria.dashboard', N'dashboard-seed-not-for-login', N'Maria', N'Lopez', N'maria.lopez@blackskydental.test', N'Sterilization Lead', N'Clinical', N'Sterilization', N'active', N'user', N'#b42318', SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0, 0);
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'mike.dashboard')
    INSERT INTO dbo.Users (Username, PasswordHash, FirstName, LastName, WorkEmail, JobTitle, StaffType, Department, EmployeeStatus, Role, Color, CreatedDate, ModifiedDate, IsActive, IsOnline, FailedLoginAttempts)
    VALUES (N'mike.dashboard', N'dashboard-seed-not-for-login', N'Mike', N'Nguyen', N'mike.nguyen@blackskydental.test', N'Hygienist', N'Clinical', N'Clinical', N'active', N'user', N'#6941c6', SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0, 0);

SELECT @ManagerId = Id FROM dbo.Users WHERE Username = N'dashboard.manager';
SELECT @SarahId = Id FROM dbo.Users WHERE Username = N'sarah.dashboard';
SELECT @MariaId = Id FROM dbo.Users WHERE Username = N'maria.dashboard';
SELECT @MikeId = Id FROM dbo.Users WHERE Username = N'mike.dashboard';
SELECT @ChristinaId = @ManagerId;

IF NOT EXISTS (SELECT 1 FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Operatory 1')
    INSERT INTO dbo.Rooms (ClinicId, Name, RoomType, Description, Color, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ClinicId, N'Operatory 1', N'Operatory', N'Restorative treatment room with delivery unit and intraoral camera.', N'#155eef', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Operatory 2')
    INSERT INTO dbo.Rooms (ClinicId, Name, RoomType, Description, Color, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ClinicId, N'Operatory 2', N'Operatory', N'Hygiene and perio maintenance room.', N'#0e9384', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Operatory 3')
    INSERT INTO dbo.Rooms (ClinicId, Name, RoomType, Description, Color, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ClinicId, N'Operatory 3', N'Operatory', N'Emergency and overflow treatment room.', N'#b54708', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Sterilization')
    INSERT INTO dbo.Rooms (ClinicId, Name, RoomType, Description, Color, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ClinicId, N'Sterilization', N'Sterilization', N'Central sterilization and instrument processing room.', N'#b42318', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

SELECT @Room1Id = Id FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Operatory 1';
SELECT @Room2Id = Id FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Operatory 2';
SELECT @Room3Id = Id FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Operatory 3';
SELECT @SterilizationRoomId = Id FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name = N'Sterilization';

DECLARE @SeedMemberships TABLE (UserId INT NOT NULL PRIMARY KEY, ClinicId INT NOT NULL);

INSERT INTO @SeedMemberships (UserId, ClinicId)
SELECT DISTINCT u.Id, @ClinicId
FROM dbo.Users u
WHERE u.Id IS NOT NULL
    AND ISNULL(u.IsActive, 1) = 1
    AND NOT EXISTS (SELECT 1 FROM dbo.UserClinics uc WHERE uc.UserId = u.Id AND uc.ClinicId = @ClinicId);

INSERT INTO dbo.UserClinics (UserId, ClinicId, CreatedDate)
SELECT sm.UserId, sm.ClinicId, SYSUTCDATETIME()
FROM @SeedMemberships sm;

INSERT INTO dbo.DashboardSeedMemberships (UserId, ClinicId, CreatedDate)
SELECT sm.UserId, sm.ClinicId, SYSUTCDATETIME()
FROM @SeedMemberships sm
WHERE NOT EXISTS (SELECT 1 FROM dbo.DashboardSeedMemberships dsm WHERE dsm.UserId = sm.UserId AND dsm.ClinicId = sm.ClinicId);

IF NOT EXISTS (SELECT 1 FROM dbo.Schedules WHERE UserId = @SarahId AND ClinicId = @ClinicId AND StartDate = @Today AND StartTime = '08:00')
    INSERT INTO dbo.Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes, IsActive, CreatedDate, ModifiedDate)
    VALUES (@SarahId, @ClinicId, @Room1Id, @MariaId, @Today, @Today, '08:00', '17:00', N'Mon,Tue,Wed,Thu,Fri', N'#155eef', N'Dashboard seed: Sarah assigned to restorative operatory.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Schedules WHERE UserId = @MikeId AND ClinicId = @ClinicId AND StartDate = @Today AND StartTime = '08:00')
    INSERT INTO dbo.Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes, IsActive, CreatedDate, ModifiedDate)
    VALUES (@MikeId, @ClinicId, @Room2Id, @SarahId, @Today, @Today, '08:00', '16:00', N'Mon,Tue,Wed,Thu', N'#6941c6', N'Dashboard seed: hygiene coverage.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Schedules WHERE UserId = @MariaId AND ClinicId = @ClinicId AND StartDate = @Today AND StartTime = '07:30')
    INSERT INTO dbo.Schedules (UserId, ClinicId, RoomId, AssistantId, StartDate, EndDate, StartTime, EndTime, DaysOfWeek, Color, Notes, IsActive, CreatedDate, ModifiedDate)
    VALUES (@MariaId, @ClinicId, @SterilizationRoomId, NULL, @Today, @Today, '07:30', '15:30', N'Mon,Tue,Wed,Thu,Fri', N'#b42318', N'Dashboard seed: sterilization lead shift.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftBuilderShifts WHERE Title = N'Dashboard Seed - Downtown clinical day' AND ShiftDate = @Today)
    INSERT INTO dbo.ShiftBuilderShifts (ShiftDate, Title, Status, UseClinicDefaultTime, LinkMainCalendar, LinkMySchedule, Notes, CreatedByUserId, IsActive, CreatedDate, ModifiedDate)
    VALUES (@Today, N'Dashboard Seed - Downtown clinical day', N'published', 1, 1, 1, N'Realistic starter shift created by dashboard seed.', @ManagerId, 1, SYSUTCDATETIME(), SYSUTCDATETIME());

SELECT @ShiftId = Id FROM dbo.ShiftBuilderShifts WHERE Title = N'Dashboard Seed - Downtown clinical day' AND ShiftDate = @Today;

IF @ShiftId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.ShiftBuilderEmployeeRows WHERE ShiftId = @ShiftId AND EmployeeId = @SarahId)
    INSERT INTO dbo.ShiftBuilderEmployeeRows (ShiftId, EmployeeId, RoleName, ProviderId, ClinicId, RoomId, AssistantUserId, SortOrder, Notes, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ShiftId, @SarahId, N'Dental Assistant', @MikeId, @ClinicId, @Room1Id, @MariaId, 1, N'Restorative side coverage.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF @ShiftId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.ShiftBuilderEmployeeRows WHERE ShiftId = @ShiftId AND EmployeeId = @MikeId)
    INSERT INTO dbo.ShiftBuilderEmployeeRows (ShiftId, EmployeeId, RoleName, ProviderId, ClinicId, RoomId, AssistantUserId, SortOrder, Notes, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ShiftId, @MikeId, N'Hygienist', @MikeId, @ClinicId, @Room2Id, @SarahId, 2, N'Hygiene schedule coverage.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
IF @ShiftId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.ShiftBuilderEmployeeRows WHERE ShiftId = @ShiftId AND EmployeeId = @MariaId)
    INSERT INTO dbo.ShiftBuilderEmployeeRows (ShiftId, EmployeeId, RoleName, ProviderId, ClinicId, RoomId, AssistantUserId, SortOrder, Notes, IsActive, CreatedDate, ModifiedDate)
    VALUES (@ShiftId, @MariaId, N'Sterilization Lead', NULL, @ClinicId, @SterilizationRoomId, NULL, 3, N'Sterilization and instrument flow.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

-- Tasks drive the dashboard KPIs, rows, compliance counts, and user view.
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - Autoclave maintenance overdue')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Autoclave maintenance overdue', N'Cycle validation failed and service ticket needs manager review.', N'Equipment', N'High', N'Overdue', @Yesterday, N'08:00', @MariaId, @ManagerId, @ClinicId, N'Standard', N'Sterilization', N'45 min', N'Maria Lopez', 0, NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - Order composite capsules')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Order composite capsules', N'Composite capsules are below minimum quantity and need reorder.', N'Supplies', N'Medium', N'Pending', @Today, N'10:30', @SarahId, @ManagerId, @ClinicId, N'Standard', N'Main Supply', N'20 min', N'Sarah Patel', 0, NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - OSHA eyewash inspection due')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - OSHA eyewash inspection due', N'Complete monthly eyewash station checklist and upload photo evidence.', N'Compliance', N'Medium', N'Pending', @Today, N'12:00', @MikeId, @ManagerId, @ClinicId, N'Standard', N'Sterilization', N'15 min', N'Mike Nguyen', 1, N'OSHA eyewash inspection', N'Due Today', SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - Water bill confirmation')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Water bill confirmation', N'Confirm utility autopay receipt and attach statement.', N'Utilities', N'Medium', N'Pending', @Today, N'17:00', @ChristinaId, @ManagerId, @ClinicId, N'Standard', N'Admin Office', N'10 min', N'Christina Morgan', 0, NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - CPR renewal review')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - CPR renewal review', N'Review uploaded CPR card before it expires.', N'Compliance', N'High', N'Waiting Review', @NextWeek, N'09:00', @SarahId, @ManagerId, @ClinicId, N'Standard', N'HR', N'10 min', N'Sarah Patel', 1, N'CPR renewal', N'Waiting Review', SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - Sterilization log signature')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Sterilization log signature', N'Sign yesterday''s sterilization log and close the loop.', N'Equipment', N'High', N'Overdue', @Yesterday, N'16:00', @SarahId, @ManagerId, @ClinicId, N'Standard', N'Sterilization', N'10 min', N'Sarah Patel', 1, N'Sterilization log review', N'Overdue', SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = N'Dashboard Seed - Fire drill prep')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Fire drill prep', N'Confirm evacuation map is posted and team knows muster point.', N'Compliance', N'Low', N'Pending', @Tomorrow, N'11:00', @SarahId, @ManagerId, @ClinicId, N'Standard', N'Front Desk', N'15 min', N'Sarah Patel', 1, N'Fire drill checklist', N'Upcoming', SYSUTCDATETIME(), SYSUTCDATETIME());

INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, AssignedById, ClinicId, TaskType, Location, TimeEstimate, Assignee, ComplianceFlag, LinkedComplianceTitle, LinkedComplianceStatus, CreatedDate, ModifiedDate)
SELECT
        LEFT(CONCAT(N'Dashboard Seed - Personal dashboard task - ', u.Username), 255),
        N'User-specific dashboard seed task so the signed-in staff dashboard has visible data.',
        N'Tasks',
        N'Medium',
        N'Pending',
        @Today,
        N'14:00',
        u.Id,
        @ManagerId,
        @ClinicId,
        N'Standard',
        N'Dashboard',
        N'10 min',
        LEFT(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName, N''), N' ', ISNULL(u.LastName, N''), CASE WHEN NULLIF(u.Username, N'') IS NULL THEN N'' ELSE CONCAT(N' (', u.Username, N')') END))), 100),
        0,
        NULL,
        NULL,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
FROM dbo.Users u
WHERE ISNULL(u.IsActive, 1) = 1
    AND NOT EXISTS (SELECT 1 FROM dbo.Tasks t WHERE t.Title = LEFT(CONCAT(N'Dashboard Seed - Personal dashboard task - ', u.Username), 255));

-- Requests drive the Critical KPI and manager attention panel.
IF NOT EXISTS (SELECT 1 FROM dbo.Requests WHERE Title = N'Dashboard Seed - Compressor pressure drop')
    INSERT INTO dbo.Requests (Title, Type, Priority, Status, RequestedBy, AssignedTo, NeededBy, Location, Description, RequestedAt, UpdatedAt)
    VALUES (N'Dashboard Seed - Compressor pressure drop', N'Equipment', N'Critical', N'New', N'maria.dashboard', N'dashboard.manager', @Today, N'Mechanical Room', N'Compressor pressure dropped twice during morning setup.', DATEADD(HOUR, -2, SYSUTCDATETIME()), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Requests WHERE Title = N'Dashboard Seed - Operatory 3 suction intermittent')
    INSERT INTO dbo.Requests (Title, Type, Priority, Status, RequestedBy, AssignedTo, NeededBy, Location, Description, RequestedAt, UpdatedAt)
    VALUES (N'Dashboard Seed - Operatory 3 suction intermittent', N'Equipment', N'High', N'In Progress', N'sarah.dashboard', N'dashboard.manager', @Today, N'Operatory 3', N'Suction weak during hygiene appointment; needs check before afternoon schedule.', DATEADD(HOUR, -4, SYSUTCDATETIME()), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Requests WHERE Title = N'Dashboard Seed - Insurance certificate update')
    INSERT INTO dbo.Requests (Title, Type, Priority, Status, RequestedBy, AssignedTo, NeededBy, Location, Description, RequestedAt, UpdatedAt)
    VALUES (N'Dashboard Seed - Insurance certificate update', N'Compliance', N'Urgent', N'New', N'mike.dashboard', N'dashboard.manager', @NextWeek, N'Admin Office', N'New certificate needs manager review before vendor packet renewal.', DATEADD(DAY, -1, SYSUTCDATETIME()), SYSUTCDATETIME());

-- Equipment health. Prefer OfficeEquipment in Black Sky; also seed Equipment if that table exists.
IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.OfficeEquipment WHERE Name = N'Dashboard Seed - Sterilizer A')
        INSERT INTO dbo.OfficeEquipment (Name, Category, Brand, Model, SerialNumber, Description, Status, ClinicId, MaintenanceSchedule, LastMaintenanceDate, NextMaintenanceDate, ServiceIntervalDays, Notes, IsActive, CreatedDate, ModifiedDate)
        VALUES (N'Dashboard Seed - Sterilizer A', N'Sterilization', N'Midmark', N'M11', N'DASH-AUTO-001', N'Seed equipment with overdue service date.', N'Service Required', @ClinicId, N'Quarterly', DATEADD(DAY, -120, @Today), @Yesterday, 90, N'Dashboard seed: service overdue.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
    IF NOT EXISTS (SELECT 1 FROM dbo.OfficeEquipment WHERE Name = N'Dashboard Seed - Compressor')
        INSERT INTO dbo.OfficeEquipment (Name, Category, Brand, Model, SerialNumber, Description, Status, ClinicId, MaintenanceSchedule, LastMaintenanceDate, NextMaintenanceDate, ServiceIntervalDays, Notes, IsActive, CreatedDate, ModifiedDate)
        VALUES (N'Dashboard Seed - Compressor', N'Mechanical', N'Air Techniques', N'AirStar', N'DASH-COMP-001', N'Seed equipment with active issue.', N'Down', @ClinicId, N'Monthly', DATEADD(DAY, -45, @Today), @Today, 30, N'Dashboard seed: pressure issue.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;

IF OBJECT_ID(N'dbo.Equipment', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Equipment WHERE Name = N'Dashboard Seed - Sterilizer A')
        INSERT INTO dbo.Equipment (Name, Category, Brand, Model, SerialNumber, Description, Status, ClinicId, MaintenanceSchedule, LastMaintenanceDate, NextMaintenanceDate, ServiceIntervalDays, Notes, IsActive, CreatedDate, ModifiedDate)
        VALUES (N'Dashboard Seed - Sterilizer A', N'Sterilization', N'Midmark', N'M11', N'DASH-AUTO-001', N'Seed equipment with overdue service date.', N'Service Required', @ClinicId, N'Quarterly', DATEADD(DAY, -120, @Today), @Yesterday, 90, N'Dashboard seed: service overdue.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
    IF NOT EXISTS (SELECT 1 FROM dbo.Equipment WHERE Name = N'Dashboard Seed - Compressor')
        INSERT INTO dbo.Equipment (Name, Category, Brand, Model, SerialNumber, Description, Status, ClinicId, MaintenanceSchedule, LastMaintenanceDate, NextMaintenanceDate, ServiceIntervalDays, Notes, IsActive, CreatedDate, ModifiedDate)
        VALUES (N'Dashboard Seed - Compressor', N'Mechanical', N'Air Techniques', N'AirStar', N'DASH-COMP-001', N'Seed equipment with active issue.', N'Down', @ClinicId, N'Monthly', DATEADD(DAY, -45, @Today), @Today, 30, N'Dashboard seed: pressure issue.', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;

-- Supply health.
IF NOT EXISTS (SELECT 1 FROM dbo.Supplies WHERE Name = N'Dashboard Seed - Nitrile Gloves Medium')
    INSERT INTO dbo.Supplies (Name, Category, SKU, Description, Unit, QuantityInStock, MinimumStock, ReorderPoint, UnitCost, ClinicId, Notes, IsActive, SupplyType, NextOrderDate, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Nitrile Gloves Medium', N'PPE', N'DASH-GLOVE-M', N'Medium nitrile gloves for treatment rooms.', N'box', 3, 10, 10, 12.50, @ClinicId, N'Dashboard seed: below minimum.', 1, N'Dental', @Today, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Supplies WHERE Name = N'Dashboard Seed - Composite Capsules A2')
    INSERT INTO dbo.Supplies (Name, Category, SKU, Description, Unit, QuantityInStock, MinimumStock, ReorderPoint, UnitCost, ClinicId, Notes, IsActive, SupplyType, NextOrderDate, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Composite Capsules A2', N'Restorative', N'DASH-COMP-A2', N'Composite capsules used in operative dentistry.', N'pack', 4, 8, 8, 68.00, @ClinicId, N'Dashboard seed: reorder pending.', 1, N'Dental', @Today, SYSUTCDATETIME(), SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.Supplies WHERE Name = N'Dashboard Seed - Copy Paper')
    INSERT INTO dbo.Supplies (Name, Category, SKU, Description, Unit, QuantityInStock, MinimumStock, ReorderPoint, UnitCost, ClinicId, Notes, IsActive, SupplyType, NextOrderDate, CreatedDate, ModifiedDate)
    VALUES (N'Dashboard Seed - Copy Paper', N'Office', N'DASH-PAPER', N'Front desk printer paper.', N'ream', 2, 6, 6, 5.75, @ClinicId, N'Dashboard seed: office supply low stock.', 1, N'Office', @Tomorrow, SYSUTCDATETIME(), SYSUTCDATETIME());

PRINT 'Dashboard seed complete.';
PRINT 'Demo manager user: dashboard.manager';
PRINT 'Demo staff user: sarah.dashboard';
PRINT 'Use either user id in X-User-Id when testing tenant-scoped endpoints.';
