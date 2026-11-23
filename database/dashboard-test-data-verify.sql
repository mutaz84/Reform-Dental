-- ============================================================
-- Reform Dental - Dashboard Test Data Verification
-- Run after dashboard-test-data-seed.sql.
-- ============================================================

SET NOCOUNT ON;

DECLARE @ClinicId INT = NULL;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NOT NULL
    SELECT @ClinicId = Id FROM dbo.Clinics WHERE Name = N'Black Sky Dental - Downtown';

SELECT
    @ClinicId AS DashboardSeedClinicId,
    CASE WHEN @ClinicId IS NULL THEN 'Missing seed clinic' ELSE 'Seed clinic found' END AS ClinicStatus;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
BEGIN
    SELECT
        Id,
        Name,
        Phone,
        MainPhone,
        AfterHoursPhone,
        Fax,
        Email,
        Website,
        DefaultDentist,
        TaxonomyNumber,
        ClinicNPI,
        ClinicTIN,
        LegalName,
        LegalAddress,
        Status
    FROM dbo.Clinics
    WHERE Id = @ClinicId;
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    SELECT Id, Username, FirstName, LastName, Role, IsActive
    FROM dbo.Users
    WHERE Username IN (N'dashboard.manager', N'sarah.dashboard', N'maria.dashboard', N'mike.dashboard')
    ORDER BY Username;
END;

IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
BEGIN
    SELECT u.Id, u.Username, uc.ClinicId
    FROM dbo.UserClinics uc
    INNER JOIN dbo.Users u ON u.Id = uc.UserId
    WHERE uc.ClinicId = @ClinicId
    ORDER BY u.Username;
END;

DECLARE @Counts TABLE (Area NVARCHAR(50) NOT NULL, SeedRows INT NOT NULL);

IF OBJECT_ID(N'dbo.Tasks', N'U') IS NOT NULL
    INSERT INTO @Counts SELECT N'Tasks', COUNT(*) FROM dbo.Tasks WHERE Title LIKE N'Dashboard Seed -%';

IF OBJECT_ID(N'dbo.Rooms', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
    INSERT INTO @Counts SELECT N'Rooms', COUNT(*) FROM dbo.Rooms WHERE ClinicId = @ClinicId AND Name IN (N'Operatory 1', N'Operatory 2', N'Operatory 3', N'Sterilization');

IF OBJECT_ID(N'dbo.Schedules', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
    INSERT INTO @Counts SELECT N'Schedules', COUNT(*) FROM dbo.Schedules WHERE ClinicId = @ClinicId AND Notes LIKE N'Dashboard seed:%';

IF OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NOT NULL
    INSERT INTO @Counts SELECT N'ShiftBuilderShifts', COUNT(*) FROM dbo.ShiftBuilderShifts WHERE Title LIKE N'Dashboard Seed -%';

IF OBJECT_ID(N'dbo.ShiftBuilderEmployeeRows', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NOT NULL
    INSERT INTO @Counts
    SELECT N'ShiftBuilderEmployeeRows', COUNT(*)
    FROM dbo.ShiftBuilderEmployeeRows ser
    INNER JOIN dbo.ShiftBuilderShifts sh ON sh.Id = ser.ShiftId
    WHERE sh.Title LIKE N'Dashboard Seed -%';

IF OBJECT_ID(N'dbo.Requests', N'U') IS NOT NULL
    INSERT INTO @Counts SELECT N'Requests', COUNT(*) FROM dbo.Requests WHERE Title LIKE N'Dashboard Seed -%';

IF OBJECT_ID(N'dbo.Supplies', N'U') IS NOT NULL
    INSERT INTO @Counts SELECT N'Supplies', COUNT(*) FROM dbo.Supplies WHERE Name LIKE N'Dashboard Seed -%';

IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NOT NULL
    INSERT INTO @Counts SELECT N'OfficeEquipment', COUNT(*) FROM dbo.OfficeEquipment WHERE Name LIKE N'Dashboard Seed -%';

IF OBJECT_ID(N'dbo.Equipment', N'U') IS NOT NULL
    INSERT INTO @Counts SELECT N'Equipment', COUNT(*) FROM dbo.Equipment WHERE Name LIKE N'Dashboard Seed -%';

SELECT Area, SeedRows FROM @Counts ORDER BY Area;

PRINT 'Dashboard seed verification complete.';