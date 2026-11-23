-- 2026-11-23: columns needed by the QA data fixes (branch fix/qa-data).
-- Safe to run more than once. Additive only: no existing data is changed.
-- The API checks for each column before using it, so the app keeps working
-- before this runs; the matching values just aren't saved until it does.

-- 1) Supplies: persist the "Low inventory" and "Out of stock" toggles.
--    The UI sent { lowStock, outOfStock } but the table had no columns for them,
--    so the flags only lived in the browser's local storage.
IF COL_LENGTH('dbo.Supplies', 'LowStock') IS NULL
    ALTER TABLE dbo.Supplies ADD LowStock BIT NOT NULL CONSTRAINT DF_Supplies_LowStock DEFAULT 0;
GO
IF COL_LENGTH('dbo.Supplies', 'OutOfStock') IS NULL
    ALTER TABLE dbo.Supplies ADD OutOfStock BIT NOT NULL CONSTRAINT DF_Supplies_OutOfStock DEFAULT 0;
GO

-- 2) Services (Utilities): save Contract End Date (QA bug #14).
IF COL_LENGTH('dbo.Utilities', 'ContractEndDate') IS NULL
    ALTER TABLE dbo.Utilities ADD ContractEndDate DATE NULL;
GO

-- 3) Rooms: save Dimensions (QA bug #16).
IF COL_LENGTH('dbo.Rooms', 'Dimensions') IS NULL
    ALTER TABLE dbo.Rooms ADD Dimensions NVARCHAR(100) NULL;
GO
