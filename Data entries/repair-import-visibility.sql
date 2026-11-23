-- Run this after generated-data-import.sql if imported rows exist in the database
-- but the app pages still show empty lists.
-- Set @AppUsername to the username you use to log in to the app.

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @AppUsername NVARCHAR(255) = N'';
DECLARE @ClinicName NVARCHAR(255) = N'Bright Smile Dental';

IF NULLIF(LTRIM(RTRIM(@AppUsername)), N'') IS NULL
BEGIN
    SELECT 'Set @AppUsername to your app login username, then run this script again.' AS ActionNeeded;
    SELECT TOP 50 Id, Username FROM dbo.Users ORDER BY Id;
    RETURN;
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL THROW 52000, 'Missing dbo.Users table.', 1;
IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NULL THROW 52001, 'Missing dbo.UserClinics table.', 1;
IF OBJECT_ID(N'dbo.Clinics', N'U') IS NULL THROW 52002, 'Missing dbo.Clinics table.', 1;

DECLARE @UserId INT;
DECLARE @ClinicId INT;

SELECT TOP 1 @UserId = Id
FROM dbo.Users
WHERE LOWER(LTRIM(RTRIM(Username))) = LOWER(LTRIM(RTRIM(@AppUsername)))
ORDER BY Id;

SELECT TOP 1 @ClinicId = Id
FROM dbo.Clinics
WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@ClinicName)))
ORDER BY Id;

IF @UserId IS NULL THROW 52003, 'The @AppUsername value was not found in dbo.Users.Username.', 1;
IF @ClinicId IS NULL THROW 52004, 'The @ClinicName value was not found in dbo.Clinics.Name.', 1;

INSERT INTO dbo.UserClinics (UserId, ClinicId)
SELECT @UserId, @ClinicId
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.UserClinics
    WHERE UserId = @UserId
      AND ClinicId = @ClinicId
);

SELECT 'User clinic access repaired' AS Result, @AppUsername AS Username, @UserId AS UserId, @ClinicName AS ClinicName, @ClinicId AS ClinicId, @@ROWCOUNT AS NewLinksAdded;

SELECT 'Equipment visible to this user' AS Item, COUNT(*) AS Count
FROM dbo.Equipment
WHERE ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
UNION ALL SELECT 'Office equipment visible to this user', COUNT(*)
FROM dbo.OfficeEquipment
WHERE ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
UNION ALL SELECT 'Dental supplies visible to this user', COUNT(*)
FROM dbo.Supplies
WHERE ISNULL(SupplyType, N'Dental') = N'Dental'
  AND ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
UNION ALL SELECT 'Office supplies visible to this user', COUNT(*)
FROM dbo.Supplies
WHERE SupplyType = N'Office'
  AND ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
UNION ALL SELECT 'Instruments visible to this user', COUNT(*)
FROM dbo.Instruments
WHERE ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId)
UNION ALL SELECT 'Utilities visible to this user', COUNT(*)
FROM dbo.Utilities
WHERE ClinicId IN (SELECT ClinicId FROM dbo.UserClinics WHERE UserId = @UserId);