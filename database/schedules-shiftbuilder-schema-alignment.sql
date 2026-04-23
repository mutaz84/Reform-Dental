/*
  Migration: Align scheduling + shift-builder schema with current API contract.
  Safe to run multiple times.
*/

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID('dbo.Schedules', 'U') IS NULL
    BEGIN
        RAISERROR('dbo.Schedules table not found.', 16, 1);
    END

    IF COL_LENGTH('dbo.Schedules', 'AssistantId') IS NULL
    BEGIN
        ALTER TABLE dbo.Schedules ADD AssistantId INT NULL;
    END

    IF COL_LENGTH('dbo.Schedules', 'ProviderId') IS NULL
    BEGIN
        ALTER TABLE dbo.Schedules ADD ProviderId INT NULL;
    END

    IF COL_LENGTH('dbo.Schedules', 'EmployeeId') IS NULL
    BEGIN
        ALTER TABLE dbo.Schedules ADD EmployeeId INT NULL;
    END

    IF COL_LENGTH('dbo.Schedules', 'ShiftBuilderShiftId') IS NULL
    BEGIN
        ALTER TABLE dbo.Schedules ADD ShiftBuilderShiftId INT NULL;
    END

    IF COL_LENGTH('dbo.Schedules', 'ShiftBuilderEmployeeRowId') IS NULL
    BEGIN
        ALTER TABLE dbo.Schedules ADD ShiftBuilderEmployeeRowId INT NULL;
    END

    IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Schedules')
          AND name = 'UserId'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE dbo.Schedules ALTER COLUMN UserId INT NULL;
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Schedules_AssistantId_Users'
          AND parent_object_id = OBJECT_ID('dbo.Schedules')
    )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_AssistantId_Users
        FOREIGN KEY (AssistantId) REFERENCES dbo.Users(Id);
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Schedules_ProviderId_Users'
          AND parent_object_id = OBJECT_ID('dbo.Schedules')
    )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_ProviderId_Users
        FOREIGN KEY (ProviderId) REFERENCES dbo.Users(Id);
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Schedules_EmployeeId_Users'
          AND parent_object_id = OBJECT_ID('dbo.Schedules')
    )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_EmployeeId_Users
        FOREIGN KEY (EmployeeId) REFERENCES dbo.Users(Id);
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Schedules')
          AND name = 'IX_Schedules_AssistantId'
    )
    BEGIN
        CREATE INDEX IX_Schedules_AssistantId ON dbo.Schedules(AssistantId);
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Schedules')
          AND name = 'IX_Schedules_ProviderId'
    )
    BEGIN
        CREATE INDEX IX_Schedules_ProviderId ON dbo.Schedules(ProviderId);
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Schedules')
          AND name = 'IX_Schedules_EmployeeId'
    )
    BEGIN
        CREATE INDEX IX_Schedules_EmployeeId ON dbo.Schedules(EmployeeId);
    END

        IF OBJECT_ID('dbo.ShiftBuilderShifts', 'U') IS NOT NULL
             AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Schedules_ShiftBuilderShiftId'
          AND parent_object_id = OBJECT_ID('dbo.Schedules')
    )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_ShiftBuilderShiftId
        FOREIGN KEY (ShiftBuilderShiftId) REFERENCES dbo.ShiftBuilderShifts(Id);
    END

        IF OBJECT_ID('dbo.ShiftBuilderEmployeeRows', 'U') IS NOT NULL
             AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Schedules_ShiftBuilderEmployeeRowId'
          AND parent_object_id = OBJECT_ID('dbo.Schedules')
    )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_ShiftBuilderEmployeeRowId
        FOREIGN KEY (ShiftBuilderEmployeeRowId) REFERENCES dbo.ShiftBuilderEmployeeRows(Id);
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Schedules')
          AND name = 'IX_Schedules_ShiftBuilderShiftId'
    )
    BEGIN
        CREATE INDEX IX_Schedules_ShiftBuilderShiftId ON dbo.Schedules(ShiftBuilderShiftId);
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Schedules')
          AND name = 'IX_Schedules_ShiftBuilderEmployeeRowId'
    )
    BEGIN
        CREATE INDEX IX_Schedules_ShiftBuilderEmployeeRowId ON dbo.Schedules(ShiftBuilderEmployeeRowId);
    END

    IF OBJECT_ID('dbo.ShiftBuilderShifts', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ShiftBuilderShifts (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            ShiftDate DATE NULL,
            Title NVARCHAR(255) NOT NULL CONSTRAINT DF_ShiftBuilderShifts_Title DEFAULT ('Open Shift'),
            Status NVARCHAR(40) NOT NULL CONSTRAINT DF_ShiftBuilderShifts_Status DEFAULT ('open'),
            UseClinicDefaultTime BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_UseClinicDefaultTime DEFAULT (1),
            LinkMainCalendar BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_LinkMainCalendar DEFAULT (1),
            LinkMySchedule BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_LinkMySchedule DEFAULT (1),
            Notes NVARCHAR(MAX) NULL,
            CreatedByUserId INT NULL,
            IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderShifts_IsActive DEFAULT (1),
            CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderShifts_CreatedDate DEFAULT (GETUTCDATE()),
            ModifiedDate DATETIME2 NULL,
            CONSTRAINT FK_ShiftBuilderShifts_CreatedByUserId_Users FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(Id)
        );

        CREATE INDEX IX_ShiftBuilderShifts_ShiftDate ON dbo.ShiftBuilderShifts(ShiftDate);
        CREATE INDEX IX_ShiftBuilderShifts_IsActive ON dbo.ShiftBuilderShifts(IsActive);
    END

    IF OBJECT_ID('dbo.ShiftBuilderEmployeeRows', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ShiftBuilderEmployeeRows (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            ShiftId INT NOT NULL,
            EmployeeId INT NULL,
            RoleId INT NULL,
            RoleName NVARCHAR(120) NULL,
            ProviderId INT NULL,
            ClinicId INT NULL,
            RoomId INT NULL,
            AssistantUserId INT NULL,
            SortOrder INT NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_SortOrder DEFAULT (0),
            Notes NVARCHAR(MAX) NULL,
            IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_IsActive DEFAULT (1),
            CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderEmployeeRows_CreatedDate DEFAULT (GETUTCDATE()),
            ModifiedDate DATETIME2 NULL,
            CONSTRAINT FK_ShiftBuilderEmployeeRows_ShiftId FOREIGN KEY (ShiftId) REFERENCES dbo.ShiftBuilderShifts(Id) ON DELETE CASCADE,
            CONSTRAINT FK_ShiftBuilderEmployeeRows_EmployeeId_Users FOREIGN KEY (EmployeeId) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_ShiftBuilderEmployeeRows_ProviderId_Users FOREIGN KEY (ProviderId) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_ShiftBuilderEmployeeRows_AssistantUserId_Users FOREIGN KEY (AssistantUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_ShiftBuilderEmployeeRows_ClinicId_Clinics FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(Id),
            CONSTRAINT FK_ShiftBuilderEmployeeRows_RoomId_Rooms FOREIGN KEY (RoomId) REFERENCES dbo.Rooms(Id)
        );

        CREATE INDEX IX_ShiftBuilderEmployeeRows_ShiftId ON dbo.ShiftBuilderEmployeeRows(ShiftId);
        CREATE INDEX IX_ShiftBuilderEmployeeRows_EmployeeId ON dbo.ShiftBuilderEmployeeRows(EmployeeId);
        CREATE INDEX IX_ShiftBuilderEmployeeRows_IsActive ON dbo.ShiftBuilderEmployeeRows(IsActive);
    END

    IF OBJECT_ID('dbo.ShiftBuilderRowItems', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ShiftBuilderRowItems (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            EmployeeShiftId INT NOT NULL,
            ItemType NVARCHAR(80) NOT NULL,
            ItemId INT NULL,
            ItemName NVARCHAR(255) NULL,
            PayloadJson NVARCHAR(MAX) NULL,
            SortOrder INT NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_SortOrder DEFAULT (0),
            IsActive BIT NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_IsActive DEFAULT (1),
            CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ShiftBuilderRowItems_CreatedDate DEFAULT (GETUTCDATE()),
            ModifiedDate DATETIME2 NULL,
            CONSTRAINT FK_ShiftBuilderRowItems_EmployeeShiftId FOREIGN KEY (EmployeeShiftId) REFERENCES dbo.ShiftBuilderEmployeeRows(Id) ON DELETE CASCADE
        );

        CREATE INDEX IX_ShiftBuilderRowItems_EmployeeShiftId ON dbo.ShiftBuilderRowItems(EmployeeShiftId);
        CREATE INDEX IX_ShiftBuilderRowItems_ItemType ON dbo.ShiftBuilderRowItems(ItemType);
        CREATE INDEX IX_ShiftBuilderRowItems_IsActive ON dbo.ShiftBuilderRowItems(IsActive);
    END

    IF OBJECT_ID('dbo.ShiftBuilderShifts', 'U') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.foreign_keys
           WHERE name = 'FK_Schedules_ShiftBuilderShiftId'
             AND parent_object_id = OBJECT_ID('dbo.Schedules')
       )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_ShiftBuilderShiftId
        FOREIGN KEY (ShiftBuilderShiftId) REFERENCES dbo.ShiftBuilderShifts(Id);
    END

    IF OBJECT_ID('dbo.ShiftBuilderEmployeeRows', 'U') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.foreign_keys
           WHERE name = 'FK_Schedules_ShiftBuilderEmployeeRowId'
             AND parent_object_id = OBJECT_ID('dbo.Schedules')
       )
    BEGIN
        ALTER TABLE dbo.Schedules WITH NOCHECK
        ADD CONSTRAINT FK_Schedules_ShiftBuilderEmployeeRowId
        FOREIGN KEY (ShiftBuilderEmployeeRowId) REFERENCES dbo.ShiftBuilderEmployeeRows(Id);
    END

    COMMIT TRAN;
    PRINT 'Schedules + Shift Builder schema alignment complete.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();

    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
