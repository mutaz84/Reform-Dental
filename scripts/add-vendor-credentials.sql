-- =============================================
-- Add Portal Credentials to Vendors Table
-- Run this in Azure Portal Query Editor
-- =============================================

-- Add PortalUsername column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'PortalUsername')
BEGIN
    ALTER TABLE Vendors ADD PortalUsername NVARCHAR(255);
    PRINT 'Added PortalUsername column to Vendors table';
END
ELSE
    PRINT 'PortalUsername column already exists';
GO

-- Add PortalPassword column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'PortalPassword')
BEGIN
    ALTER TABLE Vendors ADD PortalPassword NVARCHAR(255);
    PRINT 'Added PortalPassword column to Vendors table';
END
ELSE
    PRINT 'PortalPassword column already exists';
GO

PRINT 'Vendor credentials columns setup complete!';
