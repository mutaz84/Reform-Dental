/* ============================================================================
   ReformDental — Demo calendar data for testing entity-linked columns
   ----------------------------------------------------------------------------
   Creates one of each calendar item type, all scheduled TODAY:
     08:30  Team assignment   (Demo Morning Huddle)
     09:30  Equipment slot    (Demo X-Ray Unit scheduled maintenance window)
     10:00  Office event      (Demo Staff Meeting)
     11:30  Service ticket    (maintenance on Demo X-Ray Unit)
     13:00  Office event      (Demo Hygiene Appointment, in Demo Surgery Room)
     14:00  Task              (assigned to your first user -> staff column)
     15:00  Task              (unassigned -> stays in Unassigned column)
   Plus: a Demo Surgery Room and Demo X-Ray Unit so you can link columns to them.

   Safe to run multiple times (skips rows it already created).
   A cleanup block is at the bottom (commented out).
   ============================================================================ */

/* ---- 1. Make sure runtime columns exist (same guards the API uses) -------- */
IF COL_LENGTH('dbo.Events', 'DashboardScope') IS NULL ALTER TABLE dbo.Events ADD DashboardScope NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Events', 'CalendarLayoutId') IS NULL ALTER TABLE dbo.Events ADD CalendarLayoutId NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.Events', 'CalendarColumnId') IS NULL ALTER TABLE dbo.Events ADD CalendarColumnId NVARCHAR(80) NULL;

IF COL_LENGTH('dbo.Equipment', 'ScheduledDate') IS NULL ALTER TABLE dbo.Equipment ADD ScheduledDate DATE NULL;
IF COL_LENGTH('dbo.Equipment', 'ScheduledTime') IS NULL ALTER TABLE dbo.Equipment ADD ScheduledTime NVARCHAR(20) NULL;

IF COL_LENGTH('dbo.EquipmentServiceTickets', 'ScheduledTime') IS NULL ALTER TABLE dbo.EquipmentServiceTickets ADD ScheduledTime NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.EquipmentServiceTickets', 'DashboardScope') IS NULL ALTER TABLE dbo.EquipmentServiceTickets ADD DashboardScope NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.EquipmentServiceTickets', 'DashboardScheduledBy') IS NULL ALTER TABLE dbo.EquipmentServiceTickets ADD DashboardScheduledBy NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.EquipmentServiceTickets', 'DashboardScheduledByName') IS NULL ALTER TABLE dbo.EquipmentServiceTickets ADD DashboardScheduledByName NVARCHAR(200) NULL;

IF OBJECT_ID('dbo.Teams', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Teams (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        TeamName      NVARCHAR(200) NOT NULL,
        Category      NVARCHAR(100),
        Description   NVARCHAR(1000),
        TeamLeadId    NVARCHAR(100),
        TeamLeadName  NVARCHAR(200),
        Members       NVARCHAR(MAX),
        OfficeId      NVARCHAR(50),
        Schedule      NVARCHAR(200),
        ScheduleDate  DATE,
        ScheduleTime  NVARCHAR(20),
        ScheduleNoDateTime BIT DEFAULT 0,
        DashboardScope NVARCHAR(20),
        DashboardScheduledBy NVARCHAR(100),
        DashboardScheduledByName NVARCHAR(200),
        ImageData     NVARCHAR(MAX),
        DocumentData  NVARCHAR(MAX),
        DocumentName  NVARCHAR(500),
        Notes         NVARCHAR(MAX),
        Warnings      NVARCHAR(MAX),
        OperationsLog NVARCHAR(MAX),
        IsActive      BIT DEFAULT 1,
        CreatedDate   DATETIME2 DEFAULT GETUTCDATE(),
        ModifiedDate  DATETIME2
    );
END
GO

/* ---- 2. Demo data --------------------------------------------------------- */
DECLARE @Today DATE = CAST(GETDATE() AS DATE);
DECLARE @Now DATETIME2 = SYSUTCDATETIME();

DECLARE @ClinicId INT = (SELECT TOP 1 Id FROM dbo.Clinics ORDER BY Id);
IF @ClinicId IS NULL BEGIN RAISERROR('No clinic found - create a clinic first.', 16, 1); RETURN; END

DECLARE @UserId INT, @UserName NVARCHAR(200);
SELECT TOP 1 @UserId = Id,
             @UserName = LTRIM(RTRIM(FirstName + ' ' + ISNULL(LastName, '')))
FROM dbo.Users ORDER BY Id;
IF @UserId IS NULL BEGIN RAISERROR('No user found - create a user first.', 16, 1); RETURN; END

/* Room to link a "Room" column to */
IF NOT EXISTS (SELECT 1 FROM dbo.Rooms WHERE Name = 'Demo Surgery Room' AND ClinicId = @ClinicId)
    INSERT INTO dbo.Rooms (ClinicId, Name, RoomType, Description, Color, IsActive, CreatedDate)
    VALUES (@ClinicId, 'Demo Surgery Room', 'Operatory', 'Seed row for calendar column testing', '#16A34A', 1, @Now);
DECLARE @RoomId INT = (SELECT TOP 1 Id FROM dbo.Rooms WHERE Name = 'Demo Surgery Room' AND ClinicId = @ClinicId);

/* Equipment to link an "Equipment" column to (has a maintenance slot today 09:30) */
IF NOT EXISTS (SELECT 1 FROM dbo.Equipment WHERE Name = 'Demo X-Ray Unit')
    INSERT INTO dbo.Equipment (Name, Category, Brand, Model, ClinicId, RoomId, Status, Notes, CreatedDate, ModifiedDate)
    VALUES ('Demo X-Ray Unit', 'Imaging', 'DemoBrand', 'DX-100', @ClinicId, @RoomId, 'Active', 'Seed row for calendar column testing', @Now, @Now);
DECLARE @EquipmentId INT = (SELECT TOP 1 Id FROM dbo.Equipment WHERE Name = 'Demo X-Ray Unit');
UPDATE dbo.Equipment SET ScheduledDate = @Today, ScheduledTime = '09:30', ModifiedDate = @Now WHERE Id = @EquipmentId;

/* Service ticket for that equipment today 11:30 */
IF NOT EXISTS (SELECT 1 FROM dbo.EquipmentServiceTickets WHERE Description = 'Demo seed - filter replacement' AND EquipmentId = @EquipmentId)
    INSERT INTO dbo.EquipmentServiceTickets
        (Id, EquipmentId, ServiceType, Priority, Status, ScheduledDate, ScheduledTime, Vendor, Description, IsAutoGenerated, CreatedAt, UpdatedAt, DashboardScope)
    VALUES
        (NEWID(), @EquipmentId, 'Maintenance', 'High', 'Scheduled', @Today, '11:30', 'Demo Dental Services', 'Demo seed - filter replacement', 0, @Now, @Now, 'office');

/* Task assigned to your first user today 14:00 -> shows in that person's staff column */
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = 'Demo: Sterilize instrument trays')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, AssignedToId, ClinicId, Assignee, CreatedDate, ModifiedDate)
    VALUES ('Demo: Sterilize instrument trays', 'Seed row for calendar column testing', 'Clinical', 'High', 'Pending', @Today, '14:00', @UserId, @ClinicId, @UserName, @Now, @Now);

/* Unassigned task today 15:00 -> should stay in the Unassigned column */
IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE Title = 'Demo: Restock gloves in operatories')
    INSERT INTO dbo.Tasks (Title, Description, Category, Priority, Status, DueDate, DueTime, ClinicId, CreatedDate, ModifiedDate)
    VALUES ('Demo: Restock gloves in operatories', 'Seed row for calendar column testing', 'Inventory', 'Medium', 'Pending', @Today, '15:00', @ClinicId, @Now, @Now);

/* Request assigned to your first user, needed today */
IF NOT EXISTS (SELECT 1 FROM dbo.Requests WHERE Title = 'Demo: Order composite refills')
    INSERT INTO dbo.Requests (Title, Type, Priority, Status, RequestedBy, AssignedTo, NeededBy, Location, Description, RequestedAt, UpdatedAt)
    VALUES ('Demo: Order composite refills', 'Supply', 'Medium', 'Pending', @UserName, @UserName, @Today, 'Demo Surgery Room', 'Seed row for calendar column testing', @Now, @Now);

/* Team assignment today 08:30 */
IF NOT EXISTS (SELECT 1 FROM dbo.Teams WHERE TeamName = 'Demo Morning Huddle')
    INSERT INTO dbo.Teams (TeamName, Category, Description, TeamLeadName, OfficeId, ScheduleDate, ScheduleTime, ScheduleNoDateTime, DashboardScope, IsActive, CreatedDate)
    VALUES ('Demo Morning Huddle', 'Operations', 'Seed row for calendar column testing', @UserName, CAST(@ClinicId AS NVARCHAR(50)), @Today, '08:30', 0, 'office', 1, @Now);

/* Office calendar event today 10:00-11:00 */
IF NOT EXISTS (SELECT 1 FROM dbo.Events WHERE Title = 'Demo: Staff Meeting' AND CAST(StartDateTime AS DATE) = @Today)
    INSERT INTO dbo.Events (Title, Description, EventType, StartDateTime, EndDateTime, AllDay, UserId, ClinicId, Color, Priority, Status, CreatedBy, CreatedDate, ModifiedDate, DashboardScope)
    VALUES ('Demo: Staff Meeting', 'Seed row for calendar column testing', 'meeting',
            CAST(CONCAT(CONVERT(CHAR(10), @Today, 23), ' 10:00') AS DATETIME2),
            CAST(CONCAT(CONVERT(CHAR(10), @Today, 23), ' 11:00') AS DATETIME2),
            0, @UserId, @ClinicId, '#0e9384', 'medium', 'scheduled', @UserId, @Now, @Now, 'office');

/* Office calendar event today 13:00-13:45 located in the demo room */
IF NOT EXISTS (SELECT 1 FROM dbo.Events WHERE Title = 'Demo: Hygiene Appointment' AND CAST(StartDateTime AS DATE) = @Today)
    INSERT INTO dbo.Events (Title, Description, EventType, StartDateTime, EndDateTime, AllDay, UserId, ClinicId, RoomId, Color, Priority, Status, CreatedBy, CreatedDate, ModifiedDate, DashboardScope)
    VALUES ('Demo: Hygiene Appointment', 'Seed row for calendar column testing', 'appointment',
            CAST(CONCAT(CONVERT(CHAR(10), @Today, 23), ' 13:00') AS DATETIME2),
            CAST(CONCAT(CONVERT(CHAR(10), @Today, 23), ' 13:45') AS DATETIME2),
            0, @UserId, @ClinicId, @RoomId, '#7c3aed', 'medium', 'scheduled', @UserId, @Now, @Now, 'office');

/* ---- 3. What to link your columns to ------------------------------------- */
SELECT 'Link a STAFF column to this person'  AS Hint, @UserName AS Value
UNION ALL SELECT 'Link an EQUIPMENT column to', 'Demo X-Ray Unit'
UNION ALL SELECT 'Link a ROOM column to', 'Demo Surgery Room'
UNION ALL SELECT 'Clinic used', CAST(@ClinicId AS NVARCHAR(50));
GO

/* ---- 4. CLEANUP (uncomment and run to remove all demo rows) ---------------
DELETE FROM dbo.EquipmentServiceTickets WHERE Description = 'Demo seed - filter replacement';
DELETE FROM dbo.Tasks    WHERE Title IN ('Demo: Sterilize instrument trays', 'Demo: Restock gloves in operatories');
DELETE FROM dbo.Requests WHERE Title = 'Demo: Order composite refills';
DELETE FROM dbo.Teams    WHERE TeamName = 'Demo Morning Huddle';
DELETE FROM dbo.Events   WHERE Title IN ('Demo: Staff Meeting', 'Demo: Hygiene Appointment');
DELETE FROM dbo.Equipment WHERE Name = 'Demo X-Ray Unit';
DELETE FROM dbo.Rooms    WHERE Name = 'Demo Surgery Room';
---------------------------------------------------------------------------- */
