-- ============================================================
-- TASKS TABLE - Safe column migration
-- Adds missing columns ONLY if they do not already exist.
-- Safe to run multiple times. Does NOT drop or recreate the
-- table and does NOT touch any other table.
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TaskType')
    ALTER TABLE Tasks ADD TaskType NVARCHAR(50) DEFAULT 'Regular';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'IsPaid')
    ALTER TABLE Tasks ADD IsPaid BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'PayAmount')
    ALTER TABLE Tasks ADD PayAmount DECIMAL(10,2) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Location')
    ALTER TABLE Tasks ADD Location NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TimeEstimate')
    ALTER TABLE Tasks ADD TimeEstimate NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Assignee')
    ALTER TABLE Tasks ADD Assignee NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedBy')
    ALTER TABLE Tasks ADD ClaimedBy NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedAt')
    ALTER TABLE Tasks ADD ClaimedAt DATETIME NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ComplianceFlag')
    ALTER TABLE Tasks ADD ComplianceFlag BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceId')
    ALTER TABLE Tasks ADD LinkedComplianceId INT NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceTitle')
    ALTER TABLE Tasks ADD LinkedComplianceTitle NVARCHAR(255) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'LinkedComplianceStatus')
    ALTER TABLE Tasks ADD LinkedComplianceStatus NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'DueTime')
    ALTER TABLE Tasks ADD DueTime NVARCHAR(10) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ModifiedDate')
    ALTER TABLE Tasks ADD ModifiedDate DATETIME2 DEFAULT GETUTCDATE();

-- Confirm what columns Tasks now has
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Tasks'
ORDER BY ORDINAL_POSITION;
