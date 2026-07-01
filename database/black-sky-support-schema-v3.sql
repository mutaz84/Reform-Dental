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