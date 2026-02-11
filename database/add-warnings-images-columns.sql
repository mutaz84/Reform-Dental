-- =============================================
-- Migration: Add Warnings, Notes, ImageUrl, DocumentUrl columns
-- to Equipment, Instruments, and Supplies tables
-- Run this in Azure Portal Query Editor
-- Date: February 2026
-- =============================================

-- =============================================
-- EQUIPMENT TABLE - Add new columns
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'Notes')
    ALTER TABLE Equipment ADD Notes NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'Warnings')
    ALTER TABLE Equipment ADD Warnings NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'ImageUrl')
    ALTER TABLE Equipment ADD ImageUrl NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Equipment') AND name = 'DocumentUrl')
    ALTER TABLE Equipment ADD DocumentUrl NVARCHAR(MAX);
GO

PRINT 'Equipment table updated with Notes, Warnings, ImageUrl, DocumentUrl columns';

-- =============================================
-- INSTRUMENTS TABLE - Add new columns
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Instruments') AND name = 'Notes')
    ALTER TABLE Instruments ADD Notes NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Instruments') AND name = 'Warnings')
    ALTER TABLE Instruments ADD Warnings NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Instruments') AND name = 'ImageUrl')
    ALTER TABLE Instruments ADD ImageUrl NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Instruments') AND name = 'DocumentUrl')
    ALTER TABLE Instruments ADD DocumentUrl NVARCHAR(MAX);
GO

PRINT 'Instruments table updated with Notes, Warnings, ImageUrl, DocumentUrl columns';

-- =============================================
-- SUPPLIES TABLE - Add new columns
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Supplies') AND name = 'Notes')
    ALTER TABLE Supplies ADD Notes NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Supplies') AND name = 'Warnings')
    ALTER TABLE Supplies ADD Warnings NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Supplies') AND name = 'ImageUrl')
    ALTER TABLE Supplies ADD ImageUrl NVARCHAR(MAX);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Supplies') AND name = 'DocumentUrl')
    ALTER TABLE Supplies ADD DocumentUrl NVARCHAR(MAX);
GO

PRINT 'Supplies table updated with Notes, Warnings, ImageUrl, DocumentUrl columns';
PRINT 'Migration complete!';
