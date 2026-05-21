-- =============================================================================
-- Migration: Add IsActive to Equipment and Status to Utilities
-- =============================================================================
-- Purpose: The retirement / out-of-service log feature flips an item's status
--          to "Retired" / "Out of Service" and its operational flag to inactive.
--          Without these columns, the API silently drops the values on PUT and
--          returns nothing on GET, so the next API sync overwrites the local
--          state and the status "bounces back" to Operational on the UI.
--
-- Safe to run multiple times: each block is guarded by IF NOT EXISTS / IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Equipment.IsActive  (BIT, NOT NULL, default 1)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'IsActive'
)
BEGIN
    ALTER TABLE dbo.Equipment
        ADD IsActive BIT NOT NULL CONSTRAINT DF_Equipment_IsActive DEFAULT (1);
    PRINT 'Added Equipment.IsActive (BIT NOT NULL DEFAULT 1).';
END
ELSE
    PRINT 'Equipment.IsActive already exists. Skipped.';
GO

-- Backfill any existing rows whose Status indicates they are not operational
-- so the operational toggle is correct on the next sync.
UPDATE dbo.Equipment
SET    IsActive = 0
WHERE  IsActive = 1
  AND  Status IN ('Retired', 'Out of Service', 'Inactive');
GO

-- -----------------------------------------------------------------------------
-- 2. Equipment.Condition  (NVARCHAR(50), nullable)  -- referenced by API payload
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'Condition'
)
BEGIN
    ALTER TABLE dbo.Equipment
        ADD [Condition] NVARCHAR(50) NULL;
    PRINT 'Added Equipment.Condition (NVARCHAR(50) NULL).';
END
ELSE
    PRINT 'Equipment.Condition already exists. Skipped.';
GO

-- -----------------------------------------------------------------------------
-- 3. Utilities.Status  (NVARCHAR(50), nullable)
-- -----------------------------------------------------------------------------
-- Lets us distinguish "Retired" vs "Out of Service" for utilities (Office
-- Equipment page), instead of only the binary IsActive flag.
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Utilities' AND COLUMN_NAME = 'Status'
)
BEGIN
    ALTER TABLE dbo.Utilities
        ADD [Status] NVARCHAR(50) NULL;
    PRINT 'Added Utilities.Status (NVARCHAR(50) NULL).';
END
ELSE
    PRINT 'Utilities.Status already exists. Skipped.';
GO

-- Seed Status for existing utility rows.
UPDATE dbo.Utilities
SET    [Status] = CASE WHEN IsActive = 1 THEN 'Operational' ELSE 'Out of Service' END
WHERE  [Status] IS NULL;
GO

PRINT 'Migration complete.';
GO
