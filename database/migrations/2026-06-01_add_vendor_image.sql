-- =============================================================
-- Add ImageUrl column to Vendors so vendor profile photos
-- (data URLs uploaded from the Vendor Preview modal) can be
-- persisted server-side and rendered cross-device.
--
-- Apply once. Idempotent: only adds the column if missing.
-- =============================================================

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Vendors]')
      AND name = N'ImageUrl'
)
BEGIN
    ALTER TABLE [dbo].[Vendors]
        ADD [ImageUrl] NVARCHAR(MAX) NULL;
    PRINT 'Added Vendors.ImageUrl';
END
ELSE
BEGIN
    PRINT 'Vendors.ImageUrl already exists - skipped';
END
GO
