-- Run this script in Azure Portal > SQL Database > Query Editor
-- Database: reformdentaldb
-- This creates the Duties table for managing employee duties

-- Create Duties table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Duties')
BEGIN
    CREATE TABLE Duties (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Schedule NVARCHAR(50) DEFAULT 'Daily', -- Daily, Weekly, Monthly, Custom
        ScheduleTime NVARCHAR(50) NULL, -- e.g., "7:30 AM", "8:00 AM - 5:00 PM"
        ScheduleDay NVARCHAR(50) NULL, -- e.g., "Monday", "Every Friday"
        Location NVARCHAR(100) NULL,
        Priority NVARCHAR(20) DEFAULT 'Medium', -- High, Medium, Low
        AssignedToUserId INT NULL,
        CreatedDate DATETIME DEFAULT GETDATE(),
        ModifiedDate DATETIME DEFAULT GETDATE(),
        IsActive BIT DEFAULT 1,
        FOREIGN KEY (AssignedToUserId) REFERENCES Users(Id)
    );
    PRINT 'Created Duties table';
END
GO

-- Create UserDuties junction table for many-to-many relationship
-- This allows assigning multiple duties to multiple users
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserDuties')
BEGIN
    CREATE TABLE UserDuties (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        DutyId INT NOT NULL,
        AssignedDate DATETIME DEFAULT GETDATE(),
        IsActive BIT DEFAULT 1,
        FOREIGN KEY (UserId) REFERENCES Users(Id),
        FOREIGN KEY (DutyId) REFERENCES Duties(Id),
        CONSTRAINT UQ_UserDuty UNIQUE (UserId, DutyId)
    );
    PRINT 'Created UserDuties junction table';
END
GO

-- Insert some default duties
INSERT INTO Duties (Name, Description, Schedule, ScheduleTime, ScheduleDay, Location, Priority)
VALUES 
('Morning Sterilization', 'Sterilize all equipment before clinic opens', 'Daily', '7:30 AM', NULL, 'Sterilization Room', 'High'),
('Patient Check-ins', 'Process patient arrivals and verify appointments', 'Daily', '8:00 AM - 5:00 PM', NULL, 'Front Desk', 'Medium'),
('Inventory Check', 'Weekly inventory count and reorder supplies', 'Weekly', NULL, 'Every Friday', 'Supply Room', 'Medium'),
('End-of-Day Reconciliation', 'Balance cash drawer and close out day', 'Daily', '5:00 PM', NULL, 'Front Desk', 'High'),
('Room Turnover', 'Clean and prepare rooms between patients', 'Daily', 'As needed', NULL, 'All Treatment Rooms', 'High'),
('Lab Case Follow-up', 'Check status of pending lab cases', 'Daily', '10:00 AM', NULL, 'Lab Area', 'Medium'),
('Equipment Maintenance Log', 'Record daily equipment checks', 'Daily', '7:00 AM', NULL, 'Equipment Room', 'Low'),
('Insurance Verification', 'Verify insurance for next day appointments', 'Daily', '4:00 PM', NULL, 'Admin Office', 'Medium');
GO

-- Verify the tables were created
SELECT 'Duties' as TableName, COUNT(*) as RecordCount FROM Duties WHERE IsActive = 1
UNION ALL
SELECT 'UserDuties' as TableName, COUNT(*) as RecordCount FROM UserDuties WHERE IsActive = 1;
