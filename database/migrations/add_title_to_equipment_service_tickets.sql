-- Migration: Add Title column to EquipmentServiceTickets
-- Run this once in Azure SQL (Portal Query Editor or SSMS)

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.EquipmentServiceTickets')
      AND name = N'Title'
)
BEGIN
    ALTER TABLE dbo.EquipmentServiceTickets
        ADD Title NVARCHAR(200) NULL;
    PRINT 'Added Title column to EquipmentServiceTickets';
END
ELSE
    PRINT 'Title column already exists on EquipmentServiceTickets';
GO
