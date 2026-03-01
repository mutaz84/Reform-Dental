-- =============================================
-- Migration: Create ClinicWorkingHours table
-- Purpose: Store clinic operating hours in relational SQL rows
-- Safe to run multiple times
-- =============================================

IF OBJECT_ID('dbo.ClinicWorkingHours', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicWorkingHours (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ClinicId INT NOT NULL,
        DayKey NVARCHAR(20) NOT NULL,
        IsOpen BIT NOT NULL CONSTRAINT DF_ClinicWorkingHours_IsOpen DEFAULT (0),
        OpenTime TIME NULL,
        CloseTime TIME NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ClinicWorkingHours_CreatedDate DEFAULT (GETUTCDATE()),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_ClinicWorkingHours_ModifiedDate DEFAULT (GETUTCDATE())
    );

    ALTER TABLE dbo.ClinicWorkingHours
        ADD CONSTRAINT FK_ClinicWorkingHours_Clinics
            FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(Id);

    ALTER TABLE dbo.ClinicWorkingHours
        ADD CONSTRAINT CK_ClinicWorkingHours_DayKey
            CHECK (LOWER(DayKey) IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'));

    ALTER TABLE dbo.ClinicWorkingHours
        ADD CONSTRAINT CK_ClinicWorkingHours_TimeRange
            CHECK (
                IsOpen = 0
                OR (OpenTime IS NOT NULL AND CloseTime IS NOT NULL AND OpenTime < CloseTime)
            );

    CREATE UNIQUE INDEX UX_ClinicWorkingHours_ClinicId_DayKey
        ON dbo.ClinicWorkingHours (ClinicId, DayKey);

    CREATE INDEX IX_ClinicWorkingHours_ClinicId
        ON dbo.ClinicWorkingHours (ClinicId);
END;

-- Backfill from Clinics.OperatingHours JSON when present and no rows exist yet.
-- Use dynamic SQL to avoid compile-time "Invalid column name 'OperatingHours'" on databases
-- where Clinics.OperatingHours does not exist.
IF COL_LENGTH('dbo.Clinics', 'OperatingHours') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM dbo.ClinicWorkingHours)
BEGIN
    DECLARE @backfillSql NVARCHAR(MAX) = N'
        IF EXISTS (SELECT 1 FROM dbo.Clinics WHERE OperatingHours IS NOT NULL)
        BEGIN
            INSERT INTO dbo.ClinicWorkingHours (ClinicId, DayKey, IsOpen, OpenTime, CloseTime)
            SELECT
                c.Id AS ClinicId,
                LOWER(j.[key]) AS DayKey,
                CASE
                    WHEN JSON_VALUE(j.[value], ''$.isOpen'') IN (''true'', ''1'') THEN 1
                    ELSE 0
                END AS IsOpen,
                CASE
                    WHEN JSON_VALUE(j.[value], ''$.isOpen'') IN (''true'', ''1'')
                        THEN TRY_CAST(JSON_VALUE(j.[value], ''$.open'') AS TIME)
                    ELSE NULL
                END AS OpenTime,
                CASE
                    WHEN JSON_VALUE(j.[value], ''$.isOpen'') IN (''true'', ''1'')
                        THEN TRY_CAST(JSON_VALUE(j.[value], ''$.close'') AS TIME)
                    ELSE NULL
                END AS CloseTime
            FROM dbo.Clinics c
            CROSS APPLY OPENJSON(c.OperatingHours) j
            WHERE c.OperatingHours IS NOT NULL
              AND LOWER(j.[key]) IN (''monday'',''tuesday'',''wednesday'',''thursday'',''friday'',''saturday'',''sunday'');
        END;
    ';

    EXEC sp_executesql @backfillSql;
END;

PRINT 'ClinicWorkingHours migration complete.';
