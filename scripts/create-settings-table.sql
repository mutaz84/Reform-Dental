-- Create Settings table for master settings (logo, company name, etc.)
-- Run this script in Azure SQL Database

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Settings')
BEGIN
    CREATE TABLE Settings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(MAX),
        CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME2 DEFAULT GETUTCDATE()
    );
    PRINT 'Created Settings table';
END

-- Insert default settings if they don't exist
IF NOT EXISTS (SELECT 1 FROM Settings WHERE SettingKey = 'companyName')
BEGIN
    INSERT INTO Settings (SettingKey, SettingValue) VALUES ('companyName', 'ReformDental');
END

IF NOT EXISTS (SELECT 1 FROM Settings WHERE SettingKey = 'tagline')
BEGIN
    INSERT INTO Settings (SettingKey, SettingValue) VALUES ('tagline', 'Management System');
END

IF NOT EXISTS (SELECT 1 FROM Settings WHERE SettingKey = 'logoData')
BEGIN
    INSERT INTO Settings (SettingKey, SettingValue) VALUES ('logoData', NULL);
END

PRINT 'Settings table setup complete!';
