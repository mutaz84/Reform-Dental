-- Events Management Schema Extension
-- Adds richer event fields and attendee linking for /api/events

IF COL_LENGTH('Events', 'EventCategory') IS NULL
BEGIN
    ALTER TABLE Events ADD EventCategory NVARCHAR(50) NULL;
END

IF COL_LENGTH('Events', 'Location') IS NULL
BEGIN
    ALTER TABLE Events ADD Location NVARCHAR(255) NULL;
END

IF COL_LENGTH('Events', 'OrganizerUserId') IS NULL
BEGIN
    ALTER TABLE Events ADD OrganizerUserId INT NULL;
END

IF COL_LENGTH('Events', 'OrganizerName') IS NULL
BEGIN
    ALTER TABLE Events ADD OrganizerName NVARCHAR(255) NULL;
END

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Events_OrganizerUserId_Users'
)
BEGIN
    ALTER TABLE Events
    ADD CONSTRAINT FK_Events_OrganizerUserId_Users
    FOREIGN KEY (OrganizerUserId) REFERENCES Users(Id);
END

IF COL_LENGTH('Events', 'EventDate') IS NULL
BEGIN
    ALTER TABLE Events ADD EventDate DATE NULL;
END

IF COL_LENGTH('Events', 'StartTime') IS NULL
BEGIN
    ALTER TABLE Events ADD StartTime NVARCHAR(20) NULL;
END

IF COL_LENGTH('Events', 'EndTime') IS NULL
BEGIN
    ALTER TABLE Events ADD EndTime NVARCHAR(20) NULL;
END

IF OBJECT_ID('EventAttendees', 'U') IS NULL
BEGIN
    CREATE TABLE EventAttendees (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        UserId INT NULL,
        DisplayName NVARCHAR(255) NULL,
        Email NVARCHAR(255) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'invited',
        CreatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_EventAttendees_EventId_Events FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventAttendees_UserId_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventAttendees_EventId'
      AND object_id = OBJECT_ID('EventAttendees')
)
BEGIN
    CREATE INDEX IX_EventAttendees_EventId ON EventAttendees(EventId);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Events_OrganizerUserId'
      AND object_id = OBJECT_ID('Events')
)
BEGIN
    CREATE INDEX IX_Events_OrganizerUserId ON Events(OrganizerUserId);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Events_EventType_StartDateTime'
      AND object_id = OBJECT_ID('Events')
)
BEGIN
    CREATE INDEX IX_Events_EventType_StartDateTime ON Events(EventType, StartDateTime);
END

-- Backfill compatibility fields from datetime columns where possible
UPDATE Events
SET EventDate = CAST(StartDateTime AS DATE)
WHERE EventDate IS NULL AND StartDateTime IS NOT NULL;

UPDATE Events
SET StartTime = CONVERT(VARCHAR(5), CAST(StartDateTime AS TIME), 108)
WHERE (StartTime IS NULL OR LTRIM(RTRIM(StartTime)) = '') AND StartDateTime IS NOT NULL;

UPDATE Events
SET EndTime = CONVERT(VARCHAR(5), CAST(EndDateTime AS TIME), 108)
WHERE (EndTime IS NULL OR LTRIM(RTRIM(EndTime)) = '') AND EndDateTime IS NOT NULL;
