-- =============================================
-- Attendance + PTO FULL TABLE REBUILD
-- WARNING: This resets data in attendance/PTO tables.
-- =============================================

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    -- -----------------------------
    -- Optional snapshots (replace existing)
    -- -----------------------------
    IF OBJECT_ID('dbo.AttendanceRecords', 'U') IS NOT NULL
    BEGIN
        IF OBJECT_ID('dbo.AttendanceRecords_Backup', 'U') IS NOT NULL DROP TABLE dbo.AttendanceRecords_Backup;
        SELECT * INTO dbo.AttendanceRecords_Backup FROM dbo.AttendanceRecords;
    END

    IF OBJECT_ID('dbo.AttendancePolicies', 'U') IS NOT NULL
    BEGIN
        IF OBJECT_ID('dbo.AttendancePolicies_Backup', 'U') IS NOT NULL DROP TABLE dbo.AttendancePolicies_Backup;
        SELECT * INTO dbo.AttendancePolicies_Backup FROM dbo.AttendancePolicies;
    END

    IF OBJECT_ID('dbo.PtoCredits', 'U') IS NOT NULL
    BEGIN
        IF OBJECT_ID('dbo.PtoCredits_Backup', 'U') IS NOT NULL DROP TABLE dbo.PtoCredits_Backup;
        SELECT * INTO dbo.PtoCredits_Backup FROM dbo.PtoCredits;
    END

    IF OBJECT_ID('dbo.PtoRequests', 'U') IS NOT NULL
    BEGIN
        IF OBJECT_ID('dbo.PtoRequests_Backup', 'U') IS NOT NULL DROP TABLE dbo.PtoRequests_Backup;
        SELECT * INTO dbo.PtoRequests_Backup FROM dbo.PtoRequests;
    END

    IF OBJECT_ID('dbo.AttendanceNotifications', 'U') IS NOT NULL
    BEGIN
        IF OBJECT_ID('dbo.AttendanceNotifications_Backup', 'U') IS NOT NULL DROP TABLE dbo.AttendanceNotifications_Backup;
        SELECT * INTO dbo.AttendanceNotifications_Backup FROM dbo.AttendanceNotifications;
    END

    IF OBJECT_ID('dbo.AttendanceAbsences', 'U') IS NOT NULL
    BEGIN
        IF OBJECT_ID('dbo.AttendanceAbsences_Backup', 'U') IS NOT NULL DROP TABLE dbo.AttendanceAbsences_Backup;
        SELECT * INTO dbo.AttendanceAbsences_Backup FROM dbo.AttendanceAbsences;
    END

    -- -----------------------------
    -- Drop in dependency-safe order
    -- -----------------------------
    IF OBJECT_ID('dbo.AttendanceAbsences', 'U') IS NOT NULL DROP TABLE dbo.AttendanceAbsences;
    IF OBJECT_ID('dbo.AttendanceNotifications', 'U') IS NOT NULL DROP TABLE dbo.AttendanceNotifications;
    IF OBJECT_ID('dbo.PtoRequests', 'U') IS NOT NULL DROP TABLE dbo.PtoRequests;
    IF OBJECT_ID('dbo.PtoCredits', 'U') IS NOT NULL DROP TABLE dbo.PtoCredits;
    IF OBJECT_ID('dbo.AttendancePolicies', 'U') IS NOT NULL DROP TABLE dbo.AttendancePolicies;
    IF OBJECT_ID('dbo.AttendanceRecords', 'U') IS NOT NULL DROP TABLE dbo.AttendanceRecords;

    -- -----------------------------
    -- Recreate AttendanceRecords
    -- -----------------------------
    CREATE TABLE dbo.AttendanceRecords (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        LocalRecordId NVARCHAR(120) NULL,
        UserId INT NULL,
        Username NVARCHAR(150) NOT NULL,
        DisplayName NVARCHAR(255) NULL,
        WorkDate DATE NOT NULL,
        ScheduledStart TIME NULL,
        ScheduledEnd TIME NULL,
        ClockIn DATETIME2 NULL,
        ClockOut DATETIME2 NULL,
        MinutesWorked INT NOT NULL CONSTRAINT DF_AttendanceRecords_MinutesWorked DEFAULT (0),
        FlagsJson NVARCHAR(MAX) NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_AttendanceRecords_CreatedDate DEFAULT (SYSDATETIME()),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_AttendanceRecords_ModifiedDate DEFAULT (SYSDATETIME())
    );

    IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.AttendanceRecords
        ADD CONSTRAINT FK_AttendanceRecords_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
    END

    CREATE UNIQUE INDEX UX_AttendanceRecords_Username_WorkDate
        ON dbo.AttendanceRecords (Username, WorkDate);

    CREATE UNIQUE INDEX UX_AttendanceRecords_LocalRecordId
        ON dbo.AttendanceRecords (LocalRecordId)
        WHERE LocalRecordId IS NOT NULL;

    CREATE INDEX IX_AttendanceRecords_WorkDate
        ON dbo.AttendanceRecords (WorkDate DESC, Id DESC);

    -- -----------------------------
    -- Recreate AttendancePolicies
    -- -----------------------------
    CREATE TABLE dbo.AttendancePolicies (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        AllowFlex BIT NOT NULL CONSTRAINT DF_AttendancePolicies_AllowFlex DEFAULT (0),
        BeforeMins INT NOT NULL CONSTRAINT DF_AttendancePolicies_BeforeMins DEFAULT (0),
        AfterMins INT NOT NULL CONSTRAINT DF_AttendancePolicies_AfterMins DEFAULT (0),
        ModifiedBy NVARCHAR(255) NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_AttendancePolicies_CreatedDate DEFAULT (SYSDATETIME()),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_AttendancePolicies_ModifiedDate DEFAULT (SYSDATETIME())
    );

    CREATE UNIQUE INDEX UX_AttendancePolicies_Username
        ON dbo.AttendancePolicies (Username);

    -- -----------------------------
    -- Recreate PtoCredits
    -- -----------------------------
    CREATE TABLE dbo.PtoCredits (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        CreditHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PtoCredits_CreditHours DEFAULT (80),
        ModifiedBy NVARCHAR(255) NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_PtoCredits_CreatedDate DEFAULT (SYSDATETIME()),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_PtoCredits_ModifiedDate DEFAULT (SYSDATETIME())
    );

    CREATE UNIQUE INDEX UX_PtoCredits_Username
        ON dbo.PtoCredits (Username);

    -- -----------------------------
    -- Recreate PtoRequests
    -- -----------------------------
    CREATE TABLE dbo.PtoRequests (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        EmployeeName NVARCHAR(255) NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        Hours DECIMAL(10,2) NOT NULL,
        Reason NVARCHAR(MAX) NULL,
        Status NVARCHAR(30) NOT NULL CONSTRAINT DF_PtoRequests_Status DEFAULT ('pending'),
        ReviewedBy NVARCHAR(255) NULL,
        ReviewedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PtoRequests_CreatedAt DEFAULT (SYSDATETIME()),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_PtoRequests_ModifiedDate DEFAULT (SYSDATETIME())
    );

    CREATE INDEX IX_PtoRequests_Username_Status
        ON dbo.PtoRequests (Username, Status);

    CREATE INDEX IX_PtoRequests_Status_CreatedAt
        ON dbo.PtoRequests (Status, CreatedAt DESC, Id DESC);

    -- -----------------------------
    -- Recreate AttendanceNotifications
    -- -----------------------------
    CREATE TABLE dbo.AttendanceNotifications (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        NotificationType NVARCHAR(50) NOT NULL CONSTRAINT DF_AttendanceNotifications_Type DEFAULT ('info'),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceNotifications_CreatedAt DEFAULT (SYSDATETIME())
    );

    CREATE INDEX IX_AttendanceNotifications_Username_CreatedAt
        ON dbo.AttendanceNotifications (Username, CreatedAt DESC, Id DESC);

    -- -----------------------------
    -- Recreate AttendanceAbsences
    -- -----------------------------
    CREATE TABLE dbo.AttendanceAbsences (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        DisplayName NVARCHAR(255) NULL,
        WorkDate DATE NOT NULL,
        Reason NVARCHAR(500) NULL,
        RecordedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceAbsences_RecordedAt DEFAULT (SYSDATETIME())
    );

    CREATE UNIQUE INDEX UX_AttendanceAbsences_Username_WorkDate
        ON dbo.AttendanceAbsences (Username, WorkDate);

    CREATE INDEX IX_AttendanceAbsences_WorkDate
        ON dbo.AttendanceAbsences (WorkDate DESC, Id DESC);

    COMMIT TRAN;

    PRINT 'Attendance + PTO tables rebuilt successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();

    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
