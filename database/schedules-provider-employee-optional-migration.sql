/*
  Migration: Support independent optional owner references on schedules
  - Adds nullable ProviderId and EmployeeId to Schedules
  - Makes legacy UserId nullable for optional owner flows
  - Keeps AssistantId optional (existing behavior)
  - Adds foreign keys and indexes when missing
*/

SET NOCOUNT ON;

IF OBJECT_ID('dbo.Schedules', 'U') IS NULL
BEGIN
    RAISERROR('Schedules table not found.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.Schedules', 'ProviderId') IS NULL
BEGIN
    ALTER TABLE dbo.Schedules ADD ProviderId INT NULL;
END;

IF COL_LENGTH('dbo.Schedules', 'EmployeeId') IS NULL
BEGIN
    ALTER TABLE dbo.Schedules ADD EmployeeId INT NULL;
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Schedules')
      AND name = 'UserId'
      AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.Schedules ALTER COLUMN UserId INT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Schedules_ProviderId_Users'
)
BEGIN
    ALTER TABLE dbo.Schedules WITH NOCHECK
    ADD CONSTRAINT FK_Schedules_ProviderId_Users
    FOREIGN KEY (ProviderId) REFERENCES dbo.Users(Id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Schedules_EmployeeId_Users'
)
BEGIN
    ALTER TABLE dbo.Schedules WITH NOCHECK
    ADD CONSTRAINT FK_Schedules_EmployeeId_Users
    FOREIGN KEY (EmployeeId) REFERENCES dbo.Users(Id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Schedules')
      AND name = 'IX_Schedules_ProviderId'
)
BEGIN
    CREATE INDEX IX_Schedules_ProviderId ON dbo.Schedules(ProviderId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Schedules')
      AND name = 'IX_Schedules_EmployeeId'
)
BEGIN
    CREATE INDEX IX_Schedules_EmployeeId ON dbo.Schedules(EmployeeId);
END;

PRINT 'Schedules owner model migration complete.';
