-- =============================================
-- Reform Dental - Utilities Table Setup
-- Run this in Azure Portal Query Editor
-- =============================================

-- =============================================
-- UTILITIES TABLE
-- =============================================
-- Tracks office utility accounts (electricity, water, internet, phone, security, etc.)
-- under the Office Equipment section of the dashboard.
--
-- API endpoints (Azure Functions):
--   GET    /api/utilities          -> list all active utilities
--   GET    /api/utilities/{id}     -> get single utility
--   POST   /api/utilities          -> create utility
--   PUT    /api/utilities/{id}     -> update utility
--   DELETE /api/utilities/{id}     -> delete utility
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Utilities' AND xtype='U')
BEGIN
    CREATE TABLE Utilities (
        Id                INT           IDENTITY(1,1) PRIMARY KEY,
        UtilityName       NVARCHAR(200) NOT NULL,
        Category          NVARCHAR(100) NULL,            -- Electricity, Water, Gas, Internet, Phone, Security, Waste, HVAC, Other
        Provider          NVARCHAR(200) NULL,            -- Provider / utility company name
        Service           NVARCHAR(200) NULL,            -- Optional service description, e.g. "Express Computer Services"
        AccountNumber     NVARCHAR(100) NULL,
        ServiceStartDate  DATE          NULL,
        ContractTerm      NVARCHAR(50)  NULL,            -- Annual | Monthly | As Needed
        ClinicId          INT           NULL,
        MonthlyCost       DECIMAL(10,2) NULL,
        Notes             NVARCHAR(MAX) NULL,
        Warnings          NVARCHAR(MAX) NULL,
        ImageUrl          NVARCHAR(MAX) NULL,
        DocumentUrl       NVARCHAR(MAX) NULL,
        IsActive          BIT           NOT NULL DEFAULT 1,
        CreatedDate       DATETIME      NOT NULL DEFAULT GETUTCDATE(),
        ModifiedDate      DATETIME      NULL,
        CONSTRAINT FK_Utilities_Clinics FOREIGN KEY (ClinicId) REFERENCES Clinics(Id)
    );

    -- Index to speed up filtering by clinic and active status
    CREATE INDEX IX_Utilities_ClinicId   ON Utilities (ClinicId);
    CREATE INDEX IX_Utilities_IsActive   ON Utilities (IsActive);
    CREATE INDEX IX_Utilities_Category   ON Utilities (Category);

    PRINT 'Created Utilities table';
END
ELSE
    PRINT 'Utilities table already exists';
GO

-- =============================================
-- Add ModifiedDate auto-update trigger (optional)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_Utilities_ModifiedDate')
BEGIN
    EXEC('
        CREATE TRIGGER TR_Utilities_ModifiedDate
        ON Utilities
        AFTER UPDATE
        AS
        BEGIN
            SET NOCOUNT ON;
            UPDATE Utilities
            SET ModifiedDate = GETUTCDATE()
            FROM Utilities u
            INNER JOIN inserted i ON u.Id = i.Id;
        END
    ');
    PRINT 'Created TR_Utilities_ModifiedDate trigger';
END
GO
