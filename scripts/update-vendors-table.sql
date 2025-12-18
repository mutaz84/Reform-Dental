-- Add missing columns to Vendors table for full sync support
-- Run this script in Azure SQL Database

-- Add VendorType column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'VendorType')
BEGIN
    ALTER TABLE Vendors ADD VendorType NVARCHAR(100) NULL;
    PRINT 'Added VendorType column';
END

-- Add AlternatePhone column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'AlternatePhone')
BEGIN
    ALTER TABLE Vendors ADD AlternatePhone NVARCHAR(50) NULL;
    PRINT 'Added AlternatePhone column';
END

-- Add City column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'City')
BEGIN
    ALTER TABLE Vendors ADD City NVARCHAR(100) NULL;
    PRINT 'Added City column';
END

-- Add State column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'State')
BEGIN
    ALTER TABLE Vendors ADD State NVARCHAR(50) NULL;
    PRINT 'Added State column';
END

-- Add ZipCode column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'ZipCode')
BEGIN
    ALTER TABLE Vendors ADD ZipCode NVARCHAR(20) NULL;
    PRINT 'Added ZipCode column';
END

-- Add Website column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'Website')
BEGIN
    ALTER TABLE Vendors ADD Website NVARCHAR(255) NULL;
    PRINT 'Added Website column';
END

-- Add CreatedDate column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'CreatedDate')
BEGIN
    ALTER TABLE Vendors ADD CreatedDate DATETIME DEFAULT GETDATE();
    PRINT 'Added CreatedDate column';
END

-- Add ModifiedDate column if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'ModifiedDate')
BEGIN
    ALTER TABLE Vendors ADD ModifiedDate DATETIME NULL;
    PRINT 'Added ModifiedDate column';
END

-- Ensure IsActive column exists (for soft delete)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vendors') AND name = 'IsActive')
BEGIN
    ALTER TABLE Vendors ADD IsActive BIT DEFAULT 1;
    PRINT 'Added IsActive column';
END

PRINT 'Vendors table update complete!';
