-- =============================================
-- Compliance Management Schema Addition
-- For existing ReformDental database
-- Added: February 2026
-- =============================================

-- =============================================
-- COMPLIANCE MANAGEMENT TABLES
-- =============================================

-- =============================================
-- 1. COMPLIANCE TYPES TABLE
-- =============================================
CREATE TABLE ComplianceTypes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(MAX),
    Category NVARCHAR(50) NOT NULL, -- 'employee', 'office', 'facility', 'regulatory'
    RequiresEmployee BIT DEFAULT 0, -- Whether this compliance type requires an employee assignment
    RequiresClinic BIT DEFAULT 0, -- Whether this compliance type requires a clinic assignment
    DefaultExpiryMonths INT, -- Default expiry period in months
    IsActive BIT DEFAULT 1,
    Color NVARCHAR(20) DEFAULT '#3b82f6',
    Icon NVARCHAR(50) DEFAULT 'fas fa-file-contract',
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- Create indexes
CREATE INDEX IX_ComplianceTypes_Category ON ComplianceTypes(Category);
CREATE INDEX IX_ComplianceTypes_IsActive ON ComplianceTypes(IsActive);

-- =============================================
-- 2. COMPLIANCES TABLE
-- =============================================
CREATE TABLE Compliances (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ComplianceTypeId INT NOT NULL FOREIGN KEY REFERENCES ComplianceTypes(Id),
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),

    -- Assignment (either employee or clinic/office)
    UserId INT FOREIGN KEY REFERENCES Users(Id), -- For employee-specific compliances
    ClinicId INT FOREIGN KEY REFERENCES Clinics(Id), -- For clinic/office-specific compliances

    -- Dates
    IssueDate DATETIME2 NOT NULL,
    ExpiryDate DATETIME2,
    ReminderDate DATETIME2, -- When to send reminder notifications

    -- Status and tracking
    Status NVARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'renewed', 'cancelled'
    Priority NVARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

    -- Attachments/Documents
    AttachmentUrl NVARCHAR(MAX), -- URL to uploaded document/file
    AttachmentName NVARCHAR(255), -- Original filename
    DocumentType NVARCHAR(100), -- 'certificate', 'license', 'training', 'inspection', etc.

    -- Additional metadata
    ReferenceNumber NVARCHAR(100), -- External reference/license number
    IssuingAuthority NVARCHAR(255), -- Who issued this compliance
    Cost DECIMAL(10,2), -- Cost of obtaining/maintaining this compliance
    Notes NVARCHAR(MAX),

    -- Audit fields
    CreatedById INT FOREIGN KEY REFERENCES Users(Id),
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedById INT FOREIGN KEY REFERENCES Users(Id),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
);

-- Create indexes
CREATE INDEX IX_Compliances_ComplianceTypeId ON Compliances(ComplianceTypeId);
CREATE INDEX IX_Compliances_UserId ON Compliances(UserId);
CREATE INDEX IX_Compliances_ClinicId ON Compliances(ClinicId);
CREATE INDEX IX_Compliances_Status ON Compliances(Status);
CREATE INDEX IX_Compliances_ExpiryDate ON Compliances(ExpiryDate);
CREATE INDEX IX_Compliances_ReminderDate ON Compliances(ReminderDate);

-- =============================================
-- INSERT DEFAULT COMPLIANCE TYPES
-- =============================================
INSERT INTO ComplianceTypes (Name, Description, Category, RequiresEmployee, RequiresClinic, DefaultExpiryMonths, Color, Icon) VALUES
('CPR Certification', 'Cardiopulmonary Resuscitation certification for clinical staff', 'employee', 1, 0, 24, '#ef4444', 'fas fa-heartbeat'),
('BLS Certification', 'Basic Life Support certification', 'employee', 1, 0, 24, '#f59e0b', 'fas fa-user-md'),
('HIPAA Training', 'Health Insurance Portability and Accountability Act training', 'employee', 1, 0, 12, '#8b5cf6', 'fas fa-shield-alt'),
('OSHA Training', 'Occupational Safety and Health Administration training', 'employee', 1, 0, 12, '#10b981', 'fas fa-hard-hat'),
('Infection Control', 'Infection control certification and training', 'employee', 1, 0, 12, '#06b6d4', 'fas fa-virus'),
('DEA License', 'Drug Enforcement Administration controlled substances license', 'employee', 1, 0, 36, '#dc2626', 'fas fa-pills'),
('State Dental License', 'State dental practice license', 'employee', 1, 0, 12, '#2563eb', 'fas fa-certificate'),
('Malpractice Insurance', 'Professional liability insurance', 'employee', 1, 0, 12, '#7c3aed', 'fas fa-balance-scale'),

-- Office/Facility Compliances
('Business License', 'Local business operation license', 'office', 0, 1, 12, '#059669', 'fas fa-building'),
('Fire Safety Inspection', 'Annual fire safety and equipment inspection', 'office', 0, 1, 12, '#dc2626', 'fas fa-fire-extinguisher'),
('X-Ray Machine Registration', 'State registration for X-ray equipment', 'facility', 0, 1, 24, '#7c2d12', 'fas fa-radiation'),
('Waste Disposal License', 'Medical waste disposal certification', 'facility', 0, 1, 12, '#365314', 'fas fa-trash-alt'),
('Water Quality Test', 'Drinking water quality testing and certification', 'facility', 0, 1, 12, '#0c4a6e', 'fas fa-tint'),
('HVAC Maintenance', 'Heating, ventilation, and air conditioning maintenance certification', 'facility', 0, 1, 12, '#7c2d12', 'fas fa-wind');
GO

-- =============================================
-- COMPLIANCE VIEWS
-- =============================================

-- View: Active Compliances
CREATE VIEW vw_ActiveCompliances AS
SELECT
    c.Id,
    ct.Name AS ComplianceType,
    ct.Category,
    c.Title,
    c.Description,
    c.IssueDate,
    c.ExpiryDate,
    c.Status,
    c.Priority,
    CASE
        WHEN c.UserId IS NOT NULL THEN u.FirstName + ' ' + ISNULL(u.LastName, '')
        ELSE cl.Name
    END AS AssignedTo,
    c.AttachmentUrl,
    c.ReferenceNumber,
    DATEDIFF(DAY, GETDATE(), c.ExpiryDate) AS DaysUntilExpiry
FROM Compliances c
JOIN ComplianceTypes ct ON c.ComplianceTypeId = ct.Id
LEFT JOIN Users u ON c.UserId = u.Id
LEFT JOIN Clinics cl ON c.ClinicId = cl.Id
WHERE c.Status = 'active' AND ct.IsActive = 1;
GO

-- View: Expiring Compliances (next 30 days)
CREATE VIEW vw_ExpiringCompliances AS
SELECT * FROM vw_ActiveCompliances
WHERE DaysUntilExpiry <= 30 AND DaysUntilExpiry >= 0
ORDER BY DaysUntilExpiry ASC;
GO

-- View: Expired Compliances
CREATE VIEW vw_ExpiredCompliances AS
SELECT * FROM vw_ActiveCompliances
WHERE DaysUntilExpiry < 0
ORDER BY DaysUntilExpiry ASC;
GO

-- View: Compliances by Employee
CREATE VIEW vw_EmployeeCompliances AS
SELECT
    u.Id AS UserId,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS EmployeeName,
    u.JobTitle,
    COUNT(c.Id) AS TotalCompliances,
    COUNT(CASE WHEN c.Status = 'active' AND c.ExpiryDate > GETDATE() THEN 1 END) AS ActiveCompliances,
    COUNT(CASE WHEN c.ExpiryDate <= GETDATE() THEN 1 END) AS ExpiredCompliances,
    MIN(DATEDIFF(DAY, GETDATE(), c.ExpiryDate)) AS ClosestExpiryDays
FROM Users u
LEFT JOIN Compliances c ON u.Id = c.UserId AND c.Status = 'active'
WHERE u.IsActive = 1 AND u.EmployeeStatus = 'active'
GROUP BY u.Id, u.FirstName, u.LastName, u.JobTitle;
GO

PRINT 'Compliance Management Schema Added Successfully!';</content>
<parameter name="filePath">C:\Users\MaxRa\OneDrive\Desktop\Application Development\Deployment\Reform-Dental\database\compliance-addition.sql