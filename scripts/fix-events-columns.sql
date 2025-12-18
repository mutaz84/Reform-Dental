-- Fix Events table to match API expectations
-- The API uses EventDate, StartTime, EndTime but schema has StartDateTime, EndDateTime
-- This script adds the columns the API expects

-- Add EventDate column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'EventDate')
BEGIN
    ALTER TABLE Events ADD EventDate DATE NULL;
    PRINT 'Added EventDate column';
END

-- Add StartTime column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'StartTime')
BEGIN
    ALTER TABLE Events ADD StartTime NVARCHAR(20) NULL;
    PRINT 'Added StartTime column';
END

-- Add EndTime column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'EndTime')
BEGIN
    ALTER TABLE Events ADD EndTime NVARCHAR(20) NULL;
    PRINT 'Added EndTime column';
END

PRINT 'Events table update complete!';
