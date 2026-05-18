-- ============================================================
-- Team Events Setup
-- Run once against your Azure SQL database.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'TeamEvents'
)
BEGIN
    CREATE TABLE TeamEvents (
        Id               INT IDENTITY(1,1) PRIMARY KEY,
        TeamId           INT           NOT NULL,
        Title            NVARCHAR(255) NOT NULL,
        EventType        NVARCHAR(100) NOT NULL DEFAULT 'Meeting',
        Status           NVARCHAR(50)  NOT NULL DEFAULT 'Scheduled',
        Priority         NVARCHAR(50)  NOT NULL DEFAULT 'Medium',
        EventDate        DATE          NULL,
        EventTime        NVARCHAR(20)  NULL,
        Frequency        NVARCHAR(50)  NOT NULL DEFAULT 'One-Time',
        Location         NVARCHAR(255) NULL,
        AssignedMembers  NVARCHAR(MAX) NULL,  -- JSON array: [{id, name}]
        Description      NVARCHAR(MAX) NULL,
        Notes            NVARCHAR(MAX) NULL,
        Attachments      NVARCHAR(MAX) NULL,  -- JSON array of attachment objects
        DocumentUrl      NVARCHAR(MAX) NULL,
        CompletedDate    DATE          NULL,
        IsActive         BIT           NOT NULL DEFAULT 1,
        CreatedDate      DATETIME      NOT NULL DEFAULT GETDATE(),
        ModifiedDate     DATETIME      NULL
    );
    PRINT 'TeamEvents table created.';
END
ELSE
BEGIN
    PRINT 'TeamEvents table already exists — checking for missing columns...';

    -- Backfill any columns added after initial creation
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='EventTime')
        ALTER TABLE TeamEvents ADD EventTime NVARCHAR(20) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='Frequency')
        ALTER TABLE TeamEvents ADD Frequency NVARCHAR(50) NOT NULL DEFAULT 'One-Time';

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='Location')
        ALTER TABLE TeamEvents ADD Location NVARCHAR(255) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='AssignedMembers')
        ALTER TABLE TeamEvents ADD AssignedMembers NVARCHAR(MAX) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='Attachments')
        ALTER TABLE TeamEvents ADD Attachments NVARCHAR(MAX) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='CompletedDate')
        ALTER TABLE TeamEvents ADD CompletedDate DATE NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='IsActive')
        ALTER TABLE TeamEvents ADD IsActive BIT NOT NULL DEFAULT 1;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TeamEvents' AND COLUMN_NAME='DocumentUrl')
        ALTER TABLE TeamEvents ADD DocumentUrl NVARCHAR(MAX) NULL;

    PRINT 'TeamEvents column check complete.';
END

-- Optional: foreign key to Teams if Teams table exists
-- ALTER TABLE TeamEvents
--   ADD CONSTRAINT FK_TeamEvents_Teams FOREIGN KEY (TeamId) REFERENCES Teams(Id);

GO
