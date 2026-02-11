-- =============================================
-- ReformDental Database Schema
-- Azure SQL Database
-- Created: December 2025
-- =============================================

-- =============================================
-- 1. USERS TABLE
-- =============================================
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(100),
    MiddleName NVARCHAR(100),
    LastName NVARCHAR(100),
    Gender NVARCHAR(20),
    DateOfBirth DATE,
    PersonalEmail NVARCHAR(255),
    WorkEmail NVARCHAR(255),
    HomePhone NVARCHAR(20),
    CellPhone NVARCHAR(20),
    Address NVARCHAR(255),
    City NVARCHAR(100),
    State NVARCHAR(50),
    ZipCode NVARCHAR(20),
    JobTitle NVARCHAR(100),
    StaffType NVARCHAR(50), -- 'clinical' or 'non-clinical'
    EmployeeType NVARCHAR(50), -- 'full-time', 'part-time', 'contractor'
    Department NVARCHAR(100),
    EmployeeStatus NVARCHAR(50), -- 'active', 'inactive', 'terminated'
    Role NVARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin', 'manager', 'user'
    HireDate DATE,
    HourlyRate DECIMAL(10,2),
    Salary DECIMAL(12,2),
    Color NVARCHAR(20), -- For calendar display
    ProfileImage NVARCHAR(MAX),
    Permissions NVARCHAR(MAX), -- JSON string for permissions
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE(),
    IsActive BIT DEFAULT 1
);

-- Create index on username for faster lookups
CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_StaffType ON Users(StaffType);
CREATE INDEX IX_Users_Role ON Users(Role);

-- =============================================
-- 2. CLINICS TABLE
-- =============================================
CREATE TABLE Clinics (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Address NVARCHAR(255),
    City NVARCHAR(100),
    State NVARCHAR(50),
    ZipCode NVARCHAR(20),
    Phone NVARCHAR(20),
    Email NVARCHAR(255),
    Color NVARCHAR(20),
    Icon NVARCHAR(50),
    Description NVARCHAR(MAX),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- 3. ROOMS TABLE
-- =============================================
CREATE TABLE Rooms (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ClinicId INT NOT NULL FOREIGN KEY REFERENCES Clinics(Id),
    Name NVARCHAR(100) NOT NULL,
    RoomType NVARCHAR(50), -- 'operatory', 'consultation', 'x-ray', etc.
    Description NVARCHAR(MAX),
    Color NVARCHAR(20),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Rooms_ClinicId ON Rooms(ClinicId);

-- =============================================
-- 4. SCHEDULES/SHIFTS TABLE
-- =============================================
CREATE TABLE Schedules (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL FOREIGN KEY REFERENCES Users(Id),
    ClinicId INT NOT NULL FOREIGN KEY REFERENCES Clinics(Id),
    RoomId INT FOREIGN KEY REFERENCES Rooms(Id),
    AssistantId INT FOREIGN KEY REFERENCES Users(Id),
    StartDate DATE NOT NULL,
    EndDate DATE,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    DaysOfWeek NVARCHAR(100), -- 'Mon,Tue,Wed,Thu,Fri' etc.
    Color NVARCHAR(20),
    Notes NVARCHAR(MAX),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Schedules_UserId ON Schedules(UserId);
CREATE INDEX IX_Schedules_ClinicId ON Schedules(ClinicId);
CREATE INDEX IX_Schedules_StartDate ON Schedules(StartDate);

-- =============================================
-- 5. EVENTS TABLE (Calendar Events)
-- =============================================
CREATE TABLE Events (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    EventType NVARCHAR(50), -- 'appointment', 'meeting', 'break', etc.
    StartDateTime DATETIME2 NOT NULL,
    EndDateTime DATETIME2 NOT NULL,
    AllDay BIT DEFAULT 0,
    UserId INT FOREIGN KEY REFERENCES Users(Id),
    ClinicId INT FOREIGN KEY REFERENCES Clinics(Id),
    RoomId INT FOREIGN KEY REFERENCES Rooms(Id),
    Color NVARCHAR(20),
    Priority NVARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    Status NVARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    RecurrenceRule NVARCHAR(255), -- iCal RRULE format
    CreatedBy INT FOREIGN KEY REFERENCES Users(Id),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Events_StartDateTime ON Events(StartDateTime);
CREATE INDEX IX_Events_UserId ON Events(UserId);
CREATE INDEX IX_Events_ClinicId ON Events(ClinicId);

-- =============================================
-- 6. TASKS TABLE
-- =============================================
CREATE TABLE Tasks (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    Category NVARCHAR(50), -- 'Clinical', 'Administrative', 'Compliance', etc.
    Priority NVARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Completed', 'Overdue'
    DueDate DATE,
    DueTime TIME,
    AssignedToId INT FOREIGN KEY REFERENCES Users(Id),
    AssignedById INT FOREIGN KEY REFERENCES Users(Id),
    ClinicId INT FOREIGN KEY REFERENCES Clinics(Id),
    CompletedDate DATETIME2,
    CompletedById INT FOREIGN KEY REFERENCES Users(Id),
    Notes NVARCHAR(MAX),
    Tags NVARCHAR(MAX), -- JSON array of tags
    IsRecurring BIT DEFAULT 0,
    RecurrenceRule NVARCHAR(255),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Tasks_AssignedToId ON Tasks(AssignedToId);
CREATE INDEX IX_Tasks_DueDate ON Tasks(DueDate);
CREATE INDEX IX_Tasks_Status ON Tasks(Status);
CREATE INDEX IX_Tasks_Category ON Tasks(Category);

-- =============================================
-- 7. TASK TEMPLATES TABLE
-- =============================================
CREATE TABLE TaskTemplates (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    Category NVARCHAR(50),
    Priority NVARCHAR(20) DEFAULT 'Medium',
    DefaultAssigneeRole NVARCHAR(50),
    EstimatedDuration INT, -- in minutes
    Icon NVARCHAR(50),
    Color NVARCHAR(20),
    IsActive BIT DEFAULT 1,
    CreatedById INT FOREIGN KEY REFERENCES Users(Id),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- 8. EQUIPMENT TABLE
-- =============================================
CREATE TABLE Equipment (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100),
    Brand NVARCHAR(100),
    Model NVARCHAR(100),
    SerialNumber NVARCHAR(100),
    Description NVARCHAR(MAX),
    ClinicId INT FOREIGN KEY REFERENCES Clinics(Id),
    RoomId INT FOREIGN KEY REFERENCES Rooms(Id),
    PurchaseDate DATE,
    PurchasePrice DECIMAL(12,2),
    WarrantyExpiry DATE,
    Status NVARCHAR(50) DEFAULT 'operational', -- 'operational', 'maintenance', 'repair', 'retired'
    MaintenanceSchedule NVARCHAR(50), -- 'weekly', 'monthly', 'quarterly', 'yearly'
    LastMaintenanceDate DATE,
    NextMaintenanceDate DATE,
    VendorId INT,
    Notes NVARCHAR(MAX),
    Warnings NVARCHAR(MAX),
    ImageUrl NVARCHAR(MAX),
    DocumentUrl NVARCHAR(MAX),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Equipment_ClinicId ON Equipment(ClinicId);
CREATE INDEX IX_Equipment_Status ON Equipment(Status);

-- =============================================
-- 9. SUPPLIES TABLE
-- =============================================
CREATE TABLE Supplies (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100),
    SKU NVARCHAR(50),
    Description NVARCHAR(MAX),
    Unit NVARCHAR(50), -- 'box', 'pack', 'piece', etc.
    QuantityInStock INT DEFAULT 0,
    MinimumStock INT DEFAULT 0,
    ReorderPoint INT DEFAULT 0,
    UnitCost DECIMAL(10,2),
    ClinicId INT FOREIGN KEY REFERENCES Clinics(Id),
    StorageLocation NVARCHAR(100),
    VendorId INT,
    ExpirationDate DATE,
    Notes NVARCHAR(MAX),
    Warnings NVARCHAR(MAX),
    ImageUrl NVARCHAR(MAX),
    DocumentUrl NVARCHAR(MAX),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Supplies_Category ON Supplies(Category);
CREATE INDEX IX_Supplies_ClinicId ON Supplies(ClinicId);

-- =============================================
-- 10. INSTRUMENTS TABLE
-- =============================================
CREATE TABLE Instruments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100), -- 'diagnostic', 'surgical', 'cutting', 'filling', etc.
    Description NVARCHAR(MAX),
    Quantity INT DEFAULT 1,
    ClinicId INT FOREIGN KEY REFERENCES Clinics(Id),
    SterilizationRequired BIT DEFAULT 1,
    Status NVARCHAR(50) DEFAULT 'available', -- 'available', 'in-use', 'sterilizing', 'damaged'
    PurchaseDate DATE,
    UnitCost DECIMAL(10,2),
    VendorId INT,
    Notes NVARCHAR(MAX),
    Warnings NVARCHAR(MAX),
    ImageUrl NVARCHAR(MAX),
    DocumentUrl NVARCHAR(MAX),
    Icon NVARCHAR(50),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Instruments_Category ON Instruments(Category);
CREATE INDEX IX_Instruments_ClinicId ON Instruments(ClinicId);

-- =============================================
-- 11. CATEGORIES TABLE
-- =============================================
CREATE TABLE Categories (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    CategoryType NVARCHAR(50) NOT NULL, -- 'equipment', 'instruments', 'supplies'
    Description NVARCHAR(MAX),
    SortOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Categories_CategoryType ON Categories(CategoryType);
CREATE INDEX IX_Categories_IsActive ON Categories(IsActive);

-- =============================================
-- 12. VENDOR TYPES TABLE
-- =============================================
CREATE TABLE VendorTypes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    SortOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- 13. PROCEDURES TABLE
-- =============================================
CREATE TABLE Procedures (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Category NVARCHAR(100),
    EstimatedDuration INT, -- in minutes
    IsTemplate BIT DEFAULT 0,
    CreatedById INT FOREIGN KEY REFERENCES Users(Id),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- 12. PROCEDURE INSTRUMENTS (Many-to-Many)
-- =============================================
CREATE TABLE ProcedureInstruments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProcedureId INT NOT NULL FOREIGN KEY REFERENCES Procedures(Id) ON DELETE CASCADE,
    InstrumentId INT NOT NULL FOREIGN KEY REFERENCES Instruments(Id),
    Quantity INT DEFAULT 1,
    Position INT, -- Order/position in the tray
    Notes NVARCHAR(MAX)
);

CREATE INDEX IX_ProcedureInstruments_ProcedureId ON ProcedureInstruments(ProcedureId);

-- =============================================
-- 13. VENDORS TABLE
-- =============================================
CREATE TABLE Vendors (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    ContactName NVARCHAR(100),
    Email NVARCHAR(255),
    Phone NVARCHAR(20),
    Address NVARCHAR(255),
    City NVARCHAR(100),
    State NVARCHAR(50),
    ZipCode NVARCHAR(20),
    Website NVARCHAR(255),
    Category NVARCHAR(100), -- 'equipment', 'supplies', 'instruments'
    Notes NVARCHAR(MAX),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- 14. STICKY NOTES TABLE
-- =============================================
CREATE TABLE StickyNotes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Content NVARCHAR(MAX) NOT NULL,
    Color NVARCHAR(20) DEFAULT '#fef3c7',
    UserId INT FOREIGN KEY REFERENCES Users(Id),
    Position NVARCHAR(100), -- JSON {x, y} coordinates
    IsDeleted BIT DEFAULT 0,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_StickyNotes_UserId ON StickyNotes(UserId);

-- =============================================
-- 15. AUDIT LOG TABLE (for tracking changes)
-- =============================================
CREATE TABLE AuditLog (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TableName NVARCHAR(100) NOT NULL,
    RecordId INT NOT NULL,
    Action NVARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    UserId INT FOREIGN KEY REFERENCES Users(Id),
    OldValues NVARCHAR(MAX), -- JSON
    NewValues NVARCHAR(MAX), -- JSON
    IPAddress NVARCHAR(50),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_AuditLog_TableName ON AuditLog(TableName);
CREATE INDEX IX_AuditLog_CreatedDate ON AuditLog(CreatedDate);

-- =============================================
-- INSERT DEFAULT ADMIN USER
-- Password: 'admin' (you should change this!)
-- =============================================
INSERT INTO Users (Username, PasswordHash, FirstName, LastName, Role, StaffType, EmployeeStatus, IsActive)
VALUES ('admin', 'admin123', 'System', 'Administrator', 'admin', 'non-clinical', 'active', 1);
GO

-- =============================================
-- HELPFUL VIEWS
-- =============================================

-- View: Active Employees with details
CREATE VIEW vw_ActiveEmployees AS
SELECT 
    u.Id,
    u.Username,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS FullName,
    u.JobTitle,
    u.StaffType,
    u.Role,
    u.WorkEmail,
    u.CellPhone,
    u.Color
FROM Users u
WHERE u.IsActive = 1 AND u.EmployeeStatus = 'active';
GO

-- View: Today's Schedules
CREATE VIEW vw_TodaySchedules AS
SELECT 
    s.Id,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS EmployeeName,
    c.Name AS ClinicName,
    r.Name AS RoomName,
    s.StartTime,
    s.EndTime,
    s.DaysOfWeek
FROM Schedules s
JOIN Users u ON s.UserId = u.Id
JOIN Clinics c ON s.ClinicId = c.Id
LEFT JOIN Rooms r ON s.RoomId = r.Id
WHERE s.IsActive = 1
    AND CAST(GETDATE() AS DATE) BETWEEN s.StartDate AND ISNULL(s.EndDate, '2099-12-31')
    AND s.DaysOfWeek LIKE '%' + LEFT(DATENAME(WEEKDAY, GETDATE()), 3) + '%';
GO

-- View: Pending Tasks
CREATE VIEW vw_PendingTasks AS
SELECT 
    t.Id,
    t.Title,
    t.Category,
    t.Priority,
    t.DueDate,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS AssignedTo,
    c.Name AS ClinicName
FROM Tasks t
LEFT JOIN Users u ON t.AssignedToId = u.Id
LEFT JOIN Clinics c ON t.ClinicId = c.Id
WHERE t.Status IN ('Pending', 'In Progress');
GO

-- View: Low Stock Supplies
CREATE VIEW vw_LowStockSupplies AS
SELECT 
    s.Id,
    s.Name,
    s.Category,
    s.QuantityInStock,
    s.MinimumStock,
    s.ReorderPoint,
    c.Name AS ClinicName
FROM Supplies s
LEFT JOIN Clinics c ON s.ClinicId = c.Id
WHERE s.QuantityInStock <= s.ReorderPoint AND s.IsActive = 1;
GO

PRINT 'ReformDental Database Schema Created Successfully!';
