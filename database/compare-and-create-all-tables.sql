-- ============================================================
-- Reform Dental - COMPARE & CREATE ALL TABLES
-- Run this in Azure Portal Query Editor (reformdentaldb)
-- It is 100% safe: only CREATES tables / ADDS columns that
-- are missing.  Nothing is dropped, truncated or renamed.
-- ============================================================

PRINT '=== Reform Dental - Table Comparison & Creation ==='
PRINT 'Checking all required tables...'
PRINT ''

-- ============================================================
-- 1. USERS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Users' AND type = 'U')
BEGIN
    PRINT 'CREATING: Users'
    CREATE TABLE Users (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Username        NVARCHAR(50)    NOT NULL UNIQUE,
        PasswordHash    NVARCHAR(255)   NOT NULL,
        FirstName       NVARCHAR(100)   NULL,
        MiddleName      NVARCHAR(100)   NULL,
        LastName        NVARCHAR(100)   NULL,
        Gender          NVARCHAR(20)    NULL,
        DateOfBirth     DATE            NULL,
        PersonalEmail   NVARCHAR(255)   NULL,
        WorkEmail       NVARCHAR(255)   NULL,
        HomePhone       NVARCHAR(20)    NULL,
        CellPhone       NVARCHAR(20)    NULL,
        Address         NVARCHAR(255)   NULL,
        City            NVARCHAR(100)   NULL,
        State           NVARCHAR(50)    NULL,
        ZipCode         NVARCHAR(20)    NULL,
        JobTitle        NVARCHAR(100)   NULL,
        StaffType       NVARCHAR(50)    NULL,
        EmployeeType    NVARCHAR(50)    NULL,
        Department      NVARCHAR(100)   NULL,
        EmployeeStatus  NVARCHAR(50)    NULL,
        Role            NVARCHAR(50)    NOT NULL DEFAULT 'user',
        HireDate        DATE            NULL,
        HourlyRate      DECIMAL(10,2)   NULL,
        Salary          DECIMAL(12,2)   NULL,
        Color           NVARCHAR(20)    NULL,
        ProfileImage    NVARCHAR(MAX)   NULL,
        Permissions     NVARCHAR(MAX)   NULL,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE(),
        IsActive        BIT             DEFAULT 1
    )
END
ELSE PRINT 'OK: Users'

-- ============================================================
-- 2. CLINICS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Clinics' AND type = 'U')
BEGIN
    PRINT 'CREATING: Clinics'
    CREATE TABLE Clinics (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(200)   NOT NULL,
        Address         NVARCHAR(255)   NULL,
        City            NVARCHAR(100)   NULL,
        State           NVARCHAR(50)    NULL,
        ZipCode         NVARCHAR(20)    NULL,
        Phone           NVARCHAR(20)    NULL,
        Email           NVARCHAR(255)   NULL,
        Color           NVARCHAR(20)    NULL,
        Icon            NVARCHAR(50)    NULL,
        Description     NVARCHAR(MAX)   NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Clinics'

-- ============================================================
-- 3. CLINIC WORKING HOURS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'ClinicWorkingHours' AND type = 'U')
BEGIN
    PRINT 'CREATING: ClinicWorkingHours'
    CREATE TABLE ClinicWorkingHours (
        Id          INT         IDENTITY(1,1) PRIMARY KEY,
        ClinicId    INT         NOT NULL,
        DayKey      NVARCHAR(20) NOT NULL,
        IsOpen      BIT         NOT NULL DEFAULT 0,
        OpenTime    TIME        NULL,
        CloseTime   TIME        NULL,
        CreatedDate DATETIME2   DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME2  DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: ClinicWorkingHours'

-- ============================================================
-- 4. ROOMS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Rooms' AND type = 'U')
BEGIN
    PRINT 'CREATING: Rooms'
    CREATE TABLE Rooms (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        ClinicId    INT             NOT NULL,
        Name        NVARCHAR(100)   NOT NULL,
        RoomType    NVARCHAR(50)    NULL,
        Description NVARCHAR(MAX)   NULL,
        Color       NVARCHAR(20)    NULL,
        IsActive    BIT             DEFAULT 1,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME2      DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Rooms'

-- ============================================================
-- 5. SCHEDULES / SHIFTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Schedules' AND type = 'U')
BEGIN
    PRINT 'CREATING: Schedules'
    CREATE TABLE Schedules (
        Id              INT         IDENTITY(1,1) PRIMARY KEY,
        UserId          INT         NOT NULL,
        ClinicId        INT         NOT NULL,
        RoomId          INT         NULL,
        AssistantId     INT         NULL,
        StartDate       DATE        NOT NULL,
        EndDate         DATE        NULL,
        StartTime       TIME        NOT NULL,
        EndTime         TIME        NOT NULL,
        DaysOfWeek      NVARCHAR(100) NULL,
        Color           NVARCHAR(20) NULL,
        Notes           NVARCHAR(MAX) NULL,
        IsActive        BIT         DEFAULT 1,
        CreatedDate     DATETIME2   DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2   DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Schedules'

-- ============================================================
-- 6. EVENTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Events' AND type = 'U')
BEGIN
    PRINT 'CREATING: Events'
    CREATE TABLE Events (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Title           NVARCHAR(255)   NOT NULL,
        Description     NVARCHAR(MAX)   NULL,
        EventType       NVARCHAR(50)    NULL,
        StartDateTime   DATETIME2       NOT NULL,
        EndDateTime     DATETIME2       NOT NULL,
        AllDay          BIT             DEFAULT 0,
        UserId          INT             NULL,
        ClinicId        INT             NULL,
        RoomId          INT             NULL,
        Color           NVARCHAR(20)    NULL,
        Priority        NVARCHAR(20)    NULL,
        Status          NVARCHAR(50)    DEFAULT 'scheduled',
        RecurrenceRule  NVARCHAR(255)   NULL,
        CreatedBy       INT             NULL,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Events'

-- ============================================================
-- 7. TASKS  (to-do / assignment tasks - separate from Teams/Involvement)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Tasks' AND type = 'U')
BEGIN
    PRINT 'CREATING: Tasks'
    CREATE TABLE Tasks (
        Id                      INT             IDENTITY(1,1) PRIMARY KEY,
        Title                   NVARCHAR(255)   NOT NULL,
        Description             NVARCHAR(MAX)   NULL,
        Category                NVARCHAR(50)    NULL,
        Priority                NVARCHAR(20)    NOT NULL DEFAULT 'Medium',
        Status                  NVARCHAR(50)    NOT NULL DEFAULT 'Pending',
        DueDate                 DATE            NULL,
        DueTime                 NVARCHAR(10)    NULL,
        AssignedToId            INT             NULL,
        AssignedById            INT             NULL,
        ClinicId                INT             NULL,
        CompletedDate           DATETIME2       NULL,
        CompletedById           INT             NULL,
        Notes                   NVARCHAR(MAX)   NULL,
        Tags                    NVARCHAR(MAX)   NULL,
        IsRecurring             BIT             DEFAULT 0,
        RecurrenceRule          NVARCHAR(255)   NULL,
        TaskType                NVARCHAR(50)    DEFAULT 'Regular',
        IsPaid                  BIT             DEFAULT 0,
        PayAmount               DECIMAL(10,2)   NULL,
        Location                NVARCHAR(100)   NULL,
        TimeEstimate            NVARCHAR(50)    NULL,
        Assignee                NVARCHAR(100)   NULL,
        ClaimedBy               NVARCHAR(100)   NULL,
        ClaimedAt               DATETIME        NULL,
        ComplianceFlag          BIT             DEFAULT 0,
        LinkedComplianceId      INT             NULL,
        LinkedComplianceTitle   NVARCHAR(255)   NULL,
        LinkedComplianceStatus  NVARCHAR(50)    NULL,
        CreatedDate             DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate            DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE
BEGIN
    PRINT 'OK: Tasks (checking missing columns...)'
    -- Add any columns introduced after initial creation
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TaskType')
        ALTER TABLE Tasks ADD TaskType NVARCHAR(50) DEFAULT 'Regular'
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'IsPaid')
        ALTER TABLE Tasks ADD IsPaid BIT DEFAULT 0
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'PayAmount')
        ALTER TABLE Tasks ADD PayAmount DECIMAL(10,2) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Location')
        ALTER TABLE Tasks ADD Location NVARCHAR(100) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TimeEstimate')
        ALTER TABLE Tasks ADD TimeEstimate NVARCHAR(50) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Assignee')
        ALTER TABLE Tasks ADD Assignee NVARCHAR(100) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedBy')
        ALTER TABLE Tasks ADD ClaimedBy NVARCHAR(100) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedAt')
        ALTER TABLE Tasks ADD ClaimedAt DATETIME NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ComplianceFlag')
        ALTER TABLE Tasks ADD ComplianceFlag BIT DEFAULT 0
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceId')
        ALTER TABLE Tasks ADD LinkedComplianceId INT NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceTitle')
        ALTER TABLE Tasks ADD LinkedComplianceTitle NVARCHAR(255) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceStatus')
        ALTER TABLE Tasks ADD LinkedComplianceStatus NVARCHAR(50) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'DueTime')
        ALTER TABLE Tasks ADD DueTime NVARCHAR(10) NULL
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ModifiedDate')
        ALTER TABLE Tasks ADD ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
END

-- ============================================================
-- 8. EQUIPMENT
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Equipment' AND type = 'U')
BEGIN
    PRINT 'CREATING: Equipment'
    CREATE TABLE Equipment (
        Id                      INT             IDENTITY(1,1) PRIMARY KEY,
        Name                    NVARCHAR(200)   NOT NULL,
        Category                NVARCHAR(100)   NULL,
        Brand                   NVARCHAR(100)   NULL,
        Model                   NVARCHAR(100)   NULL,
        SerialNumber            NVARCHAR(100)   NULL,
        Description             NVARCHAR(MAX)   NULL,
        ClinicId                INT             NULL,
        RoomId                  INT             NULL,
        PurchaseDate            DATE            NULL,
        PurchasePrice           DECIMAL(12,2)   NULL,
        WarrantyExpiry          DATE            NULL,
        Status                  NVARCHAR(50)    DEFAULT 'operational',
        Condition               NVARCHAR(50)    NULL,
        MaintenanceSchedule     NVARCHAR(50)    NULL,
        LastMaintenanceDate     DATE            NULL,
        NextMaintenanceDate     DATE            NULL,
        ServiceIntervalDays     INT             NULL,
        LastServiceDate         DATE            NULL,
        NextServiceDate         DATE            NULL,
        ServiceVendor           NVARCHAR(120)   NULL,
        VendorId                INT             NULL,
        Notes                   NVARCHAR(MAX)   NULL,
        Warnings                NVARCHAR(MAX)   NULL,
        ImageUrl                NVARCHAR(MAX)   NULL,
        DocumentUrl             NVARCHAR(MAX)   NULL,
        CreatedDate             DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate            DATETIME2       DEFAULT GETUTCDATE(),
        IsActive                BIT             DEFAULT 1
    )
END
ELSE PRINT 'OK: Equipment'

-- ============================================================
-- 9. EQUIPMENT SERVICE TICKETS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'EquipmentServiceTickets' AND type = 'U')
BEGIN
    PRINT 'CREATING: EquipmentServiceTickets'
    CREATE TABLE EquipmentServiceTickets (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        EquipmentId     INT             NOT NULL,
        Title           NVARCHAR(200)   NULL,
        ServiceType     NVARCHAR(30)    NOT NULL DEFAULT 'Preventive',
        Priority        NVARCHAR(20)    NOT NULL DEFAULT 'Medium',
        Status          NVARCHAR(20)    NOT NULL DEFAULT 'Open',
        ScheduledDate   DATE            NULL,
        CompletedDate   DATE            NULL,
        Vendor          NVARCHAR(120)   NULL,
        Cost            DECIMAL(12,2)   DEFAULT 0,
        Description     NVARCHAR(500)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        IsAutoGenerated BIT             DEFAULT 0,
        CreatedAt       DATETIME2       DEFAULT GETUTCDATE(),
        UpdatedAt       DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE
BEGIN
    PRINT 'OK: EquipmentServiceTickets (checking missing columns...)'
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EquipmentServiceTickets') AND name = 'Title')
        ALTER TABLE EquipmentServiceTickets ADD Title NVARCHAR(200) NULL
END

-- ============================================================
-- 10. EQUIPMENT FILES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'EquipmentFiles' AND type = 'U')
BEGIN
    PRINT 'CREATING: EquipmentFiles'
    CREATE TABLE EquipmentFiles (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        EquipmentId     INT             NOT NULL,
        FileName        NVARCHAR(255)   NOT NULL,
        ContentType     NVARCHAR(200)   NULL,
        FileData        NVARCHAR(MAX)   NOT NULL,
        FileSize        INT             DEFAULT 0,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: EquipmentFiles'

-- ============================================================
-- 11. SUPPLIES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Supplies' AND type = 'U')
BEGIN
    PRINT 'CREATING: Supplies'
    CREATE TABLE Supplies (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(200)   NOT NULL,
        Category        NVARCHAR(100)   NULL,
        SKU             NVARCHAR(50)    NULL,
        Description     NVARCHAR(MAX)   NULL,
        Unit            NVARCHAR(50)    NULL,
        QuantityInStock INT             DEFAULT 0,
        MinimumStock    INT             DEFAULT 0,
        ReorderPoint    INT             DEFAULT 0,
        UnitCost        DECIMAL(10,2)   NULL,
        ClinicId        INT             NULL,
        StorageLocation NVARCHAR(100)   NULL,
        VendorId        INT             NULL,
        ExpirationDate  DATE            NULL,
        Notes           NVARCHAR(MAX)   NULL,
        Warnings        NVARCHAR(MAX)   NULL,
        ImageUrl        NVARCHAR(MAX)   NULL,
        DocumentUrl     NVARCHAR(MAX)   NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Supplies'

-- ============================================================
-- 12. INSTRUMENTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Instruments' AND type = 'U')
BEGIN
    PRINT 'CREATING: Instruments'
    CREATE TABLE Instruments (
        Id                      INT             IDENTITY(1,1) PRIMARY KEY,
        Name                    NVARCHAR(200)   NOT NULL,
        SkuNumber               NVARCHAR(100)   NULL,
        Category                NVARCHAR(100)   NULL,
        Description             NVARCHAR(MAX)   NULL,
        Quantity                INT             DEFAULT 1,
        ClinicId                INT             NULL,
        SterilizationRequired   BIT             DEFAULT 1,
        Status                  NVARCHAR(50)    DEFAULT 'available',
        PurchaseDate            DATE            NULL,
        UnitCost                DECIMAL(10,2)   NULL,
        VendorId                INT             NULL,
        Notes                   NVARCHAR(MAX)   NULL,
        Warnings                NVARCHAR(MAX)   NULL,
        ImageUrl                NVARCHAR(MAX)   NULL,
        DocumentUrl             NVARCHAR(MAX)   NULL,
        Icon                    NVARCHAR(50)    NULL,
        CreatedDate             DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate            DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Instruments'

-- ============================================================
-- 13. CATEGORIES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Categories' AND type = 'U')
BEGIN
    PRINT 'CREATING: Categories'
    CREATE TABLE Categories (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(200)   NOT NULL,
        CategoryType    NVARCHAR(50)    NOT NULL,
        Description     NVARCHAR(MAX)   NULL,
        SortOrder       INT             DEFAULT 0,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Categories'

-- ============================================================
-- 14. VENDORS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Vendors' AND type = 'U')
BEGIN
    PRINT 'CREATING: Vendors'
    CREATE TABLE Vendors (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(200)   NOT NULL,
        ContactName     NVARCHAR(100)   NULL,
        Email           NVARCHAR(255)   NULL,
        Phone           NVARCHAR(20)    NULL,
        Address         NVARCHAR(255)   NULL,
        City            NVARCHAR(100)   NULL,
        State           NVARCHAR(50)    NULL,
        ZipCode         NVARCHAR(20)    NULL,
        Website         NVARCHAR(255)   NULL,
        Category        NVARCHAR(100)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Vendors'

-- ============================================================
-- 15. VENDOR TYPES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'VendorTypes' AND type = 'U')
BEGIN
    PRINT 'CREATING: VendorTypes'
    CREATE TABLE VendorTypes (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(200)   NOT NULL,
        SortOrder       INT             DEFAULT 0,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: VendorTypes'

-- ============================================================
-- 16. REQUESTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Requests' AND type = 'U')
BEGIN
    PRINT 'CREATING: Requests'
    CREATE TABLE Requests (
        id              INT             IDENTITY(1,1) PRIMARY KEY,
        title           NVARCHAR(255)   NOT NULL,
        type            NVARCHAR(100)   NULL,
        priority        NVARCHAR(50)    DEFAULT 'Medium',
        status          NVARCHAR(50)    DEFAULT 'Pending',
        requestedBy     NVARCHAR(200)   NULL,
        assignedTo      NVARCHAR(200)   NULL,
        neededBy        DATE            NULL,
        location        NVARCHAR(255)   NULL,
        description     NVARCHAR(MAX)   NULL,
        requestedAt     DATETIME2       DEFAULT GETUTCDATE(),
        updatedAt       DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Requests'

-- ============================================================
-- 17. DUTIES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Duties' AND type = 'U')
BEGIN
    PRINT 'CREATING: Duties'
    CREATE TABLE Duties (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(255)   NOT NULL,
        Description     NVARCHAR(MAX)   NULL,
        Schedule        NVARCHAR(50)    NULL,
        ScheduleTime    NVARCHAR(20)    NULL,
        ScheduleDay     NVARCHAR(50)    NULL,
        Location        NVARCHAR(100)   NULL,
        Priority        NVARCHAR(20)    DEFAULT 'Medium',
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Duties'

-- ============================================================
-- 18. USER DUTY ASSIGNMENTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UserDutyAssignments' AND type = 'U')
BEGIN
    PRINT 'CREATING: UserDutyAssignments'
    CREATE TABLE UserDutyAssignments (
        Id      INT IDENTITY(1,1) PRIMARY KEY,
        UserId  INT NOT NULL,
        DutyId  INT NOT NULL
    )
END
ELSE PRINT 'OK: UserDutyAssignments'

-- ============================================================
-- 19. TEAMS  (the "Involvement" section - groups of staff)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Teams' AND type = 'U')
BEGIN
    PRINT 'CREATING: Teams'
    CREATE TABLE Teams (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        TeamName        NVARCHAR(200)   NOT NULL,
        Category        NVARCHAR(100)   NULL,
        Description     NVARCHAR(1000)  NULL,
        TeamLeadId      NVARCHAR(100)   NULL,
        TeamLeadName    NVARCHAR(200)   NULL,
        Members         NVARCHAR(MAX)   NULL,
        OfficeId        NVARCHAR(50)    NULL,
        Schedule        NVARCHAR(200)   NULL,
        ImageData       NVARCHAR(MAX)   NULL,
        DocumentData    NVARCHAR(MAX)   NULL,
        DocumentName    NVARCHAR(500)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        Warnings        NVARCHAR(MAX)   NULL,
        OperationsLog   NVARCHAR(MAX)   NULL,
        IsActive        BIT             NOT NULL DEFAULT 1,
        CreatedDate     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Teams'

-- ============================================================
-- 20. TEAM EVENTS  (Assignments in the Involvement section)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'TeamEvents' AND type = 'U')
BEGIN
    PRINT 'CREATING: TeamEvents'
    CREATE TABLE TeamEvents (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        TeamId          INT             NOT NULL,
        Title           NVARCHAR(255)   NOT NULL,
        EventType       NVARCHAR(100)   NOT NULL DEFAULT 'Meeting',
        Status          NVARCHAR(50)    NOT NULL DEFAULT 'Scheduled',
        Priority        NVARCHAR(50)    NOT NULL DEFAULT 'Medium',
        EventDate       DATE            NULL,
        EventTime       NVARCHAR(20)    NULL,
        Frequency       NVARCHAR(50)    NOT NULL DEFAULT 'One-Time',
        Location        NVARCHAR(255)   NULL,
        AssignedMembers NVARCHAR(MAX)   NULL,
        Description     NVARCHAR(MAX)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        Attachments     NVARCHAR(MAX)   NULL,
        DocumentUrl     NVARCHAR(MAX)   NULL,
        CompletedDate   DATE            NULL,
        IsActive        BIT             NOT NULL DEFAULT 1,
        CreatedDate     DATETIME         NOT NULL DEFAULT GETDATE(),
        ModifiedDate    DATETIME         NULL
    )
END
ELSE PRINT 'OK: TeamEvents'

-- ============================================================
-- 21. COMPLIANCE TYPES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'ComplianceTypes' AND type = 'U')
BEGIN
    PRINT 'CREATING: ComplianceTypes'
    CREATE TABLE ComplianceTypes (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(255)   NOT NULL,
        Description     NVARCHAR(MAX)   NULL,
        Frequency       NVARCHAR(50)    NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: ComplianceTypes'

-- ============================================================
-- 22. COMPLIANCES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Compliances' AND type = 'U')
BEGIN
    PRINT 'CREATING: Compliances'
    CREATE TABLE Compliances (
        Id                  INT             IDENTITY(1,1) PRIMARY KEY,
        ComplianceTypeId    INT             NULL,
        Title               NVARCHAR(255)   NOT NULL,
        Description         NVARCHAR(MAX)   NULL,
        Status              NVARCHAR(50)    DEFAULT 'Pending',
        DueDate             DATE            NULL,
        CompletedDate       DATE            NULL,
        AssignedToId        INT             NULL,
        ClinicId            INT             NULL,
        Notes               NVARCHAR(MAX)   NULL,
        IsActive            BIT             DEFAULT 1,
        CreatedDate         DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate        DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Compliances'

-- ============================================================
-- 23. USER COMPLIANCE ASSIGNMENTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UserComplianceAssignments' AND type = 'U')
BEGIN
    PRINT 'CREATING: UserComplianceAssignments'
    CREATE TABLE UserComplianceAssignments (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        UserId          INT             NOT NULL,
        ComplianceId    INT             NOT NULL,
        AssignedDate    DATETIME2       DEFAULT GETUTCDATE(),
        Status          NVARCHAR(50)    DEFAULT 'Pending'
    )
END
ELSE PRINT 'OK: UserComplianceAssignments'

-- ============================================================
-- 24. UTILITIES (Services section)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Utilities' AND type = 'U')
BEGIN
    PRINT 'CREATING: Utilities'
    CREATE TABLE Utilities (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        Name            NVARCHAR(200)   NOT NULL,
        Category        NVARCHAR(100)   NULL,
        Provider        NVARCHAR(200)   NULL,
        AccountNumber   NVARCHAR(100)   NULL,
        ContactName     NVARCHAR(100)   NULL,
        ContactEmail    NVARCHAR(255)   NULL,
        ContactPhone    NVARCHAR(30)    NULL,
        ContractStart   DATE            NULL,
        ContractEnd     DATE            NULL,
        MonthlyCost     DECIMAL(12,2)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        Warnings        NVARCHAR(MAX)   NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: Utilities'

-- ============================================================
-- 25. UTILITY TICKETS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UtilityTickets' AND type = 'U')
BEGIN
    PRINT 'CREATING: UtilityTickets'
    CREATE TABLE UtilityTickets (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        UtilityId       INT             NOT NULL,
        Title           NVARCHAR(255)   NOT NULL,
        Status          NVARCHAR(50)    DEFAULT 'Open',
        Priority        NVARCHAR(20)    DEFAULT 'Medium',
        Description     NVARCHAR(MAX)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: UtilityTickets'

-- ============================================================
-- 26. CHAT MESSAGES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'ChatMessages' AND type = 'U')
BEGIN
    PRINT 'CREATING: ChatMessages'
    CREATE TABLE ChatMessages (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        SenderId    INT             NOT NULL,
        ReceiverId  INT             NULL,
        Message     NVARCHAR(MAX)   NOT NULL,
        IsRead      BIT             DEFAULT 0,
        MessageType NVARCHAR(50)    DEFAULT 'text',
        SentAt      DATETIME2       DEFAULT GETUTCDATE(),
        ReadAt      DATETIME2       NULL,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: ChatMessages'

-- ============================================================
-- 27. CHAT MESSAGE ATTACHMENTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'ChatMessageAttachments' AND type = 'U')
BEGIN
    PRINT 'CREATING: ChatMessageAttachments'
    CREATE TABLE ChatMessageAttachments (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        MessageId   INT             NOT NULL,
        FileName    NVARCHAR(255)   NOT NULL,
        ContentType NVARCHAR(200)   NOT NULL,
        FileSize    INT             NOT NULL DEFAULT 0,
        FileData    NVARCHAR(MAX)   NOT NULL,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: ChatMessageAttachments'

-- ============================================================
-- 28. COPILOT CONVERSATIONS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CopilotConversations' AND type = 'U')
BEGIN
    PRINT 'CREATING: CopilotConversations'
    CREATE TABLE CopilotConversations (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        UserId          INT             NOT NULL,
        ConversationId  NVARCHAR(100)   NOT NULL,
        Title           NVARCHAR(255)   NOT NULL,
        IsDeleted       BIT             NOT NULL DEFAULT 0,
        CreatedDate     DATETIME2       DEFAULT SYSUTCDATETIME(),
        ModifiedDate    DATETIME2       DEFAULT SYSUTCDATETIME()
    )
END
ELSE PRINT 'OK: CopilotConversations'

-- ============================================================
-- 29. COPILOT CONVERSATION MESSAGES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CopilotConversationMessages' AND type = 'U')
BEGIN
    PRINT 'CREATING: CopilotConversationMessages'
    CREATE TABLE CopilotConversationMessages (
        Id                  INT             IDENTITY(1,1) PRIMARY KEY,
        ConversationPkId    INT             NOT NULL,
        Role                NVARCHAR(20)    NOT NULL,
        Content             NVARCHAR(MAX)   NOT NULL,
        MessageOrder        INT             NOT NULL,
        CreatedDate         DATETIME2       DEFAULT SYSUTCDATETIME()
    )
END
ELSE PRINT 'OK: CopilotConversationMessages'

-- ============================================================
-- 30. STICKY NOTES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'StickyNotes' AND type = 'U')
BEGIN
    PRINT 'CREATING: StickyNotes'
    CREATE TABLE StickyNotes (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        Content     NVARCHAR(MAX)   NOT NULL,
        Color       NVARCHAR(20)    DEFAULT '#fef3c7',
        UserId      INT             NULL,
        Position    NVARCHAR(100)   NULL,
        IsDeleted   BIT             DEFAULT 0,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME2      DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: StickyNotes'

-- ============================================================
-- 31. STATIONARY TEMPLATES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'StationaryTemplates' AND type = 'U')
BEGIN
    PRINT 'CREATING: StationaryTemplates'
    CREATE TABLE StationaryTemplates (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        TemplateKey     NVARCHAR(120)   NOT NULL UNIQUE,
        Name            NVARCHAR(255)   NOT NULL,
        HeaderLine1     NVARCHAR(MAX)   NULL,
        HeaderLine2     NVARCHAR(MAX)   NULL,
        FooterText      NVARCHAR(MAX)   NULL,
        Elements        NVARCHAR(MAX)   NULL,
        ClinicId        INT             NULL,
        OwnerUsername   NVARCHAR(100)   NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: StationaryTemplates'

-- ============================================================
-- 32. USER LOGIN SESSIONS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UserLoginSessions' AND type = 'U')
BEGIN
    PRINT 'CREATING: UserLoginSessions'
    CREATE TABLE UserLoginSessions (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        SessionId       NVARCHAR(120)   NOT NULL UNIQUE,
        UserId          INT             NULL,
        Username        NVARCHAR(120)   NOT NULL,
        DisplayName     NVARCHAR(200)   NULL,
        UserRole        NVARCHAR(60)    NULL,
        Source          NVARCHAR(60)    NULL,
        LoginAt         DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        LastSeenAt      DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        LogoutAt        DATETIME2(3)    NULL,
        LogoutReason    NVARCHAR(80)    NULL,
        ForcedLogoutAt  DATETIME2(3)    NULL,
        ForcedBy        NVARCHAR(120)   NULL,
        IsActive        BIT             NOT NULL DEFAULT 1,
        CreatedDate     DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        ModifiedDate    DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME()
    )
END
ELSE PRINT 'OK: UserLoginSessions'

-- ============================================================
-- 33. USER LOGIN AUDIT
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UserLoginAudit' AND type = 'U')
BEGIN
    PRINT 'CREATING: UserLoginAudit'
    CREATE TABLE UserLoginAudit (
        Id          BIGINT          IDENTITY(1,1) PRIMARY KEY,
        SessionId   NVARCHAR(120)   NULL,
        UserId      INT             NULL,
        Username    NVARCHAR(120)   NOT NULL,
        DisplayName NVARCHAR(200)   NULL,
        UserRole    NVARCHAR(60)    NULL,
        EventType   NVARCHAR(80)    NOT NULL,
        EventSource NVARCHAR(60)    NULL,
        EventAt     DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        ForcedBy    NVARCHAR(120)   NULL,
        Note        NVARCHAR(400)   NULL
    )
END
ELSE PRINT 'OK: UserLoginAudit'

-- ============================================================
-- 34. ATTENDANCE RECORDS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'AttendanceRecords' AND type = 'U')
BEGIN
    PRINT 'CREATING: AttendanceRecords'
    CREATE TABLE AttendanceRecords (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        UserId          INT             NOT NULL,
        ClinicId        INT             NULL,
        ClockIn         DATETIME2       NOT NULL,
        ClockOut        DATETIME2       NULL,
        BreakMinutes    INT             DEFAULT 0,
        Notes           NVARCHAR(MAX)   NULL,
        Status          NVARCHAR(50)    DEFAULT 'active',
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: AttendanceRecords'

-- ============================================================
-- 35. ATTENDANCE POLICIES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'AttendancePolicies' AND type = 'U')
BEGIN
    PRINT 'CREATING: AttendancePolicies'
    CREATE TABLE AttendancePolicies (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        ClinicId        INT             NULL,
        PolicyName      NVARCHAR(200)   NOT NULL,
        MaxHoursPerDay  DECIMAL(5,2)    NULL,
        OvertimeAfter   DECIMAL(5,2)    NULL,
        Notes           NVARCHAR(MAX)   NULL,
        IsActive        BIT             DEFAULT 1,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: AttendancePolicies'

-- ============================================================
-- 36. ATTENDANCE ABSENCES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'AttendanceAbsences' AND type = 'U')
BEGIN
    PRINT 'CREATING: AttendanceAbsences'
    CREATE TABLE AttendanceAbsences (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        UserId      INT             NOT NULL,
        AbsenceDate DATE            NOT NULL,
        Reason      NVARCHAR(200)   NULL,
        Notes       NVARCHAR(MAX)   NULL,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: AttendanceAbsences'

-- ============================================================
-- 37. ATTENDANCE NOTIFICATIONS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'AttendanceNotifications' AND type = 'U')
BEGIN
    PRINT 'CREATING: AttendanceNotifications'
    CREATE TABLE AttendanceNotifications (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        UserId      INT             NOT NULL,
        Message     NVARCHAR(MAX)   NOT NULL,
        IsRead      BIT             DEFAULT 0,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: AttendanceNotifications'

-- ============================================================
-- 38. PTO CREDITS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'PtoCredits' AND type = 'U')
BEGIN
    PRINT 'CREATING: PtoCredits'
    CREATE TABLE PtoCredits (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        UserId      INT             NOT NULL,
        Year        INT             NOT NULL,
        TotalDays   DECIMAL(5,2)    DEFAULT 0,
        UsedDays    DECIMAL(5,2)    DEFAULT 0,
        Notes       NVARCHAR(MAX)   NULL,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME2      DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: PtoCredits'

-- ============================================================
-- 39. PTO REQUESTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'PtoRequests' AND type = 'U')
BEGIN
    PRINT 'CREATING: PtoRequests'
    CREATE TABLE PtoRequests (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        UserId          INT             NOT NULL,
        StartDate       DATE            NOT NULL,
        EndDate         DATE            NOT NULL,
        TotalDays       DECIMAL(5,2)    NULL,
        Reason          NVARCHAR(500)   NULL,
        Status          NVARCHAR(50)    DEFAULT 'Pending',
        ReviewedBy      INT             NULL,
        ReviewedAt      DATETIME2       NULL,
        Notes           NVARCHAR(MAX)   NULL,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: PtoRequests'

-- ============================================================
-- 40. USER HR INFO
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UserHRInfo' AND type = 'U')
BEGIN
    PRINT 'CREATING: UserHRInfo'
    CREATE TABLE UserHRInfo (
        Id                  INT             IDENTITY(1,1) PRIMARY KEY,
        UserId              INT             NOT NULL UNIQUE,
        EmergencyContact    NVARCHAR(200)   NULL,
        EmergencyPhone      NVARCHAR(30)    NULL,
        EmergencyRelation   NVARCHAR(100)   NULL,
        SsnLast4            NVARCHAR(10)    NULL,
        DriversLicense      NVARCHAR(50)    NULL,
        BankName            NVARCHAR(200)   NULL,
        AccountType         NVARCHAR(50)    NULL,
        RoutingNumber       NVARCHAR(20)    NULL,
        AccountNumber       NVARCHAR(30)    NULL,
        Notes               NVARCHAR(MAX)   NULL,
        CreatedDate         DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate        DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: UserHRInfo'

-- ============================================================
-- 41. USER HR BENEFITS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UserHRBenefits' AND type = 'U')
BEGIN
    PRINT 'CREATING: UserHRBenefits'
    CREATE TABLE UserHRBenefits (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        UserId          INT             NOT NULL,
        BenefitCategory NVARCHAR(100)   NOT NULL,
        BenefitName     NVARCHAR(200)   NOT NULL,
        Value           NVARCHAR(500)   NULL,
        EffectiveDate   DATE            NULL,
        ExpiryDate      DATE            NULL,
        Notes           NVARCHAR(MAX)   NULL,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: UserHRBenefits'

-- ============================================================
-- 42. SHIFT BUILDER SHIFTS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'ShiftBuilderShifts' AND type = 'U')
BEGIN
    PRINT 'CREATING: ShiftBuilderShifts'
    CREATE TABLE ShiftBuilderShifts (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        ClinicId        INT             NULL,
        WeekStart       DATE            NOT NULL,
        UserId          INT             NOT NULL,
        ShiftDate       DATE            NOT NULL,
        StartTime       NVARCHAR(10)    NOT NULL,
        EndTime         NVARCHAR(10)    NOT NULL,
        RoomId          INT             NULL,
        Notes           NVARCHAR(MAX)   NULL,
        IsPublished     BIT             DEFAULT 0,
        CreatedDate     DATETIME2       DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: ShiftBuilderShifts'

-- ============================================================
-- 43. REQUEST NOTIFICATIONS
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'RequestNotifications' AND type = 'U')
BEGIN
    PRINT 'CREATING: RequestNotifications'
    CREATE TABLE RequestNotifications (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        RequestId   INT             NOT NULL,
        UserId      INT             NOT NULL,
        Message     NVARCHAR(MAX)   NOT NULL,
        IsRead      BIT             DEFAULT 0,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: RequestNotifications'

-- ============================================================
-- 44. AUDIT LOG
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'AuditLog' AND type = 'U')
BEGIN
    PRINT 'CREATING: AuditLog'
    CREATE TABLE AuditLog (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        TableName   NVARCHAR(100)   NOT NULL,
        RecordId    INT             NOT NULL,
        Action      NVARCHAR(50)    NOT NULL,
        UserId      INT             NULL,
        OldValues   NVARCHAR(MAX)   NULL,
        NewValues   NVARCHAR(MAX)   NULL,
        IPAddress   NVARCHAR(50)    NULL,
        CreatedDate DATETIME2       DEFAULT GETUTCDATE()
    )
END
ELSE PRINT 'OK: AuditLog'

-- ============================================================
-- SUMMARY: Show all tables currently in database
-- ============================================================
PRINT ''
PRINT '=== All tables currently in this database ==='
SELECT
    t.name                                        AS TableName,
    p.rows                                        AS RowCount,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
     WHERE c.TABLE_NAME = t.name)                AS ColumnCount
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
ORDER BY t.name;
