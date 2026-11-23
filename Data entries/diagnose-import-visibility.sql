-- Diagnose why imported Services/Utilities show in the app but other imported data does not.
-- Run this in the same database where you ran generated-data-import.sql.
-- Optional: set @AppUsername to the exact username you use to log in to the app.

SET NOCOUNT ON;

DECLARE @AppUsername NVARCHAR(255) = N'';
DECLARE @ClinicName NVARCHAR(255) = N'Bright Smile Dental';

DECLARE @UserId INT = NULL;
DECLARE @ClinicId INT = NULL;

IF NULLIF(LTRIM(RTRIM(@AppUsername)), N'') IS NOT NULL
BEGIN
    SELECT TOP 1 @UserId = Id
    FROM dbo.Users
    WHERE LOWER(LTRIM(RTRIM(Username))) = LOWER(LTRIM(RTRIM(@AppUsername)))
    ORDER BY Id;
END;

SELECT TOP 1 @ClinicId = Id
FROM dbo.Clinics
WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@ClinicName)))
ORDER BY Id;

SELECT 'Input' AS Section, @AppUsername AS AppUsername, @UserId AS ResolvedUserId, @ClinicName AS ClinicName, @ClinicId AS ResolvedClinicId;

SELECT 'Users' AS Section, Id, Username, FirstName, LastName, Role, ISNULL(IsActive, 1) AS IsActive
FROM dbo.Users
ORDER BY Id;

SELECT 'Clinics' AS Section, Id, Name, ISNULL(IsActive, 1) AS IsActive
FROM dbo.Clinics
ORDER BY Id;

SELECT 'UserClinics' AS Section, uc.UserId, u.Username, uc.ClinicId, c.Name AS ClinicName
FROM dbo.UserClinics uc
LEFT JOIN dbo.Users u ON u.Id = uc.UserId
LEFT JOIN dbo.Clinics c ON c.Id = uc.ClinicId
ORDER BY uc.UserId, uc.ClinicId;

SELECT 'ColumnCheck' AS Section, 'Equipment' AS TableName, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Equipment'
UNION ALL SELECT 'ColumnCheck', 'OfficeEquipment', COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'OfficeEquipment'
UNION ALL SELECT 'ColumnCheck', 'Supplies', COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Supplies'
UNION ALL SELECT 'ColumnCheck', 'Instruments', COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Instruments'
UNION ALL SELECT 'ColumnCheck', 'Utilities', COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Utilities'
ORDER BY TableName, COLUMN_NAME;

SELECT 'RawRowsByClinic' AS Section, 'Equipment' AS TableName, e.ClinicId, c.Name AS ClinicName, COUNT(*) AS RowCount
FROM dbo.Equipment e LEFT JOIN dbo.Clinics c ON c.Id = e.ClinicId
GROUP BY e.ClinicId, c.Name
UNION ALL SELECT 'RawRowsByClinic', 'OfficeEquipment', e.ClinicId, c.Name, COUNT(*)
FROM dbo.OfficeEquipment e LEFT JOIN dbo.Clinics c ON c.Id = e.ClinicId
GROUP BY e.ClinicId, c.Name
UNION ALL SELECT 'RawRowsByClinic', 'Supplies', s.ClinicId, c.Name, COUNT(*)
FROM dbo.Supplies s LEFT JOIN dbo.Clinics c ON c.Id = s.ClinicId
GROUP BY s.ClinicId, c.Name
UNION ALL SELECT 'RawRowsByClinic', 'Instruments', i.ClinicId, c.Name, COUNT(*)
FROM dbo.Instruments i LEFT JOIN dbo.Clinics c ON c.Id = i.ClinicId
GROUP BY i.ClinicId, c.Name
UNION ALL SELECT 'RawRowsByClinic', 'Utilities', u.ClinicId, c.Name, COUNT(*)
FROM dbo.Utilities u LEFT JOIN dbo.Clinics c ON c.Id = u.ClinicId
GROUP BY u.ClinicId, c.Name
ORDER BY TableName, ClinicId;

SELECT 'ImportedClinicRows' AS Section, 'Equipment' AS TableName, COUNT(*) AS RowCount
FROM dbo.Equipment WHERE ClinicId = @ClinicId
UNION ALL SELECT 'ImportedClinicRows', 'OfficeEquipment', COUNT(*) FROM dbo.OfficeEquipment WHERE ClinicId = @ClinicId
UNION ALL SELECT 'ImportedClinicRows', 'Supplies', COUNT(*) FROM dbo.Supplies WHERE ClinicId = @ClinicId
UNION ALL SELECT 'ImportedClinicRows', 'Instruments', COUNT(*) FROM dbo.Instruments WHERE ClinicId = @ClinicId
UNION ALL SELECT 'ImportedClinicRows', 'Utilities', COUNT(*) FROM dbo.Utilities WHERE ClinicId = @ClinicId;

SELECT 'SupplyTypesAtImportedClinic' AS Section, ISNULL(SupplyType, N'<NULL>') AS SupplyType, COUNT(*) AS RowCount
FROM dbo.Supplies
WHERE ClinicId = @ClinicId
GROUP BY ISNULL(SupplyType, N'<NULL>')
ORDER BY SupplyType;

IF @UserId IS NOT NULL
BEGIN
    SELECT 'ApiVisibleAsUser' AS Section, 'Equipment' AS TableName, COUNT(*) AS VisibleRows
    FROM dbo.Equipment
    WHERE EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId AND LOWER(Username) = 'admin')
       OR ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
    UNION ALL SELECT 'ApiVisibleAsUser', 'OfficeEquipment', COUNT(*)
    FROM dbo.OfficeEquipment
    WHERE EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId AND LOWER(Username) = 'admin')
       OR ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
    UNION ALL SELECT 'ApiVisibleAsUser', 'Dental Supplies', COUNT(*)
    FROM dbo.Supplies
    WHERE (ISNULL(SupplyType, N'Dental') = N'Dental')
      AND (
          EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId AND LOWER(Username) = 'admin')
          OR ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
      )
    UNION ALL SELECT 'ApiVisibleAsUser', 'Office Supplies', COUNT(*)
    FROM dbo.Supplies
    WHERE SupplyType = N'Office'
      AND (
          EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId AND LOWER(Username) = 'admin')
          OR ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
      )
    UNION ALL SELECT 'ApiVisibleAsUser', 'Instruments', COUNT(*)
    FROM dbo.Instruments
    WHERE EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId AND LOWER(Username) = 'admin')
       OR ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
    UNION ALL SELECT 'ApiVisibleAsUser', 'Utilities', COUNT(*)
    FROM dbo.Utilities
    WHERE EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId AND LOWER(Username) = 'admin')
       OR ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId);
END
ELSE
BEGIN
    SELECT 'ActionNeeded' AS Section, 'Set @AppUsername at the top of this script to your exact app login username, then rerun it.' AS Message;
END;