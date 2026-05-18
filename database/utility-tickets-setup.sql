-- ============================================================
-- Utility Tickets Setup
-- Run once against your Azure SQL database.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UtilityTickets'
)
BEGIN
    CREATE TABLE UtilityTickets (
        Id               INT IDENTITY(1,1) PRIMARY KEY,
        UtilityId        INT           NOT NULL,
        Title            NVARCHAR(255) NOT NULL,
        TicketType       NVARCHAR(100) NOT NULL DEFAULT 'Maintenance',
        Status           NVARCHAR(50)  NOT NULL DEFAULT 'Open',
        Priority         NVARCHAR(50)  NOT NULL DEFAULT 'Medium',
        Frequency        NVARCHAR(50)  NOT NULL DEFAULT 'One-Time',
        TicketDate       DATE          NULL,
        TicketTime       NVARCHAR(20)  NULL,
        AssignedTo       NVARCHAR(255) NULL,
        Cost             DECIMAL(10,2) NULL,
        Description      NVARCHAR(MAX) NULL,
        Notes            NVARCHAR(MAX) NULL,
        CompletedDate    DATE          NULL,
        IsActive         BIT           NOT NULL DEFAULT 1,
        CreatedDate      DATETIME      NOT NULL DEFAULT GETDATE(),
        ModifiedDate     DATETIME      NULL
    );
    PRINT 'UtilityTickets table created.';
END
ELSE
BEGIN
    PRINT 'UtilityTickets table already exists — checking for missing columns...';

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UtilityTickets' AND COLUMN_NAME='TicketTime')
        ALTER TABLE UtilityTickets ADD TicketTime NVARCHAR(20) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UtilityTickets' AND COLUMN_NAME='Frequency')
        ALTER TABLE UtilityTickets ADD Frequency NVARCHAR(50) NOT NULL DEFAULT 'One-Time';

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UtilityTickets' AND COLUMN_NAME='AssignedTo')
        ALTER TABLE UtilityTickets ADD AssignedTo NVARCHAR(255) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UtilityTickets' AND COLUMN_NAME='Cost')
        ALTER TABLE UtilityTickets ADD Cost DECIMAL(10,2) NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UtilityTickets' AND COLUMN_NAME='CompletedDate')
        ALTER TABLE UtilityTickets ADD CompletedDate DATE NULL;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='UtilityTickets' AND COLUMN_NAME='IsActive')
        ALTER TABLE UtilityTickets ADD IsActive BIT NOT NULL DEFAULT 1;

    PRINT 'UtilityTickets column check complete.';
END

GO
