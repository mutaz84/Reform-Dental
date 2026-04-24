-- =============================================
-- Migration: Add missing equipment persistence columns
-- Run this in Azure Portal Query Editor
-- Date: April 2026
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'Condition')
    ALTER TABLE Equipment ADD Condition NVARCHAR(50);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'ServiceIntervalDays')
    ALTER TABLE Equipment ADD ServiceIntervalDays INT;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'LastServiceDate')
    ALTER TABLE Equipment ADD LastServiceDate DATE;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'NextServiceDate')
    ALTER TABLE Equipment ADD NextServiceDate DATE;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'ServiceVendor')
    ALTER TABLE Equipment ADD ServiceVendor NVARCHAR(120);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'IsActive')
    ALTER TABLE Equipment ADD IsActive BIT CONSTRAINT DF_Equipment_IsActive DEFAULT 1;
GO

PRINT 'Equipment table updated with Condition, ServiceIntervalDays, LastServiceDate, NextServiceDate, ServiceVendor, and IsActive columns';
PRINT 'Migration complete!';