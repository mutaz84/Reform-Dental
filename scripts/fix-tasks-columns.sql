-- Add missing columns to Tasks table
-- Run this script in Azure SQL Database

-- Add ClaimedBy column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedBy')
BEGIN
    ALTER TABLE Tasks ADD ClaimedBy NVARCHAR(100) NULL;
    PRINT 'Added ClaimedBy column';
END

-- Add ClaimedAt column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedAt')
BEGIN
    ALTER TABLE Tasks ADD ClaimedAt DATETIME NULL;
    PRINT 'Added ClaimedAt column';
END

PRINT 'Tasks table update complete!';
