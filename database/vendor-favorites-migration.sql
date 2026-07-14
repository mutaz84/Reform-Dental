-- Adds persistent favorite-vendor support for the Vendors API.
IF COL_LENGTH('dbo.Vendors', 'IsFavorite') IS NULL
BEGIN
    ALTER TABLE dbo.Vendors
        ADD IsFavorite BIT NOT NULL CONSTRAINT DF_Vendors_IsFavorite DEFAULT (0);
END
GO