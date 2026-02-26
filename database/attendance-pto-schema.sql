-- Attendance + PTO schema migration
-- Safe to run multiple times

IF OBJECT_ID('dbo.AttendanceRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceRecords (
        Id INT IDENTITY(1,1) PRIMARY KEY,
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
        ADD CONSTRAINT FK_AttendanceRecords_Users
            FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
    END

    CREATE UNIQUE INDEX UX_AttendanceRecords_Username_WorkDate
        ON dbo.AttendanceRecords (Username, WorkDate);

    CREATE INDEX IX_AttendanceRecords_WorkDate
        ON dbo.AttendanceRecords (WorkDate DESC);
END;

IF OBJECT_ID('dbo.AttendancePolicies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendancePolicies (
        Id INT IDENTITY(1,1) PRIMARY KEY,
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
END;

IF OBJECT_ID('dbo.PtoCredits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PtoCredits (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        CreditHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PtoCredits_CreditHours DEFAULT (80),
        ModifiedBy NVARCHAR(255) NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_PtoCredits_CreatedDate DEFAULT (SYSDATETIME()),
        ModifiedDate DATETIME2 NOT NULL CONSTRAINT DF_PtoCredits_ModifiedDate DEFAULT (SYSDATETIME())
    );

    CREATE UNIQUE INDEX UX_PtoCredits_Username
        ON dbo.PtoCredits (Username);
END;

IF OBJECT_ID('dbo.PtoRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PtoRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
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
        ON dbo.PtoRequests (Status, CreatedAt DESC);
END;

IF OBJECT_ID('dbo.AttendanceNotifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceNotifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        NotificationType NVARCHAR(50) NOT NULL CONSTRAINT DF_AttendanceNotifications_Type DEFAULT ('info'),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceNotifications_CreatedAt DEFAULT (SYSDATETIME())
    );

    CREATE INDEX IX_AttendanceNotifications_Username_CreatedAt
        ON dbo.AttendanceNotifications (Username, CreatedAt DESC);
END;

IF OBJECT_ID('dbo.AttendanceAbsences', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceAbsences (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(150) NOT NULL,
        DisplayName NVARCHAR(255) NULL,
        WorkDate DATE NOT NULL,
        Reason NVARCHAR(500) NULL,
        RecordedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceAbsences_RecordedAt DEFAULT (SYSDATETIME())
    );

    CREATE UNIQUE INDEX UX_AttendanceAbsences_Username_WorkDate
        ON dbo.AttendanceAbsences (Username, WorkDate);

    CREATE INDEX IX_AttendanceAbsences_WorkDate
        ON dbo.AttendanceAbsences (WorkDate DESC);
END;
