-- =============================================
-- Reform Dental - Complete Database Setup Script
-- Run this in Azure Portal Query Editor
-- =============================================

-- NOTE: Clinics, Rooms, and Users tables should already exist
-- This script creates the missing tables

-- =============================================
-- 1. VENDORS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Vendors' AND xtype='U')
BEGIN
    CREATE TABLE Vendors (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        VendorType NVARCHAR(100),
        ContactName NVARCHAR(255),
        Phone NVARCHAR(50),
        AlternatePhone NVARCHAR(50),
        Email NVARCHAR(255),
        Address NVARCHAR(500),
        City NVARCHAR(100),
        State NVARCHAR(50),
        ZipCode NVARCHAR(20),
        Website NVARCHAR(255),
        Notes NVARCHAR(MAX),
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME
    );
    PRINT 'Created Vendors table';
END
ELSE
    PRINT 'Vendors table already exists';
GO

-- =============================================
-- 2. EQUIPMENT TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Equipment' AND xtype='U')
BEGIN
    CREATE TABLE Equipment (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Category NVARCHAR(100),
        Brand NVARCHAR(100),
        Model NVARCHAR(100),
        SerialNumber NVARCHAR(100),
        Description NVARCHAR(MAX),
        Status NVARCHAR(50) DEFAULT 'operational',
        ClinicId INT,
        PurchaseDate DATE,
        PurchasePrice DECIMAL(10,2),
        WarrantyExpiry DATE,
        Notes NVARCHAR(MAX),
        Warnings NVARCHAR(MAX),
        ImageUrl NVARCHAR(MAX),
        DocumentUrl NVARCHAR(MAX),
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (ClinicId) REFERENCES Clinics(Id)
    );
    PRINT 'Created Equipment table';
END
ELSE
    PRINT 'Equipment table already exists';
GO

-- =============================================
-- 3. INSTRUMENTS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Instruments' AND xtype='U')
BEGIN
    CREATE TABLE Instruments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        SkuNumber NVARCHAR(100),
        Category NVARCHAR(100),
        Description NVARCHAR(MAX),
        Quantity INT DEFAULT 1,
        Status NVARCHAR(50) DEFAULT 'available',
        ClinicId INT,
        SterilizationRequired BIT DEFAULT 1,
        Notes NVARCHAR(MAX),
        Warnings NVARCHAR(MAX),
        ImageUrl NVARCHAR(MAX),
        DocumentUrl NVARCHAR(MAX),
        Icon NVARCHAR(100),
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (ClinicId) REFERENCES Clinics(Id)
    );
    PRINT 'Created Instruments table';
END
ELSE
    PRINT 'Instruments table already exists';
GO

-- =============================================
-- 4. SUPPLIES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Supplies' AND xtype='U')
BEGIN
    CREATE TABLE Supplies (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Category NVARCHAR(100),
        SKU NVARCHAR(50),
        Description NVARCHAR(MAX),
        Unit NVARCHAR(50),
        QuantityInStock INT DEFAULT 0,
        MinimumStock INT DEFAULT 0,
        ReorderPoint INT DEFAULT 0,
        UnitCost DECIMAL(10,2),
        ClinicId INT,
        Notes NVARCHAR(MAX),
        Warnings NVARCHAR(MAX),
        ImageUrl NVARCHAR(MAX),
        DocumentUrl NVARCHAR(MAX),
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (ClinicId) REFERENCES Clinics(Id)
    );
    PRINT 'Created Supplies table';
END
ELSE
    PRINT 'Supplies table already exists';
GO

-- =============================================
-- 5. SCHEDULES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Schedules' AND xtype='U')
BEGIN
    CREATE TABLE Schedules (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT,
        ClinicId INT,
        RoomId INT,
        StartDate DATE NOT NULL,
        EndDate DATE,
        StartTime VARCHAR(10),
        EndTime VARCHAR(10),
        DaysOfWeek NVARCHAR(50),
        Color NVARCHAR(20),
        Notes NVARCHAR(MAX),
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (UserId) REFERENCES Users(Id),
        FOREIGN KEY (ClinicId) REFERENCES Clinics(Id),
        FOREIGN KEY (RoomId) REFERENCES Rooms(Id)
    );
    PRINT 'Created Schedules table';
END
ELSE
    PRINT 'Schedules table already exists';
GO

-- =============================================
-- 6. TASKS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tasks' AND xtype='U')
BEGIN
    CREATE TABLE Tasks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Category NVARCHAR(100),
        Priority NVARCHAR(20) DEFAULT 'Medium',
        Status NVARCHAR(50) DEFAULT 'Pending',
        DueDate DATE,
        AssignedToId INT,
        ClinicId INT,
        TaskType NVARCHAR(50) DEFAULT 'Regular',
        IsPaid BIT DEFAULT 0,
        PayAmount DECIMAL(10,2),
        Location NVARCHAR(255),
        TimeEstimate NVARCHAR(50),
        Assignee NVARCHAR(255),
        ClaimedBy NVARCHAR(255),
        ClaimedAt DATETIME,
        CompletedAt DATETIME,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (AssignedToId) REFERENCES Users(Id),
        FOREIGN KEY (ClinicId) REFERENCES Clinics(Id)
    );
    PRINT 'Created Tasks table';
END
ELSE
    PRINT 'Tasks table already exists';
GO

-- =============================================
-- 7. DUTIES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Duties' AND xtype='U')
BEGIN
    CREATE TABLE Duties (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Schedule NVARCHAR(50) DEFAULT 'Daily',
        ScheduleTime NVARCHAR(20),
        ScheduleDay NVARCHAR(50),
        Location NVARCHAR(255),
        Priority NVARCHAR(20) DEFAULT 'Medium',
        AssignedToUserId INT,
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (AssignedToUserId) REFERENCES Users(Id)
    );
    PRINT 'Created Duties table';
END
ELSE
    PRINT 'Duties table already exists';
GO

-- =============================================
-- 8. CATEGORIES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Categories' AND xtype='U')
BEGIN
    CREATE TABLE Categories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        CategoryType NVARCHAR(50) NOT NULL, -- 'equipment', 'instruments', 'supplies'
        Description NVARCHAR(MAX),
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME
    );
    CREATE INDEX IX_Categories_CategoryType ON Categories(CategoryType);
    
    -- Insert default Equipment categories
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Autoclave', 'equipment', 1);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Ultrasonic Cleaner', 'equipment', 2);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('X-Ray Unit', 'equipment', 3);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Panoramic X-Ray', 'equipment', 4);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Intraoral Camera', 'equipment', 5);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Dental Chair', 'equipment', 6);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('High-Speed Handpiece', 'equipment', 7);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Low-Speed Handpiece', 'equipment', 8);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Curing Light', 'equipment', 9);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Computer/Workstation', 'equipment', 10);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Server', 'equipment', 11);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Compressor', 'equipment', 12);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Vacuum Pump', 'equipment', 13);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('HVAC System', 'equipment', 14);
    
    -- Insert default Instruments categories
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Diagnostic', 'instruments', 1);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Surgical', 'instruments', 2);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Restorative', 'instruments', 3);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Endodontic', 'instruments', 4);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Periodontal', 'instruments', 5);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Orthodontic', 'instruments', 6);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Prosthodontic', 'instruments', 7);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Hygiene', 'instruments', 8);
    
    -- Insert default Supplies categories
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Disposables', 'supplies', 1);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Dental Materials', 'supplies', 2);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Anesthetics', 'supplies', 3);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Infection Control', 'supplies', 4);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Office Supplies', 'supplies', 5);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Lab Supplies', 'supplies', 6);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('PPE', 'supplies', 7);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Impression Materials', 'supplies', 8);
    INSERT INTO Categories (Name, CategoryType, SortOrder) VALUES ('Cements & Adhesives', 'supplies', 9);
    
    PRINT 'Created Categories table with default data';
END
ELSE
    PRINT 'Categories table already exists';
GO

-- =============================================
-- 8.5 VENDOR TYPES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VendorTypes' AND xtype='U')
BEGIN
    CREATE TABLE VendorTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        SortOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME
    );
    
    -- Insert default vendor types
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Dental Supplies', 1);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Lab', 2);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Equipment', 3);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Software', 4);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Services', 5);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Office Supplies', 6);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Insurance', 7);
    INSERT INTO VendorTypes (Name, SortOrder) VALUES ('Utilities', 8);
    
    PRINT 'Created VendorTypes table with default data';
END
ELSE
    PRINT 'VendorTypes table already exists';
GO

-- =============================================
-- 8. SETTINGS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Settings' AND xtype='U')
BEGIN
    CREATE TABLE Settings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(MAX),
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME
    );
    PRINT 'Created Settings table';
    
    -- Insert default settings
    INSERT INTO Settings (SettingKey, SettingValue) VALUES ('companyName', 'Reform Dental');
    INSERT INTO Settings (SettingKey, SettingValue) VALUES ('tagline', 'Management System');
    PRINT 'Inserted default settings';
END
ELSE
    PRINT 'Settings table already exists';
GO

-- =============================================
-- 9. EVENTS TABLE (Calendar Events)
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Events' AND xtype='U')
BEGIN
    CREATE TABLE Events (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        StartDateTime DATETIME NOT NULL,
        EndDateTime DATETIME,
        AllDay BIT DEFAULT 0,
        EventType NVARCHAR(100),
        EventCategory NVARCHAR(100),
        ClinicId INT,
        RoomId INT,
        ProviderId INT,
        PatientName NVARCHAR(255),
        Color NVARCHAR(20),
        Status NVARCHAR(50) DEFAULT 'scheduled',
        IsRecurring BIT DEFAULT 0,
        RecurrencePattern NVARCHAR(100),
        Notes NVARCHAR(MAX),
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (ClinicId) REFERENCES Clinics(Id),
        FOREIGN KEY (RoomId) REFERENCES Rooms(Id),
        FOREIGN KEY (ProviderId) REFERENCES Users(Id)
    );
    PRINT 'Created Events table';
END
ELSE
    PRINT 'Events table already exists';
GO

-- =============================================
-- 10. CHAT MESSAGES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatMessages' AND xtype='U')
BEGIN
    CREATE TABLE ChatMessages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SenderId INT NOT NULL,
        ReceiverId INT,
        Message NVARCHAR(MAX) NOT NULL,
        IsRead BIT DEFAULT 0,
        MessageType NVARCHAR(50) DEFAULT 'text',
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        FOREIGN KEY (SenderId) REFERENCES Users(Id),
        FOREIGN KEY (ReceiverId) REFERENCES Users(Id)
    );
    PRINT 'Created ChatMessages table';
END
ELSE
    PRINT 'ChatMessages table already exists';
GO

-- =============================================
-- 11. STICKY NOTES TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StickyNotes' AND xtype='U')
BEGIN
    CREATE TABLE StickyNotes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Text NVARCHAR(MAX),
        PositionX INT DEFAULT 100,
        PositionY INT DEFAULT 100,
        Color NVARCHAR(50) DEFAULT 'yellow',
        UserId INT,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME,
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
    PRINT 'Created StickyNotes table';
END
ELSE
    PRINT 'StickyNotes table already exists';
GO

-- =============================================
-- 12. REQUESTS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Requests' AND xtype='U')
BEGIN
    CREATE TABLE Requests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Type NVARCHAR(100),
        Priority NVARCHAR(50) DEFAULT 'Medium',
        Status NVARCHAR(50) DEFAULT 'New',
        RequestedBy NVARCHAR(255),
        AssignedTo NVARCHAR(MAX),
        RequestedAt DATETIME2 DEFAULT SYSDATETIME(),
        NeededBy NVARCHAR(50),
        Location NVARCHAR(255),
        Equipment NVARCHAR(255),
        Vendor NVARCHAR(255),
        Description NVARCHAR(MAX)
    );
    PRINT 'Created Requests table';
END
ELSE
    PRINT 'Requests table already exists';
GO

-- =============================================
-- 13. REQUEST COMMENTS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RequestComments' AND xtype='U')
BEGIN
    CREATE TABLE RequestComments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        CommentText NVARCHAR(MAX) NOT NULL,
        CreatedBy NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT SYSDATETIME(),
        FOREIGN KEY (RequestId) REFERENCES Requests(Id)
    );
    CREATE INDEX IX_RequestComments_RequestId ON RequestComments(RequestId);
    PRINT 'Created RequestComments table';
END
ELSE
    PRINT 'RequestComments table already exists';
GO

-- =============================================
-- 14. REQUEST ATTACHMENTS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RequestAttachments' AND xtype='U')
BEGIN
    CREATE TABLE RequestAttachments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        ContentType NVARCHAR(255) NOT NULL,
        SizeBytes INT,
        Data VARBINARY(MAX) NOT NULL,
        UploadedBy NVARCHAR(255),
        UploadedAt DATETIME2 DEFAULT SYSDATETIME(),
        FOREIGN KEY (RequestId) REFERENCES Requests(Id)
    );
    CREATE INDEX IX_RequestAttachments_RequestId ON RequestAttachments(RequestId);
    PRINT 'Created RequestAttachments table';
END
ELSE
    PRINT 'RequestAttachments table already exists';
GO

-- =============================================
-- 15. REQUEST ROUTING LOG TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RequestRoutingLog' AND xtype='U')
BEGIN
    CREATE TABLE RequestRoutingLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        FromUser NVARCHAR(255) NULL,
        ToUser NVARCHAR(255) NOT NULL,
        Action NVARCHAR(50) NOT NULL,
        Note NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_RequestRoutingLog_RequestId_CreatedAt ON RequestRoutingLog(RequestId, CreatedAt DESC);
    PRINT 'Created RequestRoutingLog table';
END
ELSE
    PRINT 'RequestRoutingLog table already exists';
GO

-- =============================================
-- 16. REQUEST NOTIFICATIONS TABLE
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RequestNotifications' AND xtype='U')
BEGIN
    CREATE TABLE RequestNotifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        ToUser NVARCHAR(255) NOT NULL,
        FromUser NVARCHAR(255) NULL,
        NotificationType NVARCHAR(50) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        IsRead BIT NOT NULL DEFAULT 0,
        ReadAt DATETIME2 NULL
    );
    CREATE INDEX IX_RequestNotifications_ToUser_IsRead_CreatedAt ON RequestNotifications(ToUser, IsRead, CreatedAt DESC);
    PRINT 'Created RequestNotifications table';
END
ELSE
    PRINT 'RequestNotifications table already exists';
GO

-- =============================================
-- VERIFY ALL TABLES
-- =============================================
SELECT 
    t.name AS TableName,
    (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS ColumnCount
FROM sys.tables t
WHERE t.name IN ('Clinics', 'Rooms', 'Users', 'Vendors', 'Equipment', 'Instruments', 
                 'Supplies', 'Schedules', 'Tasks', 'Duties', 'Settings', 'Events', 'ChatMessages', 'StickyNotes',
                 'Requests', 'RequestComments', 'RequestAttachments', 'RequestRoutingLog', 'RequestNotifications', 'Categories')
ORDER BY t.name;

PRINT '';
PRINT '=============================================';
PRINT 'Database setup complete!';
PRINT 'All tables are ready for use.';
PRINT '=============================================';
