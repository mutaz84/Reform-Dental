-- =============================================
-- Reform Dental - Teams Table Setup
-- Run this in Azure Portal Query Editor
-- =============================================

-- =============================================
-- TEAMS TABLE
-- =============================================
-- Manages office teams (morning huddle groups, departments, shift teams, etc.)
-- and their operation logs under the Office Equipment section.
--
-- API endpoints (Azure Functions):
--   GET    /api/teams          -> list all teams
--   GET    /api/teams/{id}     -> get single team
--   POST   /api/teams          -> create team
--   PUT    /api/teams/{id}     -> update team
--   DELETE /api/teams/{id}     -> delete team
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Teams' AND xtype='U')
BEGIN
    CREATE TABLE Teams (
        Id              INT             IDENTITY(1,1) PRIMARY KEY,
        TeamName        NVARCHAR(200)   NOT NULL,
        Category        NVARCHAR(100)   NULL,           -- Morning Huddle, Department, Shift Team, Project, Committee, etc.
        Description     NVARCHAR(1000)  NULL,
        TeamLeadId      NVARCHAR(100)   NULL,           -- Username / userId of team lead
        TeamLeadName    NVARCHAR(200)   NULL,           -- Display name of team lead
        Members         NVARCHAR(MAX)   NULL,           -- JSON: [{id, name}]
        OfficeId        NVARCHAR(50)    NULL,
        Schedule        NVARCHAR(200)   NULL,           -- e.g. "Mon-Fri 8:00 AM"
        ImageData       NVARCHAR(MAX)   NULL,           -- Base64 team photo
        DocumentData    NVARCHAR(MAX)   NULL,           -- Base64 document
        DocumentName    NVARCHAR(500)   NULL,
        Notes           NVARCHAR(MAX)   NULL,
        Warnings        NVARCHAR(MAX)   NULL,
        OperationsLog   NVARCHAR(MAX)   NULL,           -- JSON: [{opId, title, type, date, notes, isComplete}]
        IsActive        BIT             NOT NULL DEFAULT 1,
        CreatedDate     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        ModifiedDate    DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Teams table created successfully.';
END
ELSE
BEGIN
    PRINT 'Teams table already exists - skipping creation.';
    -- Add any missing columns for existing installs:
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='OperationsLog')
        ALTER TABLE Teams ADD OperationsLog NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='Description')
        ALTER TABLE Teams ADD Description NVARCHAR(1000) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='TeamLeadId')
        ALTER TABLE Teams ADD TeamLeadId NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='TeamLeadName')
        ALTER TABLE Teams ADD TeamLeadName NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='Members')
        ALTER TABLE Teams ADD Members NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='Schedule')
        ALTER TABLE Teams ADD Schedule NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Teams' AND COLUMN_NAME='DocumentName')
        ALTER TABLE Teams ADD DocumentName NVARCHAR(500) NULL;
    PRINT 'Column backfill check complete.';
END
