-- ============================================================
-- Reform Dental - Dashboard Test Data Cleanup
-- Target: ReformDental_BlackSky / Reform Dental SQL database
-- Removes only records created by dashboard-test-data-seed.sql.
-- ============================================================

SET NOCOUNT ON;

PRINT '=== Dashboard test data cleanup ===';

DECLARE @ClinicId INT = NULL;
DECLARE @ManagerId INT = NULL;
DECLARE @SarahId INT = NULL;
DECLARE @MariaId INT = NULL;
DECLARE @MikeId INT = NULL;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NOT NULL
    SELECT @ClinicId = Id FROM dbo.Clinics WHERE Name = N'Black Sky Dental - Downtown';

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    SELECT @ManagerId = Id FROM dbo.Users WHERE Username = N'dashboard.manager';
    SELECT @SarahId = Id FROM dbo.Users WHERE Username = N'sarah.dashboard';
    SELECT @MariaId = Id FROM dbo.Users WHERE Username = N'maria.dashboard';
    SELECT @MikeId = Id FROM dbo.Users WHERE Username = N'mike.dashboard';
END;

IF OBJECT_ID(N'dbo.Tasks', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.Tasks
    WHERE Title LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed tasks.';
END;

IF OBJECT_ID(N'dbo.ShiftBuilderRowItems', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.ShiftBuilderEmployeeRows', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NOT NULL
BEGIN
    DELETE ri
    FROM dbo.ShiftBuilderRowItems ri
    INNER JOIN dbo.ShiftBuilderEmployeeRows ser ON ser.Id = ri.EmployeeShiftId
    INNER JOIN dbo.ShiftBuilderShifts sh ON sh.Id = ser.ShiftId
    WHERE sh.Title LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed shift-builder row items.';
END;

IF OBJECT_ID(N'dbo.ShiftBuilderEmployeeRows', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NOT NULL
BEGIN
    DELETE ser
    FROM dbo.ShiftBuilderEmployeeRows ser
    INNER JOIN dbo.ShiftBuilderShifts sh ON sh.Id = ser.ShiftId
    WHERE sh.Title LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed shift-builder employee rows.';
END;

IF OBJECT_ID(N'dbo.ShiftBuilderShifts', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.ShiftBuilderShifts
    WHERE Title LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed shift-builder shifts.';
END;

IF OBJECT_ID(N'dbo.Schedules', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
BEGIN
    DELETE FROM dbo.Schedules
    WHERE ClinicId = @ClinicId
      AND Notes LIKE N'Dashboard seed:%';
    PRINT 'Deleted dashboard seed schedules.';
END;

IF OBJECT_ID(N'dbo.Requests', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.Requests
    WHERE Title LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed requests.';
END;

IF OBJECT_ID(N'dbo.Supplies', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.Supplies
    WHERE Name LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed supplies.';
END;

IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.OfficeEquipment
    WHERE Name LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed office equipment.';
END;

IF OBJECT_ID(N'dbo.Equipment', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.Equipment
    WHERE Name LIKE N'Dashboard Seed -%';
    PRINT 'Deleted dashboard seed equipment.';
END;

IF OBJECT_ID(N'dbo.Rooms', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
BEGIN
        DELETE FROM dbo.Rooms
        WHERE ClinicId = @ClinicId
            AND Name IN (N'Operatory 1', N'Operatory 2', N'Operatory 3', N'Sterilization')
            AND Description LIKE N'%seed%';
        PRINT 'Deleted dashboard seed rooms.';
END;

IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.DashboardSeedMemberships', N'U') IS NOT NULL
BEGIN
    DELETE uc
    FROM dbo.UserClinics uc
    WHERE EXISTS (
        SELECT 1
        FROM dbo.DashboardSeedMemberships dsm
        WHERE dsm.UserId = uc.UserId
          AND dsm.ClinicId = uc.ClinicId
        );
    PRINT 'Deleted dashboard seed user-clinic memberships.';
END;

IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NOT NULL AND @ClinicId IS NOT NULL
BEGIN
        DELETE FROM dbo.UserClinics
        WHERE ClinicId = @ClinicId
            AND UserId IN (@ManagerId, @SarahId, @MariaId, @MikeId);
        PRINT 'Deleted dashboard seed demo user-clinic memberships.';
END;

IF OBJECT_ID(N'dbo.DashboardSeedMemberships', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.DashboardSeedMemberships;
    PRINT 'Deleted dashboard seed membership audit table.';
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.Users
    WHERE Username IN (N'dashboard.manager', N'sarah.dashboard', N'maria.dashboard', N'mike.dashboard');
    PRINT 'Deleted dashboard seed users.';
END;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NOT NULL
   AND @ClinicId IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.UserClinics WHERE ClinicId = @ClinicId)
   AND NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE ClinicId = @ClinicId)
   AND NOT EXISTS (SELECT 1 FROM dbo.Supplies WHERE ClinicId = @ClinicId)
   AND (OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.OfficeEquipment WHERE ClinicId = @ClinicId))
   AND (OBJECT_ID(N'dbo.Equipment', N'U') IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.Equipment WHERE ClinicId = @ClinicId))
BEGIN
    DELETE FROM dbo.Clinics WHERE Id = @ClinicId AND Name = N'Black Sky Dental - Downtown';
    PRINT 'Deleted dashboard seed clinic.';
END;

PRINT 'Dashboard seed cleanup complete.';