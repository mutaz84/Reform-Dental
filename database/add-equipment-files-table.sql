-- =============================================
-- Migration: Add EquipmentFiles table
-- Stores equipment document/file data server-side
-- so files are accessible from any device.
-- Run this in Azure Portal Query Editor
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EquipmentFiles' AND xtype='U')
BEGIN
    CREATE TABLE EquipmentFiles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DocumentId NVARCHAR(255) NOT NULL,
        EquipmentId INT NOT NULL,
        Name NVARCHAR(500) NOT NULL DEFAULT 'equipment-document',
        MimeType NVARCHAR(255),
        Data NVARCHAR(MAX) NOT NULL,
        UploadedAt DATETIME2,
        CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_EquipmentFiles_DocumentId UNIQUE (DocumentId)
    );
    PRINT 'Created EquipmentFiles table';
END
ELSE
    PRINT 'EquipmentFiles table already exists';
GO

-- Index for fast lookup by equipment
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_EquipmentFiles_EquipmentId' AND object_id = OBJECT_ID('EquipmentFiles'))
BEGIN
    CREATE INDEX IX_EquipmentFiles_EquipmentId ON EquipmentFiles (EquipmentId);
    PRINT 'Created index IX_EquipmentFiles_EquipmentId';
END
GO
