-- Run this script in Azure Portal > SQL Database > Query Editor
-- Database: reformdentaldb
-- This adds the new columns for Task Types (Regular, Floating, Bonus)

-- Add TaskType column (Regular, Floating, Bonus)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TaskType')
BEGIN
    ALTER TABLE Tasks ADD TaskType NVARCHAR(20) DEFAULT 'Regular';
    PRINT 'Added TaskType column';
END
GO

-- Add IsPaid column for bonus tasks
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'IsPaid')
BEGIN
    ALTER TABLE Tasks ADD IsPaid BIT DEFAULT 0;
    PRINT 'Added IsPaid column';
END
GO

-- Add PayAmount column for paid tasks
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'PayAmount')
BEGIN
    ALTER TABLE Tasks ADD PayAmount DECIMAL(10,2) NULL;
    PRINT 'Added PayAmount column';
END
GO

-- Add Location column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Location')
BEGIN
    ALTER TABLE Tasks ADD Location NVARCHAR(100) NULL;
    PRINT 'Added Location column';
END
GO

-- Add TimeEstimate column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TimeEstimate')
BEGIN
    ALTER TABLE Tasks ADD TimeEstimate NVARCHAR(50) NULL;
    PRINT 'Added TimeEstimate column';
END
GO

-- Add Assignee column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Assignee')
BEGIN
    ALTER TABLE Tasks ADD Assignee NVARCHAR(100) NULL;
    PRINT 'Added Assignee column';
END
GO

-- Add ClaimedBy column (who claimed the floating/bonus task)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedBy')
BEGIN
    ALTER TABLE Tasks ADD ClaimedBy NVARCHAR(100) NULL;
    PRINT 'Added ClaimedBy column';
END
GO

-- Add ClaimedAt column (when the task was claimed)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedAt')
BEGIN
    ALTER TABLE Tasks ADD ClaimedAt DATETIME NULL;
    PRINT 'Added ClaimedAt column';
END
GO

-- Verify the columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Tasks'
ORDER BY ORDINAL_POSITION;
