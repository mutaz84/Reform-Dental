-- =============================================
-- Create Roles Table for Reform Dental
-- Run this in Azure Portal Query Editor
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Roles' AND xtype='U')
BEGIN
    CREATE TABLE Roles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RoleName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX),
        Duties NVARCHAR(MAX),
        Responsibilities NVARCHAR(MAX),
        FileUrl NVARCHAR(500),
        FileName NVARCHAR(255),
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME
    );
    PRINT 'Created Roles table';
    
    INSERT INTO Roles (RoleName, Description, Duties, Responsibilities) VALUES 
    ('Admin', 'System Administrator', 'Full system management', 'Manage all aspects of the system'),
    ('Dentist', 'Dental Provider', 'Patient care and treatment', 'Provide dental services'),
    ('Hygienist', 'Dental Hygienist', 'Cleanings and preventive care', 'Perform dental cleanings'),
    ('Assistant', 'Dental Assistant', 'Assist with procedures', 'Support dentists during procedures'),
    ('Receptionist', 'Front Desk Staff', 'Patient scheduling', 'Manage appointments'),
    ('Office Manager', 'Office Administration', 'Office operations', 'Oversee daily operations');
    PRINT 'Inserted default roles';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'RoleId')
BEGIN
    ALTER TABLE Users ADD RoleId INT;
    PRINT 'Added RoleId column to Users table';
END
GO
