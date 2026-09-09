-- Generated from Data entries Excel workbooks on 2026-07-19.
-- Review, then run in SSMS/Azure Query Editor against the Reform Dental database.
-- The script is idempotent for the imported rows: it skips records already present by serial/account/name match.

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Clinics', N'U') IS NULL THROW 51000, 'Missing dbo.Clinics table.', 1;
IF OBJECT_ID(N'dbo.Equipment', N'U') IS NULL THROW 51001, 'Missing dbo.Equipment table.', 1;
IF OBJECT_ID(N'dbo.Supplies', N'U') IS NULL THROW 51002, 'Missing dbo.Supplies table.', 1;
IF OBJECT_ID(N'dbo.Instruments', N'U') IS NULL THROW 51003, 'Missing dbo.Instruments table.', 1;
IF OBJECT_ID(N'dbo.Utilities', N'U') IS NULL THROW 51004, 'Missing dbo.Utilities table. Run database/utilities-setup.sql first.', 1;
IF OBJECT_ID(N'dbo.Rooms', N'U') IS NULL THROW 51005, 'Missing dbo.Rooms table.', 1;
IF OBJECT_ID(N'dbo.Vendors', N'U') IS NULL THROW 51006, 'Missing dbo.Vendors table.', 1;

IF OBJECT_ID(N'dbo.OfficeEquipment', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OfficeEquipment (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(255) NULL,
        Category NVARCHAR(255) NULL,
        Brand NVARCHAR(255) NULL,
        Model NVARCHAR(255) NULL,
        SerialNumber NVARCHAR(255) NULL,
        Description NVARCHAR(MAX) NULL,
        Condition NVARCHAR(100) NULL,
        Status NVARCHAR(100) NULL CONSTRAINT DF_OfficeEquipment_Status_Import DEFAULT N'Operational',
        ClinicId INT NULL,
        RoomId INT NULL,
        VendorId INT NULL,
        PurchaseDate DATE NULL,
        PurchasePrice DECIMAL(12,2) NULL,
        WarrantyExpiry DATE NULL,
        MaintenanceSchedule NVARCHAR(255) NULL,
        LastMaintenanceDate DATE NULL,
        NextMaintenanceDate DATE NULL,
        ServiceIntervalDays INT NULL,
        LastServiceDate DATE NULL,
        NextServiceDate DATE NULL,
        ServiceVendor NVARCHAR(255) NULL,
        Notes NVARCHAR(MAX) NULL,
        Warnings NVARCHAR(MAX) NULL,
        ImageUrl NVARCHAR(MAX) NULL,
        DocumentUrl NVARCHAR(MAX) NULL,
        IsActive BIT NULL CONSTRAINT DF_OfficeEquipment_IsActive_Import DEFAULT (1),
        CreatedDate DATETIME2 NULL CONSTRAINT DF_OfficeEquipment_CreatedDate_Import DEFAULT SYSUTCDATETIME(),
        ModifiedDate DATETIME2 NULL
    );
END;

IF COL_LENGTH('dbo.Supplies', 'SupplyType') IS NULL ALTER TABLE dbo.Supplies ADD SupplyType NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.Instruments', 'Links') IS NULL ALTER TABLE dbo.Instruments ADD Links NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Utilities', 'ContractEndDate') IS NULL ALTER TABLE dbo.Utilities ADD ContractEndDate DATE NULL;

GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRANSACTION;

-- IMPORTANT: set this to the username you use to log in to the app.
-- The API only returns imported rows for clinics linked to the current user in dbo.UserClinics.
DECLARE @AppUsername NVARCHAR(255) = N'';


DECLARE @DentalEquipment TABLE (
    Name NVARCHAR(255), Category NVARCHAR(255), Brand NVARCHAR(255), Model NVARCHAR(255), SerialNumber NVARCHAR(255),
    OfficeName NVARCHAR(255), RoomName NVARCHAR(255), ServiceVendor NVARCHAR(255), PurchaseDate DATE, WarrantyExpiry DATE,
    PurchasePrice DECIMAL(12,2), Condition NVARCHAR(100), ImageUrl NVARCHAR(MAX), DocumentUrl NVARCHAR(MAX), Notes NVARCHAR(MAX), Warnings NVARCHAR(MAX)
);
INSERT INTO @DentalEquipment (Name, Category, Brand, Model, SerialNumber, OfficeName, RoomName, ServiceVendor, PurchaseDate, WarrantyExpiry, PurchasePrice, Condition, ImageUrl, DocumentUrl, Notes, Warnings)
VALUES
    (N'Dental Chair #01', N'Operatory Equipment', N'A-dec', N'A-dec 511B Dental Chair', N'HYP-ADEC511B-2025-0002', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-08-26'), CONVERT(date, '2035-08-26'), 16610.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Delivery Unit #01', N'Operatory Equipment', N'A-dec', N'A-dec 532B Radius Traditional Delivery System', N'HYP-ADEC532B-2025-0003', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-09-06'), CONVERT(date, '2035-09-06'), 9750.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Operatory Light #01', N'Operatory Equipment', N'A-dec', N'A-dec 572L LED Dental Light', N'HYP-ADEC572L-2025-0004', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-09-17'), CONVERT(date, '2035-09-17'), 5650.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Assistant Vacuum/Suction Package #01', N'Operatory Equipment', N'A-dec', N'A-dec 551A Radius Assistant’s Instrumentation', N'HYP-ADEC551A-2025-0005', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-09-28'), CONVERT(date, '2030-09-28'), 4080.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Intraoral X-Ray Unit #01', N'Imaging Equipment', N'Dentsply Sirona', N'Heliodent Plus Intraoral X-Ray System', N'HYP-HELIOPLUS-2025-0006', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-10-09'), CONVERT(date, '2030-10-09'), 8100.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Ionizing radiation—trained personnel only; follow the office radiation-safety program.'),
    (N'Intraoral Camera #01', N'Imaging Equipment', N'DEXIS', N'DEXcam 4 HD Intraoral Camera', N'HYP-DEXCAM4HD-2025-0007', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-10-20'), CONVERT(date, '2028-10-20'), 3620.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Curing Light #01', N'Restorative Equipment', N'Dentsply Sirona', N'SmartLite Pro Modular LED Curing Light', N'HYP-SMARTLITEP-2025-0008', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-10-31'), CONVERT(date, '2028-10-31'), 1775.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'High-intensity light—use appropriate eye protection.'),
    (N'High-Speed Handpiece #01', N'Handpieces', N'KaVo', N'MASTERtorque LUX M9000 L (1.008.7900)', N'HYP-KAVOM9000-2025-0009', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-11-11'), CONVERT(date, '2027-11-11'), 1495.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'High-Speed Handpiece #02', N'Handpieces', N'KaVo', N'MASTERtorque LUX M9000 L (1.008.7900)', N'HYP-KAVOM9000-2025-0010', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-11-22'), CONVERT(date, '2027-11-22'), 1435.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Low-Speed Handpiece System #01', N'Handpieces', N'KaVo', N'MASTERmatic LUX M20 L 1:1 (1.009.3620)', N'HYP-KAVOM20L-2025-0011', N'Bright Smile Dental', N'Operatory 1', N'DentalFixRX', CONVERT(date, '2025-12-03'), CONVERT(date, '2027-12-03'), 1160.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Dental Chair #02', N'Operatory Equipment', N'A-dec', N'A-dec 511B Dental Chair', N'HYP-ADEC511B-2025-0012', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2025-12-14'), CONVERT(date, '2035-12-14'), 16610.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Delivery Unit #02', N'Operatory Equipment', N'A-dec', N'A-dec 532B Radius Traditional Delivery System', N'HYP-ADEC532B-2025-0013', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2025-12-25'), CONVERT(date, '2035-12-25'), 9750.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Operatory Light #02', N'Operatory Equipment', N'A-dec', N'A-dec 572L LED Dental Light', N'HYP-ADEC572L-2026-0014', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-01-05'), CONVERT(date, '2036-01-05'), 5650.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Assistant Vacuum/Suction Package #02', N'Operatory Equipment', N'A-dec', N'A-dec 551A Radius Assistant’s Instrumentation', N'HYP-ADEC551A-2026-0015', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-01-16'), CONVERT(date, '2031-01-16'), 4080.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Intraoral X-Ray Unit #02', N'Imaging Equipment', N'Dentsply Sirona', N'Heliodent Plus Intraoral X-Ray System', N'HYP-HELIOPLUS-2026-0016', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-01-27'), CONVERT(date, '2031-01-27'), 8100.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Ionizing radiation—trained personnel only; follow the office radiation-safety program.'),
    (N'Intraoral Camera #02', N'Imaging Equipment', N'DEXIS', N'DEXcam 4 HD Intraoral Camera', N'HYP-DEXCAM4HD-2026-0017', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-02-07'), CONVERT(date, '2029-02-07'), 3620.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Curing Light #02', N'Restorative Equipment', N'Dentsply Sirona', N'SmartLite Pro Modular LED Curing Light', N'HYP-SMARTLITEP-2026-0018', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-02-18'), CONVERT(date, '2029-02-18'), 1775.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'High-intensity light—use appropriate eye protection.'),
    (N'High-Speed Handpiece #03', N'Handpieces', N'KaVo', N'MASTERtorque LUX M9000 L (1.008.7900)', N'HYP-KAVOM9000-2026-0019', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-03-01'), CONVERT(date, '2028-03-01'), 1495.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'High-Speed Handpiece #04', N'Handpieces', N'KaVo', N'MASTERtorque LUX M9000 L (1.008.7900)', N'HYP-KAVOM9000-2026-0020', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-03-12'), CONVERT(date, '2028-03-12'), 1435.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Low-Speed Handpiece System #02', N'Handpieces', N'KaVo', N'MASTERmatic LUX M20 L 1:1 (1.009.3620)', N'HYP-KAVOM20L-2026-0021', N'Bright Smile Dental', N'Operatory 2', N'DentalFixRX', CONVERT(date, '2026-03-23'), CONVERT(date, '2028-03-23'), 1160.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Dental Chair #03', N'Operatory Equipment', N'A-dec', N'A-dec 511B Dental Chair', N'HYP-ADEC511B-2026-0022', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2026-04-03'), CONVERT(date, '2036-04-03'), 16610.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Delivery Unit #03', N'Operatory Equipment', N'A-dec', N'A-dec 532B Radius Traditional Delivery System', N'HYP-ADEC532B-2026-0023', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2026-04-14'), CONVERT(date, '2036-04-14'), 9750.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Operatory Light #03', N'Operatory Equipment', N'A-dec', N'A-dec 572L LED Dental Light', N'HYP-ADEC572L-2026-0024', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2026-04-25'), CONVERT(date, '2036-04-25'), 5650.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Assistant Vacuum/Suction Package #03', N'Operatory Equipment', N'A-dec', N'A-dec 551A Radius Assistant’s Instrumentation', N'HYP-ADEC551A-2026-0025', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2026-05-06'), CONVERT(date, '2031-05-06'), 4080.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Intraoral X-Ray Unit #03', N'Imaging Equipment', N'Dentsply Sirona', N'Heliodent Plus Intraoral X-Ray System', N'HYP-HELIOPLUS-2026-0026', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2026-05-17'), CONVERT(date, '2031-05-17'), 8100.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Ionizing radiation—trained personnel only; follow the office radiation-safety program.'),
    (N'Intraoral Camera #03', N'Imaging Equipment', N'DEXIS', N'DEXcam 4 HD Intraoral Camera', N'HYP-DEXCAM4HD-2026-0027', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2026-05-28'), CONVERT(date, '2029-05-28'), 3620.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Curing Light #03', N'Restorative Equipment', N'Dentsply Sirona', N'SmartLite Pro Modular LED Curing Light', N'HYP-SMARTLITEP-2025-0028', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2025-08-12'), CONVERT(date, '2028-08-12'), 1775.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'High-intensity light—use appropriate eye protection.'),
    (N'Ultrasonic Scaler / Cavitron #01', N'Hygiene Equipment', N'Dentsply Sirona', N'Cavitron 300 Series Ultrasonic Scaling System (8270310)', N'HYP-CAV300-2025-0029', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2025-08-23'), CONVERT(date, '2029-08-23'), 4395.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Air Polishing Unit #01', N'Hygiene Equipment', N'EMS', N'AIRFLOW Prophylaxis Master', N'HYP-EMSAFPM-2025-0030', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2025-09-03'), CONVERT(date, '2028-09-03'), 12335.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Cordless Prophy Handpiece #01', N'Hygiene Equipment', N'Young Dental', N'Infinity Cordless Prophy Handpiece (295737)', N'HYP-YDINFINITY-2025-0031', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2025-09-14'), CONVERT(date, '2027-09-14'), 1060.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Low-Speed Handpiece System #03', N'Handpieces', N'KaVo', N'MASTERmatic LUX M20 L 1:1 (1.009.3620)', N'HYP-KAVOM20L-2025-0032', N'Bright Smile Dental', N'Hygiene Operatory', N'DentalFixRX', CONVERT(date, '2025-09-25'), CONVERT(date, '2027-09-25'), 1170.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Dental Chair #04', N'Operatory Equipment', N'A-dec', N'A-dec 511B Dental Chair', N'HYP-ADEC511B-2024-0033', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2024-04-16'), CONVERT(date, '2025-04-16'), 10935.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Delivery Unit #04', N'Operatory Equipment', N'A-dec', N'A-dec 532B Radius Traditional Delivery System', N'HYP-ADEC532B-2024-0034', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2024-05-03'), CONVERT(date, '2025-05-03'), 6700.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Operatory Light #04', N'Operatory Equipment', N'A-dec', N'A-dec 572L LED Dental Light', N'HYP-ADEC572L-2024-0035', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2024-05-20'), CONVERT(date, '2025-05-20'), 3050.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Assistant Vacuum/Suction Package #04', N'Operatory Equipment', N'A-dec', N'A-dec 551A Radius Assistant’s Instrumentation', N'HYP-ADEC551A-2024-0036', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2024-06-06'), CONVERT(date, '2025-06-06'), 2445.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Intraoral X-Ray Unit #04', N'Imaging Equipment', N'Dentsply Sirona', N'Heliodent Plus Intraoral X-Ray System', N'HYP-HELIOPLUS-2025-0037', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2025-11-19'), CONVERT(date, '2030-11-19'), 8185.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Ionizing radiation—trained personnel only; follow the office radiation-safety program.'),
    (N'Intraoral Camera #04', N'Imaging Equipment', N'DEXIS', N'DEXcam 4 HD Intraoral Camera', N'HYP-DEXCAM4HD-2024-0038', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2024-07-10'), CONVERT(date, '2025-07-10'), 2385.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Curing Light #04', N'Restorative Equipment', N'Dentsply Sirona', N'SmartLite Pro Modular LED Curing Light', N'HYP-SMARTLITEP-2025-0039', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2025-12-11'), CONVERT(date, '2028-12-11'), 1795.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'High-intensity light—use appropriate eye protection.'),
    (N'High-Speed Handpiece #05', N'Handpieces', N'KaVo', N'MASTERtorque LUX M9000 L (1.008.7900)', N'HYP-KAVOM9000-2025-0040', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2025-12-22'), CONVERT(date, '2027-12-22'), 1435.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'High-Speed Handpiece #06', N'Handpieces', N'KaVo', N'MASTERtorque LUX M9000 L (1.008.7900)', N'HYP-KAVOM9000-2026-0041', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2026-01-02'), CONVERT(date, '2028-01-02'), 1450.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Low-Speed Handpiece System #04', N'Handpieces', N'KaVo', N'MASTERmatic LUX M20 L 1:1 (1.009.3620)', N'HYP-KAVOM20L-2026-0042', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2026-01-13'), CONVERT(date, '2028-01-13'), 1170.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Endodontic Motor #01', N'Endodontic Equipment', N'Dentsply Sirona', N'X-Smart Pro+ Endodontic Motor', N'HYP-XSMARTPRO-2026-0043', N'Bright Smile Dental', N'Endodontic Operatory', N'Edge Endo', CONVERT(date, '2026-01-24'), CONVERT(date, '2029-01-24'), 5340.00, N'New', NULL, NULL, N'Purchase Vendor: Edge Endo
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Apex Locator #01', N'Endodontic Equipment', N'Kerr', N'Apex ID Digital Apex Locator (972-0090)', N'HYP-KERRAPEXID-2026-0044', N'Bright Smile Dental', N'Endodontic Operatory', N'Edge Endo', CONVERT(date, '2026-02-04'), CONVERT(date, '2028-02-04'), 1395.00, N'New', NULL, NULL, N'Purchase Vendor: Edge Endo
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Obturation Unit #01', N'Endodontic Equipment', N'Kerr', N'elements IC Obturation System', N'HYP-KERRIC-2026-0045', N'Bright Smile Dental', N'Endodontic Operatory', N'Edge Endo', CONVERT(date, '2026-02-15'), CONVERT(date, '2028-02-15'), 4125.00, N'New', NULL, NULL, N'Purchase Vendor: Edge Endo
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Heated components—burn hazard.'),
    (N'Endodontic Irrigation Activation Unit #01', N'Endodontic Equipment', N'Dentsply Sirona', N'SmartLite Pro EndoActivator', N'HYP-SLPENDOACT-2026-0046', N'Bright Smile Dental', N'Endodontic Operatory', N'Edge Endo', CONVERT(date, '2026-02-26'), CONVERT(date, '2028-02-26'), 1255.00, N'New', NULL, NULL, N'Purchase Vendor: Edge Endo
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Dental Operating Microscope #01', N'Endodontic Equipment', N'Global Surgical', N'A6 Series Dental Microscope', N'HYP-GLOBALSURG-2024-0047', N'Bright Smile Dental', N'Endodontic Operatory', N'DentalFixRX', CONVERT(date, '2024-12-10'), CONVERT(date, '2025-12-10'), 17660.00, N'Used', NULL, NULL, N'Purchase Vendor: Edge Endo
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'CBCT / Panoramic Imaging Unit #01', N'Imaging Equipment', N'Dentsply Sirona', N'Orthophos S 3D CBCT / Panoramic System', N'HYP-ORTHOS3D-2026-0048', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2026-03-20'), CONVERT(date, '2031-03-20'), 97515.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Ionizing radiation—trained personnel only; follow the office radiation-safety program.'),
    (N'Digital X-Ray Sensor Size 1 #01', N'Imaging Equipment', N'DEXIS', N'DEXIS IXS Sensor, Size 1', N'HYP-DEXISIXS1-2026-0049', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2026-03-31'), CONVERT(date, '2031-03-31'), 9295.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Digital X-Ray Sensor Size 1 #02', N'Imaging Equipment', N'DEXIS', N'DEXIS IXS Sensor, Size 1', N'HYP-DEXISIXS1-2026-0050', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2026-04-11'), CONVERT(date, '2031-04-11'), 8925.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Digital X-Ray Sensor Size 2 #01', N'Imaging Equipment', N'DEXIS', N'DEXIS IXS Sensor, Size 2', N'HYP-DEXISIXS2-2026-0051', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2026-04-22'), CONVERT(date, '2031-04-22'), 9500.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Digital X-Ray Sensor Size 2 #02', N'Imaging Equipment', N'DEXIS', N'DEXIS IXS Sensor, Size 2', N'HYP-DEXISIXS2-2026-0052', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2026-05-03'), CONVERT(date, '2031-05-03'), 9600.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Digital X-Ray Sensor Size 2 #03', N'Imaging Equipment', N'DEXIS', N'DEXIS IXS Sensor, Size 2', N'HYP-DEXISIXS2-2025-0053', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2025-03-22'), CONVERT(date, '2026-03-22'), 6320.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Digital X-Ray Sensor Size 2 #04', N'Imaging Equipment', N'DEXIS', N'DEXIS IXS Sensor, Size 2', N'HYP-DEXISIXS2-2025-0054', N'Bright Smile Dental', N'Imaging Room', N'DentalFixRX', CONVERT(date, '2025-04-08'), CONVERT(date, '2026-04-08'), 6660.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Autoclave #01', N'Sterilization Equipment', N'Midmark', N'M11 Steam Sterilizer (M11-050)', N'HYP-MIDM11-2025-0055', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-08-09'), CONVERT(date, '2027-08-09'), 8925.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot surfaces and pressurized steam—follow manufacturer instructions and allow cooling before handling.'),
    (N'Autoclave #02', N'Sterilization Equipment', N'Midmark', N'M11 Steam Sterilizer (M11-050)', N'HYP-MIDM11-2025-0056', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-05-12'), CONVERT(date, '2026-05-12'), 5345.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot surfaces and pressurized steam—follow manufacturer instructions and allow cooling before handling.'),
    (N'Instrument Washer / Disinfector #01', N'Sterilization Equipment', N'SciCan', N'HYDRIM C61W G4 Instrument Washer', N'HYP-HYDRIMC61-2025-0057', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-08-31'), CONVERT(date, '2027-08-31'), 15630.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot water and chemical exposure—use required PPE.'),
    (N'Ultrasonic Cleaner #01', N'Sterilization Equipment', N'Midmark', N'QuickClean QC3 Ultrasonic Cleaner (QC3-01)', N'HYP-MIDQC3-2025-0058', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-09-11'), CONVERT(date, '2027-09-11'), 2370.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Keep lid closed during operation and use required PPE.'),
    (N'Handpiece Maintenance Unit #01', N'Sterilization Equipment', N'SciCan', N'STATMATIC smart Handpiece Maintenance Unit', N'HYP-STATSMART-2025-0059', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-09-22'), CONVERT(date, '2027-09-22'), 6795.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Heat Sealer #01', N'Sterilization Equipment', N'W&H', N'Seal² Heat Sealer, 110 V', N'HYP-WHSEAL2-2025-0060', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-10-03'), CONVERT(date, '2027-10-03'), 1725.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot sealing surface—burn hazard.'),
    (N'Water Distiller #01', N'Sterilization Equipment', N'Tuttnauer', N'Steam Distiller DS1000', N'HYP-TUTDS1000-2025-0061', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-10-14'), CONVERT(date, '2026-10-14'), 1255.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot surfaces and steam—allow unit to cool before service.'),
    (N'Biological Indicator Incubator #01', N'Sterilization Equipment', N'3M', N'Attest Mini Auto-Reader 490M', N'HYP-3M490M-2025-0062', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-10-25'), CONVERT(date, '2026-10-25'), 5190.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Instrument Drying Cabinet #01', N'Sterilization Equipment', N'Boyd Industries', N'DryCurve 1100 Instrument Dryer', N'HYP-DRYC1100-2025-0063', N'Bright Smile Dental', N'Sterilization Center', N'DentalFixRX', CONVERT(date, '2025-11-05'), CONVERT(date, '2027-11-05'), 6430.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot surfaces—follow manufacturer temperature limits.'),
    (N'Lab Micromotor / Handpiece #01', N'Laboratory Equipment', N'NSK', N'ULTIMATE XL Torque Laboratory Micromotor (UMXL-GT)', N'HYP-NSKUMXLGT-2025-0064', N'Bright Smile Dental', N'Dental Laboratory', N'Lintec Technologies', CONVERT(date, '2025-09-25'), CONVERT(date, '2026-09-25'), 2175.00, N'Used', NULL, NULL, N'Purchase Vendor: Lintec Technologies
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Model Trimmer #01', N'Laboratory Equipment', N'Whip Mix', N'3/4 HP Wet Model Trimmer', N'HYP-WMMTRIM-2025-0065', N'Bright Smile Dental', N'Dental Laboratory', N'Lintec Technologies', CONVERT(date, '2025-10-12'), CONVERT(date, '2026-10-12'), 1240.00, N'Used', NULL, NULL, N'Purchase Vendor: Lintec Technologies
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Rotating wheel and splash hazard—use eye protection.'),
    (N'Dental Lathe / Polisher #01', N'Laboratory Equipment', N'Handler', N'26A Red Wing Two-Speed Lathe', N'HYP-HAND26A-2024-0066', N'Bright Smile Dental', N'Dental Laboratory', N'Lintec Technologies', CONVERT(date, '2024-04-17'), CONVERT(date, '2025-04-17'), 800.00, N'Used', NULL, NULL, N'Purchase Vendor: Lintec Technologies
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Rotating equipment—use guards and eye protection.'),
    (N'Vacuum Forming Machine #01', N'Laboratory Equipment', N'Keystone Industries', N'Machine III Vacuum Former (7000330)', N'HYP-KEYMACH3-2024-0067', N'Bright Smile Dental', N'Dental Laboratory', N'Lintec Technologies', CONVERT(date, '2024-05-04'), CONVERT(date, '2025-05-04'), 670.00, N'Used', NULL, NULL, N'Purchase Vendor: Lintec Technologies
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Hot surfaces—burn hazard.'),
    (N'Pressure Pot #01', N'Laboratory Equipment', N'Handler', N'448PP 8-Quart Pneumatic Pressure Pot', N'HYP-HAND448PP-2024-0068', N'Bright Smile Dental', N'Dental Laboratory', N'Lintec Technologies', CONVERT(date, '2024-05-21'), CONVERT(date, '2025-05-21'), 705.00, N'Used', NULL, NULL, N'Purchase Vendor: Lintec Technologies
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Pressurized vessel—do not exceed rated pressure.'),
    (N'Dental Lab Dust Collector #01', N'Laboratory Equipment', N'Renfert', N'SILENT compact, 120 V (29341000)', N'HYP-RENSILENT-2026-0069', N'Bright Smile Dental', N'Dental Laboratory', N'Lintec Technologies', CONVERT(date, '2026-01-10'), CONVERT(date, '2029-01-10'), 2395.00, N'New', NULL, NULL, N'Purchase Vendor: Lintec Technologies
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Dental Air Compressor #01', N'Mechanical Dental Equipment', N'DENTALEZ / RAMVAC', N'Ramvac C5-12 Dental Air Compressor', N'HYP-RAMC512-2026-0070', N'Bright Smile Dental', N'Mechanical / IT Room', N'DentalFixRX', CONVERT(date, '2026-01-21'), CONVERT(date, '2032-01-21'), 17230.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'High voltage and compressed air—qualified service only; lockout/tagout before maintenance.'),
    (N'Central Dental Vacuum / Suction Pump #01', N'Mechanical Dental Equipment', N'DENTALEZ / RAMVAC', N'Ramvac 4 Dry Vacuum System (RV4-12T)', N'HYP-RAMRV412T-2026-0071', N'Bright Smile Dental', N'Mechanical / IT Room', N'DentalFixRX', CONVERT(date, '2026-02-01'), CONVERT(date, '2031-02-01'), 20320.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'High voltage and vacuum system—qualified service only; lockout/tagout before maintenance.'),
    (N'Amalgam Separator #01', N'Mechanical Dental Equipment', N'Solmetex', N'NXT Hg5 Amalgam Separator (NXT-HG5-001)', N'HYP-SOLNXT5-2026-0072', N'Bright Smile Dental', N'Mechanical / IT Room', N'DentalFixRX', CONVERT(date, '2026-02-12'), CONVERT(date, '2028-02-12'), 2250.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Handle collected amalgam as regulated waste and follow disposal requirements.'),
    (N'Dental Water Treatment / Filtration System #01', N'Mechanical Dental Equipment', N'SciCan', N'VistaClear Dental Waterline Treatment System', N'HYP-SCIVCLEAR-2026-0073', N'Bright Smile Dental', N'Mechanical / IT Room', N'DentalFixRX', CONVERT(date, '2026-02-23'), CONVERT(date, '2029-02-23'), 5890.00, N'New', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Compressed-Air Dryer #01', N'Mechanical Dental Equipment', N'DENTALEZ / RAMVAC', N'Ramvac Compressor Dryer Assembly (004018SP)', N'HYP-RAMDRYER-2024-0074', N'Bright Smile Dental', N'Mechanical / IT Room', N'DentalFixRX', CONVERT(date, '2024-08-31'), CONVERT(date, '2025-08-31'), 2175.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Pressurized equipment—depressurize before servicing.'),
    (N'Vacuum Moisture Separator #01', N'Mechanical Dental Equipment', N'DENTALEZ / RAMVAC', N'Ramvac 15-Gallon Separation Tank (A575015)', N'HYP-RAMTANK15-2024-0075', N'Bright Smile Dental', N'Mechanical / IT Room', N'DentalFixRX', CONVERT(date, '2024-09-17'), CONVERT(date, '2025-09-17'), 1565.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Potential biohazard exposure—use appropriate PPE during service.'),
    (N'Intraoral Scanner #01', N'Digital Dentistry', N'Medit', N'Medit i700 Intraoral Scanner', N'HYP-MEDITI700-2026-0076', N'Bright Smile Dental', NULL, N'MEDIT', CONVERT(date, '2026-03-28'), CONVERT(date, '2028-03-28'), 18380.00, N'New', NULL, NULL, N'Purchase Vendor: MEDIT
Notes: Assign the normal storage or charging room after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Diode Laser #01', N'Laser Equipment', N'BIOLASE', N'Epic X Diode Laser', N'HYP-BIOEPICX-2024-0077', N'Bright Smile Dental', NULL, N'DentalFixRX', CONVERT(date, '2024-10-21'), CONVERT(date, '2025-10-21'), 8510.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: Assign the normal storage room after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Laser hazard—trained use only; use wavelength-specific eye protection and required signage.'),
    (N'Dental Photography Camera #01', N'Clinical Equipment', N'Canon', N'EOS R10 Mirrorless Camera', N'HYP-CANEOSR10-2024-0078', N'Bright Smile Dental', NULL, N'Xpress Computer Services', CONVERT(date, '2024-11-07'), CONVERT(date, '2025-11-07'), 1610.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: Assign the normal storage room after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Shade-Matching Device #01', N'Restorative Equipment', N'VITA', N'VITA Easyshade V', N'HYP-VITAEASYV-2024-0079', N'Bright Smile Dental', NULL, N'DentalFixRX', CONVERT(date, '2024-11-24'), CONVERT(date, '2025-11-24'), 3805.00, N'Used', NULL, NULL, N'Purchase Vendor: Darby Dental Supply
Notes: Assign the normal storage room after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Emergency Oxygen Unit #01', N'Emergency Equipment', N'HuFriedyGroup', N'Portable Oxygen System (38010)', N'HYP-HFOXY38010-2026-0080', N'Bright Smile Dental', NULL, N'Dalco Medical Products', CONVERT(date, '2026-05-11'), CONVERT(date, '2029-05-11'), 1820.00, N'New', NULL, NULL, N'Purchase Vendor: Dalco Medical Products
Notes: Assign the permanent storage location after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', N'Secure cylinder upright; keep away from heat, oils, and ignition sources.'),
    (N'Automated External Defibrillator (AED) #01', N'Emergency Equipment', N'ZOLL', N'AED Plus', N'HYP-ZOLLAEDP-2026-0081', N'Bright Smile Dental', NULL, N'Dalco Medical Products', CONVERT(date, '2026-05-22'), CONVERT(date, '2031-05-22'), 2420.00, N'New', NULL, NULL, N'Purchase Vendor: Dalco Medical Products
Notes: Assign the permanent wall or cabinet location after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Pulse Oximeter #01', N'Monitoring Equipment', N'Masimo', N'Rad-G Pulse Oximeter', N'HYP-MASRADG-2025-0082', N'Bright Smile Dental', NULL, N'Dalco Medical Products', CONVERT(date, '2025-08-06'), CONVERT(date, '2027-08-06'), 1270.00, N'New', NULL, NULL, N'Purchase Vendor: Dalco Medical Products
Notes: Assign the normal storage room after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL),
    (N'Automated Blood Pressure Monitor #01', N'Monitoring Equipment', N'Welch Allyn', N'Connex ProBP 3400 Digital Blood Pressure Device', N'HYP-WAPROBP34-2025-0083', N'Bright Smile Dental', NULL, N'Dalco Medical Products', CONVERT(date, '2025-08-17'), CONVERT(date, '2027-08-17'), 1775.00, N'New', NULL, NULL, N'Purchase Vendor: Dalco Medical Products
Notes: Assign the normal storage room after the physical audit. HYPOTHETICAL DEMO DATA: real product model; serial number, dates, price, condition, vendor assignment and warranty expiry are fictional.', NULL);


DECLARE @OfficeEquipment TABLE (
    Name NVARCHAR(255), Category NVARCHAR(255), Brand NVARCHAR(255), Model NVARCHAR(255), SerialNumber NVARCHAR(255),
    OfficeName NVARCHAR(255), RoomName NVARCHAR(255), ServiceVendor NVARCHAR(255), PurchaseDate DATE, WarrantyExpiry DATE,
    PurchasePrice DECIMAL(12,2), Condition NVARCHAR(100), ImageUrl NVARCHAR(MAX), DocumentUrl NVARCHAR(MAX), Notes NVARCHAR(MAX), Warnings NVARCHAR(MAX)
);
INSERT INTO @OfficeEquipment (Name, Category, Brand, Model, SerialNumber, OfficeName, RoomName, ServiceVendor, PurchaseDate, WarrantyExpiry, PurchasePrice, Condition, ImageUrl, DocumentUrl, Notes, Warnings)
VALUES
    (N'Clinical Workstation #01', N'Computers & Workstations', N'Dell', N'OptiPlex Micro Form Factor 7020', N'HYP-DELL7020M-2025-0001', N'Bright Smile Dental', N'Operatory 1', N'Xpress Computer Services', CONVERT(date, '2025-07-23'), CONVERT(date, '2028-07-23'), 1210.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2025-0002', N'Bright Smile Dental', N'Operatory 1', N'Xpress Computer Services', CONVERT(date, '2025-08-01'), CONVERT(date, '2028-08-01'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Workstation #02', N'Computers & Workstations', N'Dell', N'OptiPlex Micro Form Factor 7020', N'HYP-DELL7020M-2025-0003', N'Bright Smile Dental', N'Operatory 2', N'Xpress Computer Services', CONVERT(date, '2025-08-10'), CONVERT(date, '2028-08-10'), 1235.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Monitor #02', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2025-0004', N'Bright Smile Dental', N'Operatory 2', N'Xpress Computer Services', CONVERT(date, '2025-08-19'), CONVERT(date, '2028-08-19'), 335.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Workstation #03', N'Computers & Workstations', N'Dell', N'OptiPlex Micro Form Factor 7020', N'HYP-DELL7020M-2025-0005', N'Bright Smile Dental', N'Hygiene Operatory', N'Xpress Computer Services', CONVERT(date, '2025-08-28'), CONVERT(date, '2028-08-28'), 1195.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Monitor #03', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2025-0006', N'Bright Smile Dental', N'Hygiene Operatory', N'Xpress Computer Services', CONVERT(date, '2025-09-06'), CONVERT(date, '2028-09-06'), 325.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Workstation #04', N'Computers & Workstations', N'Dell', N'OptiPlex Micro Form Factor 7020', N'HYP-DELL7020M-2025-0007', N'Bright Smile Dental', N'Endodontic Operatory', N'Xpress Computer Services', CONVERT(date, '2025-09-15'), CONVERT(date, '2028-09-15'), 1220.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Clinical Monitor #04', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2025-0008', N'Bright Smile Dental', N'Endodontic Operatory', N'Xpress Computer Services', CONVERT(date, '2025-09-24'), CONVERT(date, '2028-09-24'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Imaging Workstation #01', N'Computers & Workstations', N'Dell', N'Precision 3680 Tower Workstation', N'HYP-DELLP3680-2025-0009', N'Bright Smile Dental', N'Imaging Room', N'Xpress Computer Services', CONVERT(date, '2025-10-03'), CONVERT(date, '2028-10-03'), 3895.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Imaging Diagnostic Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus QHD Monitor P2425D', N'HYP-DELLP2425D-2025-0010', N'Bright Smile Dental', N'Imaging Room', N'Xpress Computer Services', CONVERT(date, '2025-10-12'), CONVERT(date, '2028-10-12'), 445.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Imaging Diagnostic Monitor #02', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus QHD Monitor P2425D', N'HYP-DELLP2425D-2025-0011', N'Bright Smile Dental', N'Imaging Room', N'Xpress Computer Services', CONVERT(date, '2025-10-21'), CONVERT(date, '2028-10-21'), 450.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Dental Laboratory Workstation #01', N'Computers & Workstations', N'Dell', N'OptiPlex Small Form Factor 7020', N'HYP-DELL7020SFF-2024-0012', N'Bright Smile Dental', N'Dental Laboratory', N'Xpress Computer Services', CONVERT(date, '2024-02-12'), CONVERT(date, '2025-02-11'), 700.00, N'Used', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Dental Laboratory Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2024-0013', N'Bright Smile Dental', N'Dental Laboratory', N'Xpress Computer Services', CONVERT(date, '2024-03-12'), CONVERT(date, '2025-03-12'), 180.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Sterilization Workstation #01', N'Computers & Workstations', N'Dell', N'OptiPlex Micro Form Factor 7020', N'HYP-DELL7020M-2024-0014', N'Bright Smile Dental', N'Sterilization Center', N'Xpress Computer Services', CONVERT(date, '2024-04-10'), CONVERT(date, '2025-04-10'), 710.00, N'Used', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Sterilization Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2024-0015', N'Bright Smile Dental', N'Sterilization Center', N'Xpress Computer Services', CONVERT(date, '2024-05-09'), CONVERT(date, '2025-05-09'), 205.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Consultation Workstation #01', N'Computers & Workstations', N'Dell', N'OptiPlex Micro Form Factor 7020', N'HYP-DELL7020M-2025-0016', N'Bright Smile Dental', N'Consultation Room', N'Xpress Computer Services', CONVERT(date, '2025-12-05'), CONVERT(date, '2028-12-05'), 1210.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Consultation Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2025-0017', N'Bright Smile Dental', N'Consultation Room', N'Xpress Computer Services', CONVERT(date, '2025-12-14'), CONVERT(date, '2028-12-14'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Consultation Webcam #01', N'Audio / Visual', N'Logitech', N'Brio 505 Business Webcam', N'HYP-LOGBRIO505-2025-0018', N'Bright Smile Dental', N'Consultation Room', N'Xpress Computer Services', CONVERT(date, '2025-12-23'), CONVERT(date, '2028-12-23'), 135.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Consultation Speakerphone #01', N'Audio / Visual', N'Jabra', N'Speak2 55 UC Speakerphone', N'HYP-JABSPK255-2026-0019', N'Bright Smile Dental', N'Consultation Room', N'Xpress Computer Services', CONVERT(date, '2026-01-01'), CONVERT(date, '2028-01-01'), 195.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Consultation Display #01', N'Audio / Visual', N'Samsung', N'55-inch Crystal UHD DU7200 (UN55DU7200FXZA)', N'HYP-SAMDU7200-2026-0020', N'Bright Smile Dental', N'Consultation Room', N'Xpress Computer Services', CONVERT(date, '2026-01-10'), CONVERT(date, '2028-01-10'), 475.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Workstation #01', N'Computers & Workstations', N'Dell', N'OptiPlex Small Form Factor 7020', N'HYP-DELL7020SFF-2026-0021', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-01-19'), CONVERT(date, '2029-01-19'), 1355.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Workstation #02', N'Computers & Workstations', N'Dell', N'OptiPlex Small Form Factor 7020', N'HYP-DELL7020SFF-2026-0022', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-01-28'), CONVERT(date, '2029-01-28'), 1365.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Workstation #03', N'Computers & Workstations', N'Dell', N'OptiPlex Small Form Factor 7020', N'HYP-DELL7020SFF-2026-0023', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-02-06'), CONVERT(date, '2029-02-06'), 1380.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2026-0024', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-02-15'), CONVERT(date, '2029-02-15'), 335.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Monitor #02', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2026-0025', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-02-24'), CONVERT(date, '2029-02-24'), 320.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Monitor #03', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2026-0026', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-03-05'), CONVERT(date, '2029-03-05'), 325.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Monitor #04', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2026-0027', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-03-14'), CONVERT(date, '2029-03-14'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Monitor #05', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2026-0028', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-03-23'), CONVERT(date, '2029-03-23'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Monitor #06', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2026-0029', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-04-01'), CONVERT(date, '2029-04-01'), 335.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Doctor Office Workstation #01', N'Computers & Workstations', N'Dell', N'OptiPlex Small Form Factor 7020', N'HYP-DELL7020SFF-2023-0030', N'Bright Smile Dental', N'Doctor Office', N'Xpress Computer Services', CONVERT(date, '2023-08-28'), CONVERT(date, '2024-08-27'), 700.00, N'Used', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Doctor Office Monitor #01', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2023-0031', N'Bright Smile Dental', N'Doctor Office', N'Xpress Computer Services', CONVERT(date, '2023-09-26'), CONVERT(date, '2024-09-25'), 180.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Doctor Office Monitor #02', N'Monitors & Displays', N'Dell', N'Dell Pro 24 Plus Monitor P2425H', N'HYP-DELLP2425H-2023-0032', N'Bright Smile Dental', N'Doctor Office', N'Xpress Computer Services', CONVERT(date, '2023-10-25'), CONVERT(date, '2024-10-24'), 190.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Doctor Office Webcam #01', N'Audio / Visual', N'Logitech', N'Brio 505 Business Webcam', N'HYP-LOGBRIO505-2026-0033', N'Bright Smile Dental', N'Doctor Office', N'Xpress Computer Services', CONVERT(date, '2026-05-07'), CONVERT(date, '2029-05-07'), 135.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Reception Digital Display #01', N'Audio / Visual', N'Samsung', N'55-inch Crystal UHD DU7200 (UN55DU7200FXZA)', N'HYP-SAMDU7200-2026-0034', N'Bright Smile Dental', N'Reception and Waiting Area', N'Xpress Computer Services', CONVERT(date, '2026-05-16'), CONVERT(date, '2028-05-16'), 495.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Color Multifunction Printer #01', N'Printers & Scanners', N'HP', N'Color LaserJet Pro MFP 4301fdw (4RA82F)', N'HYP-HP4301FDW-2026-0035', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2026-05-25'), CONVERT(date, '2028-05-25'), 860.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Monochrome Multifunction Printer #01', N'Printers & Scanners', N'HP', N'LaserJet Pro MFP 4101fdw (2Z619F)', N'HYP-HP4101FDW-2024-0036', N'Bright Smile Dental', N'Doctor Office', N'Xpress Computer Services', CONVERT(date, '2024-02-18'), CONVERT(date, '2025-02-17'), 350.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Network Document Scanner #01', N'Printers & Scanners', N'Epson', N'DS-790WN Wireless Network Document Scanner (B11B265201)', N'HYP-EPSDS790-2025-0037', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2025-07-17'), CONVERT(date, '2028-07-17'), 1465.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Front Desk Label Printer #01', N'Printers & Scanners', N'Brother', N'QL-820NWB Professional Label Printer', N'HYP-BRQL820-2024-0038', N'Bright Smile Dental', N'Front Desk / Business Office', N'Xpress Computer Services', CONVERT(date, '2024-04-16'), CONVERT(date, '2025-04-16'), 140.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Sterilization Label Printer #01', N'Printers & Scanners', N'Brother', N'QL-820NWB Professional Label Printer', N'HYP-BRQL820-2025-0039', N'Bright Smile Dental', N'Sterilization Center', N'Xpress Computer Services', CONVERT(date, '2025-08-04'), CONVERT(date, '2027-08-04'), 245.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #01', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2025-0040', N'Bright Smile Dental', N'Front Desk / Business Office', N'Weave', CONVERT(date, '2025-08-13'), CONVERT(date, '2027-08-13'), 320.00, N'New', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #02', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2025-0041', N'Bright Smile Dental', N'Front Desk / Business Office', N'Weave', CONVERT(date, '2025-08-22'), CONVERT(date, '2027-08-22'), 325.00, N'New', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #03', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2025-0042', N'Bright Smile Dental', N'Doctor Office', N'Weave', CONVERT(date, '2025-08-31'), CONVERT(date, '2027-08-31'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #04', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2025-0043', N'Bright Smile Dental', N'Consultation Room', N'Weave', CONVERT(date, '2025-09-09'), CONVERT(date, '2027-09-09'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #05', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2024-0044', N'Bright Smile Dental', N'Dental Laboratory', N'Weave', CONVERT(date, '2024-10-07'), CONVERT(date, '2025-10-07'), 190.00, N'Used', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #06', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2024-0045', N'Bright Smile Dental', N'Sterilization Center', N'Weave', CONVERT(date, '2024-11-05'), CONVERT(date, '2025-11-05'), 205.00, N'Used', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #07', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2025-0046', N'Bright Smile Dental', N'Staff Break Room', N'Weave', CONVERT(date, '2025-10-06'), CONVERT(date, '2027-10-06'), 325.00, N'New', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Business IP Phone #08', N'Phones & Communications', N'Yealink', N'SIP-T54W Prime Business IP Phone', N'HYP-YLT54W-2025-0047', N'Bright Smile Dental', N'Imaging Room', N'Weave', CONVERT(date, '2025-10-15'), CONVERT(date, '2027-10-15'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: Weave
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Practice Management Server #01', N'Servers & Storage', N'Dell', N'PowerEdge T360 Tower Server', N'HYP-DELLT360-2025-0048', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2025-10-24'), CONVERT(date, '2030-10-24'), 8705.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Backup NAS #01', N'Servers & Storage', N'Synology', N'DiskStation DS923+ 4-Bay NAS', N'HYP-SYND923P-2025-0049', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2025-11-02'), CONVERT(date, '2028-11-02'), 3195.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Network Firewall #01', N'Network & Cybersecurity', N'Fortinet', N'FortiGate 60F', N'HYP-FG60F-2025-0050', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2025-11-11'), CONVERT(date, '2028-11-11'), 3355.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Managed PoE Network Switch #01', N'Network & Cybersecurity', N'Fortinet', N'FortiSwitch 124F-POE', N'HYP-FS124FPOE-2025-0051', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2025-11-20'), CONVERT(date, '2028-11-20'), 2420.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Wireless Access Point #01', N'Network & Cybersecurity', N'Fortinet', N'FortiAP 231F', N'HYP-FAP231F-2025-0052', N'Bright Smile Dental', N'Reception and Waiting Area', N'Xpress Computer Services', CONVERT(date, '2025-11-29'), CONVERT(date, '2028-11-29'), 730.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Wireless Access Point #02', N'Network & Cybersecurity', N'Fortinet', N'FortiAP 231F', N'HYP-FAP231F-2025-0053', N'Bright Smile Dental', N'Clinical Corridor', N'Xpress Computer Services', CONVERT(date, '2025-12-08'), CONVERT(date, '2028-12-08'), 740.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Wireless Access Point #03', N'Network & Cybersecurity', N'Fortinet', N'FortiAP 231F', N'HYP-FAP231F-2025-0054', N'Bright Smile Dental', N'Rear Clinical Area', N'Xpress Computer Services', CONVERT(date, '2025-12-17'), CONVERT(date, '2028-12-17'), 745.00, N'New', NULL, NULL, N'Purchase Vendor: Xpress Computer Services
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Comcast Business Gateway #01', N'Network & Cybersecurity', N'Technicolor', N'Comcast Business Gateway CGA4131COM', N'HYP-CGA4131-2025-0055', N'Bright Smile Dental', N'Mechanical / IT Room', N'Comcast/Xfinity', CONVERT(date, '2025-12-26'), CONVERT(date, '2027-12-26'), 410.00, N'New', NULL, NULL, N'Purchase Vendor: Comcast/Xfinity
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Network Equipment Rack #01', N'Network & Cybersecurity', N'Eaton Tripp Lite', N'SmartRack SR12UB 12U Rack Enclosure', N'HYP-SR12UB-2023-0056', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2023-10-31'), CONVERT(date, '2024-10-30'), 565.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Server UPS #01', N'Power Protection', N'APC by Schneider Electric', N'Smart-UPS SMT1500RM2UC', N'HYP-APCSMT1500-2026-0057', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2026-01-13'), CONVERT(date, '2029-01-13'), 1565.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Battery-backed electrical equipment—keep ventilation clear and replace batteries according to manufacturer guidance.'),
    (N'Network UPS #02', N'Power Protection', N'APC by Schneider Electric', N'Smart-UPS SMT1500RM2UC', N'HYP-APCSMT1500-2026-0058', N'Bright Smile Dental', N'Mechanical / IT Room', N'Xpress Computer Services', CONVERT(date, '2026-01-22'), CONVERT(date, '2029-01-22'), 1580.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Battery-backed electrical equipment—keep ventilation clear and replace batteries according to manufacturer guidance.'),
    (N'Security and Intrusion Control Panel #01', N'Security & Access Control', N'Qolsys / Johnson Controls', N'IQ Panel 4', N'HYP-IQPANEL4-2026-0059', N'Bright Smile Dental', N'Front Desk / Business Office', N'ADT Security', CONVERT(date, '2026-01-31'), CONVERT(date, '2029-01-31'), 895.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Indoor Security Camera #01', N'Security & Access Control', N'Alarm.com', N'1080p Indoor Wi-Fi Camera ADC-V523', N'HYP-ADCV523-2026-0060', N'Bright Smile Dental', N'Reception and Waiting Area', N'ADT Security', CONVERT(date, '2026-02-09'), CONVERT(date, '2029-02-09'), 330.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Indoor Security Camera #02', N'Security & Access Control', N'Alarm.com', N'1080p Indoor Wi-Fi Camera ADC-V523', N'HYP-ADCV523-2026-0061', N'Bright Smile Dental', N'Front Desk / Business Office', N'ADT Security', CONVERT(date, '2026-02-18'), CONVERT(date, '2029-02-18'), 335.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Indoor Security Camera #03', N'Security & Access Control', N'Alarm.com', N'1080p Indoor Wi-Fi Camera ADC-V523', N'HYP-ADCV523-2026-0062', N'Bright Smile Dental', N'Clinical Corridor', N'ADT Security', CONVERT(date, '2026-02-27'), CONVERT(date, '2029-02-27'), 340.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Indoor Security Camera #04', N'Security & Access Control', N'Alarm.com', N'1080p Indoor Wi-Fi Camera ADC-V523', N'HYP-ADCV523-2026-0063', N'Bright Smile Dental', N'Mechanical / IT Room', N'ADT Security', CONVERT(date, '2026-03-08'), CONVERT(date, '2029-03-08'), 340.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Exterior Security Camera #01', N'Security & Access Control', N'Alarm.com', N'Pro Series Turret PoE Camera ADC-VC838PF', N'HYP-ADC838PF-2026-0064', N'Bright Smile Dental', N'Front Entry / Exterior', N'ADT Security', CONVERT(date, '2026-03-17'), CONVERT(date, '2029-03-17'), 795.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Exterior Security Camera #02', N'Security & Access Control', N'Alarm.com', N'Pro Series Turret PoE Camera ADC-VC838PF', N'HYP-ADC838PF-2026-0065', N'Bright Smile Dental', N'Rear Entry / Exterior', N'ADT Security', CONVERT(date, '2026-03-26'), CONVERT(date, '2029-03-26'), 765.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Security Video Recorder #01', N'Security & Access Control', N'Alarm.com', N'Pro Series CSVR ADC-CSVR2108P', N'HYP-ADCCSVR-2026-0066', N'Bright Smile Dental', N'Mechanical / IT Room', N'ADT Security', CONVERT(date, '2026-04-04'), CONVERT(date, '2029-04-04'), 3195.00, N'New', NULL, NULL, N'Purchase Vendor: ADT Security
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Main HVAC Heat Pump #01', N'HVAC & Building Systems', N'Goodman', N'GSZB404810 4-Ton Heat Pump', N'HYP-GDMGSZB4-2026-0067', N'Bright Smile Dental', N'Building Exterior', N'Home Depot', CONVERT(date, '2026-04-13'), CONVERT(date, '2036-04-13'), 5775.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'High-voltage and refrigerant equipment—qualified HVAC service personnel only.'),
    (N'Main HVAC Air Handler #01', N'HVAC & Building Systems', N'Goodman', N'AMST48CU1400 4-Ton Air Handler', N'HYP-GDMAMST48-2026-0068', N'Bright Smile Dental', N'Mechanical / IT Room', N'Home Depot', CONVERT(date, '2026-04-22'), CONVERT(date, '2036-04-22'), 3755.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'High-voltage equipment—disconnect power before service.'),
    (N'HVAC Smart Thermostat #01', N'HVAC & Building Systems', N'ecobee', N'Smart Thermostat Premium', N'HYP-ECOBEEPREM-2026-0069', N'Bright Smile Dental', N'Clinical Corridor', N'Home Depot', CONVERT(date, '2026-05-01'), CONVERT(date, '2029-05-01'), 295.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Electric Water Heater #01', N'HVAC & Building Systems', N'Rheem', N'Gladiator 50-Gallon Electric Water Heater XE50T12CS55U1', N'HYP-RHEEMXE50-2026-0070', N'Bright Smile Dental', N'Staff Break Room', N'Home Depot', CONVERT(date, '2026-05-10'), CONVERT(date, '2038-05-10'), 955.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Hot water and high-voltage hazard—qualified service only.'),
    (N'Office Washer #01', N'Office Appliances', N'LG', N'4.5 cu. ft. Front Load Washer WM3400CW', N'HYP-LGWM3400-2026-0071', N'Bright Smile Dental', N'Mechanical / IT Room', N'Home Depot', CONVERT(date, '2026-05-19'), CONVERT(date, '2029-05-19'), 770.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Disconnect power and water before service.'),
    (N'Office Dryer #01', N'Office Appliances', N'LG', N'7.4 cu. ft. Electric Dryer DLE3400W', N'HYP-LGDLE3400-2026-0072', N'Bright Smile Dental', N'Mechanical / IT Room', N'Home Depot', CONVERT(date, '2026-05-28'), CONVERT(date, '2029-05-28'), 875.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Fire hazard—clean the lint filter after use and inspect the exhaust duct regularly.'),
    (N'Break Room Refrigerator #01', N'Office Appliances', N'Whirlpool', N'20 cu. ft. Top-Freezer Refrigerator WRT311FZDW', N'HYP-WHWRT311-2023-0073', N'Bright Smile Dental', N'Staff Break Room', N'Home Depot', CONVERT(date, '2023-04-17'), CONVERT(date, '2024-04-16'), 505.00, N'Used', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Break Room Microwave #01', N'Office Appliances', N'Panasonic', N'1.2 cu. ft. Inverter Microwave NN-SN686SR', N'HYP-PAN686SR-2023-0074', N'Bright Smile Dental', N'Staff Break Room', N'Home Depot', CONVERT(date, '2023-05-16'), CONVERT(date, '2024-05-15'), 140.00, N'Used', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Do not operate empty; use microwave-safe containers only.'),
    (N'Break Room Dishwasher #01', N'Office Appliances', N'Bosch', N'300 Series Dishwasher SHE53B75UC', N'HYP-BOSCH53B75-2025-0075', N'Bright Smile Dental', N'Staff Break Room', N'Home Depot', CONVERT(date, '2025-07-29'), CONVERT(date, '2028-07-29'), 1050.00, N'New', NULL, NULL, N'Purchase Vendor: Home Depot
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Hot water and electrical equipment—disconnect utilities before service.'),
    (N'Commercial Coffee Maker #01', N'Office Appliances', N'Keurig', N'K-1500 Commercial Coffee Maker', N'HYP-KEUK1500-2025-0076', N'Bright Smile Dental', N'Staff Break Room', N'Amazon Business', CONVERT(date, '2025-08-07'), CONVERT(date, '2027-08-07'), 385.00, N'New', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'HIPAA Document Shredder #01', N'Office Machines', N'Fellowes', N'Powershred 225Ci Cross-Cut Shredder (3825001)', N'HYP-FEL225CI-2023-0077', N'Bright Smile Dental', N'Front Desk / Business Office', N'Amazon Business', CONVERT(date, '2023-08-11'), CONVERT(date, '2024-08-10'), 805.00, N'Used', NULL, NULL, N'Purchase Vendor: Amazon Business
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', N'Keep hands, clothing, jewelry and loose objects away from the feed opening.'),
    (N'Exit / Emergency Combo Light #01', N'Lighting & Electrical', N'Lithonia Lighting', N'ECRG RD M6 LED Exit / Emergency Combo', N'HYP-LITECRGRD-2025-0078', N'Bright Smile Dental', N'Front Entry', N'Horizon Light', CONVERT(date, '2025-08-25'), CONVERT(date, '2030-08-25'), 280.00, N'New', NULL, NULL, N'Purchase Vendor: CED
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Exit / Emergency Combo Light #02', N'Lighting & Electrical', N'Lithonia Lighting', N'ECRG RD M6 LED Exit / Emergency Combo', N'HYP-LITECRGRD-2025-0079', N'Bright Smile Dental', N'Rear Entry', N'Horizon Light', CONVERT(date, '2025-09-03'), CONVERT(date, '2030-09-03'), 285.00, N'New', NULL, NULL, N'Purchase Vendor: CED
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Emergency Lighting Unit #01', N'Lighting & Electrical', N'Lithonia Lighting', N'ELM2L M12 Quantum LED Emergency Unit', N'HYP-LITELM2L-2025-0080', N'Bright Smile Dental', N'Clinical Corridor', N'Horizon Light', CONVERT(date, '2025-09-12'), CONVERT(date, '2030-09-12'), 170.00, N'New', NULL, NULL, N'Purchase Vendor: CED
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL),
    (N'Emergency Lighting Unit #02', N'Lighting & Electrical', N'Lithonia Lighting', N'ELM2L M12 Quantum LED Emergency Unit', N'HYP-LITELM2L-2025-0081', N'Bright Smile Dental', N'Reception and Waiting Area', N'Horizon Light', CONVERT(date, '2025-09-21'), CONVERT(date, '2030-09-21'), 170.00, N'New', NULL, NULL, N'Purchase Vendor: CED
Notes: HYPOTHETICAL DEMO DATA: real manufacturer/model; serial number, dates, price, condition, vendor assignments and warranty expiry are fictional.', NULL);


DECLARE @Supplies TABLE (
    Name NVARCHAR(255), Category NVARCHAR(255), OfficeName NVARCHAR(255), Description NVARCHAR(MAX), Notes NVARCHAR(MAX), Warnings NVARCHAR(MAX), ImageUrl NVARCHAR(MAX), DocumentUrl NVARCHAR(MAX), SupplyType NVARCHAR(20)
);
INSERT INTO @Supplies (Name, Category, OfficeName, Description, Notes, Warnings, ImageUrl, DocumentUrl, SupplyType)
VALUES
    (N'Filtek Supreme Ultra Composite – A1B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade A1B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade A1B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – A2B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade A2B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade A2B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – A3B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade A3B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade A3B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – A3.5B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade A3.5B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade A3.5B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – A4B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade A4B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade A4B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – B1B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade B1B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade B1B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – B2B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade B2B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade B2B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Ultra Composite – C2B', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Ultra Universal Restorative, Body Shade C2B, 4 g Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Ultra Universal Restorative, Body Shade C2B, 4 g Syringe
Notes: Nanofilled universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007967/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Flowable – A1', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Flowable Restorative, Shade A1, Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Flowable Restorative, Shade A1, Syringe
Notes: Flowable composite for liners, small restorations, repair and minimally invasive preparations.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/dental-composites/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Flowable – A2', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Flowable Restorative, Shade A2, Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Flowable Restorative, Shade A2, Syringe
Notes: Flowable composite for liners, small restorations, repair and minimally invasive preparations.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/dental-composites/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Filtek Supreme Flowable – A3', N'Direct Restorative Composites', N'Bright Smile Dental', N'Filtek Supreme Flowable Restorative, Shade A3, Syringe', N'Manufacturer: Solventum (3M)
Model: Filtek Supreme Flowable Restorative, Shade A3, Syringe
Notes: Flowable composite for liners, small restorations, repair and minimally invasive preparations.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/dental-composites/', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'SDR flow+ Bulk Fill – Universal', N'Direct Restorative Composites', N'Bright Smile Dental', N'SDR flow+ Bulk Fill Flowable Composite, Shade Universal', N'Manufacturer: Dentsply Sirona
Model: SDR flow+ Bulk Fill Flowable Composite, Shade Universal
Notes: Bulk-fill flowable composite for posterior restorations and base/liner applications.
Links: Product reference | https://www.dentsplysirona.com/en-us/discover/discover-by-brand/sdr-flow-plus.html', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'SDR flow+ Bulk Fill – A1', N'Direct Restorative Composites', N'Bright Smile Dental', N'SDR flow+ Bulk Fill Flowable Composite, Shade A1', N'Manufacturer: Dentsply Sirona
Model: SDR flow+ Bulk Fill Flowable Composite, Shade A1
Notes: Bulk-fill flowable composite for posterior restorations and base/liner applications.
Links: Product reference | https://www.dentsplysirona.com/en-us/discover/discover-by-brand/sdr-flow-plus.html', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'SDR flow+ Bulk Fill – A2', N'Direct Restorative Composites', N'Bright Smile Dental', N'SDR flow+ Bulk Fill Flowable Composite, Shade A2', N'Manufacturer: Dentsply Sirona
Model: SDR flow+ Bulk Fill Flowable Composite, Shade A2
Notes: Bulk-fill flowable composite for posterior restorations and base/liner applications.
Links: Product reference | https://www.dentsplysirona.com/en-us/discover/discover-by-brand/sdr-flow-plus.html', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Harmonize Universal Composite – A1', N'Direct Restorative Composites', N'Bright Smile Dental', N'Harmonize Nanohybrid Universal Composite, Shade A1', N'Manufacturer: Kerr
Model: Harmonize Nanohybrid Universal Composite, Shade A1
Notes: Nanohybrid universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.kerrdental.com/en-ca/harmonize', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Harmonize Universal Composite – A2', N'Direct Restorative Composites', N'Bright Smile Dental', N'Harmonize Nanohybrid Universal Composite, Shade A2', N'Manufacturer: Kerr
Model: Harmonize Nanohybrid Universal Composite, Shade A2
Notes: Nanohybrid universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.kerrdental.com/en-ca/harmonize', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Harmonize Universal Composite – A3', N'Direct Restorative Composites', N'Bright Smile Dental', N'Harmonize Nanohybrid Universal Composite, Shade A3', N'Manufacturer: Kerr
Model: Harmonize Nanohybrid Universal Composite, Shade A3
Notes: Nanohybrid universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.kerrdental.com/en-ca/harmonize', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Harmonize Universal Composite – Bleach White', N'Direct Restorative Composites', N'Bright Smile Dental', N'Harmonize Nanohybrid Universal Composite, Shade Bleach White', N'Manufacturer: Kerr
Model: Harmonize Nanohybrid Universal Composite, Shade Bleach White
Notes: Nanohybrid universal composite for anterior and posterior direct restorations.
Links: Product reference | https://www.kerrdental.com/en-ca/harmonize', N'Light-sensitive dental material. Keep capped, protect from operatory light, follow the current IFU and verify shade and expiration before use.', NULL, NULL, N'Dental'),
    (N'Scotchbond Universal Plus Adhesive', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'Scotchbond Universal Plus Adhesive, 5 ml Vial, 41294', N'Manufacturer: Solventum (3M)
Model: Scotchbond Universal Plus Adhesive, 5 ml Vial, 41294
Notes: Universal one-bottle adhesive for direct and indirect procedures.
Links: Product reference | https://www.solventum.com/en-us/home/f/b5005223013/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Scotchbond Universal Etchant', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'Scotchbond Universal Etchant, 3 ml Syringe', N'Manufacturer: Solventum (3M)
Model: Scotchbond Universal Etchant, 3 ml Syringe
Notes: Phosphoric-acid etching gel for enamel and dentin conditioning.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/dental-adhesives/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Prime&Bond active Universal Adhesive', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'Prime&Bond active Universal Adhesive', N'Manufacturer: Dentsply Sirona
Model: Prime&Bond active Universal Adhesive
Notes: Universal adhesive for total-etch, self-etch and selective-etch techniques.
Links: Product reference | https://www.dentsplysirona.com/en-us/shop/product-page.html/R-BP-1000186014/prime-bond-active.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'OptiBond Universal 360', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'OptiBond Universal 360 Adhesive', N'Manufacturer: Kerr
Model: OptiBond Universal 360 Adhesive
Notes: Universal light-cure adhesive for direct and indirect bonding workflows.
Links: Product reference | https://www.kerrdental.com/en-us/products/anglodent/optibond-universal-360', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Ultra-Etch 35% Phosphoric Acid', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'Ultra-Etch Etchant, 35% Phosphoric Acid', N'Manufacturer: Ultradent
Model: Ultra-Etch Etchant, 35% Phosphoric Acid
Notes: Viscous phosphoric-acid etchant for enamel and dentin.
Links: Product reference | https://www.ultradent.com/resources/product-instructions', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Peak Universal Bond', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'Peak Universal Bond Light-Cure Adhesive', N'Manufacturer: Ultradent
Model: Peak Universal Bond Light-Cure Adhesive
Notes: Universal adhesive for direct bonding procedures.
Links: Product reference | https://www.ultradent.com/resources/product-instructions', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Consepsis Antibacterial Solution', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'Consepsis 2% Chlorhexidine Antibacterial Solution', N'Manufacturer: Ultradent
Model: Consepsis 2% Chlorhexidine Antibacterial Solution
Notes: Cavity-cleansing antibacterial solution used before restorative placement when indicated.
Links: Product reference | https://www.ultradent.com/resources/catalog', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Gluma Desensitizer', N'Adhesives, Etchants & Desensitizers', N'Bright Smile Dental', N'GLUMA Desensitizer', N'Manufacturer: Kulzer
Model: GLUMA Desensitizer
Notes: Dentin desensitizer for reducing postoperative sensitivity.
Links: Product reference | https://www.kulzer.com/en/en/products/gluma-desensitizer.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Biodentine', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'Biodentine All-in-One Dentine Substitute', N'Manufacturer: Septodont
Model: Biodentine All-in-One Dentine Substitute
Notes: Bioactive dentin substitute for pulp therapy, repair and dentin replacement.
Links: Product reference | https://www.septodontusa.com/product/dentin-restoration-biodentine/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Biodentine XP', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'Biodentine XP Dentine Restoration System', N'Manufacturer: Septodont
Model: Biodentine XP Dentine Restoration System
Notes: Capsule-based bioactive dentin substitute and pulp-therapy material.
Links: Product reference | https://www.septodontusa.com/product/dentin-restoration-biodentine-xp/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'TheraCal LC', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'TheraCal LC Resin-Modified Calcium Silicate Pulp Protectant', N'Manufacturer: BISCO
Model: TheraCal LC Resin-Modified Calcium Silicate Pulp Protectant
Notes: Light-cured calcium-silicate liner for direct and indirect pulp-capping indications.
Links: Product reference | https://www.bisco.com/theracal-lc/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'UltraCal XS', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'UltraCal XS Calcium Hydroxide Paste', N'Manufacturer: Ultradent
Model: UltraCal XS Calcium Hydroxide Paste
Notes: Radiopaque calcium-hydroxide paste for temporary root-canal dressing.
Links: Product reference | https://www.ultradent.com/resources/product-instructions', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Vitrebond Plus Liner/Base', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'Vitrebond Plus Light Cure Glass Ionomer Liner/Base', N'Manufacturer: Solventum (3M)
Model: Vitrebond Plus Light Cure Glass Ionomer Liner/Base
Notes: Resin-modified glass-ionomer liner/base.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/liners-bases/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Fuji Lining LC', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'GC Fuji LINING LC Resin-Modified Glass Ionomer Liner', N'Manufacturer: GC America
Model: GC Fuji LINING LC Resin-Modified Glass Ionomer Liner
Notes: Light-cured glass-ionomer liner/base with fluoride release.
Links: Product reference | https://www.gcamerica.com/products/operatory', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Cavity Conditioner', N'Liners, Bases & Pulp Therapy', N'Bright Smile Dental', N'GC Cavity Conditioner', N'Manufacturer: GC America
Model: GC Cavity Conditioner
Notes: Polyacrylic-acid dentin conditioner for glass-ionomer procedures.
Links: Product reference | https://www.gcamerica.com/products/operatory', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'RelyX Universal Resin Cement', N'Luting & Resin Cements', N'Bright Smile Dental', N'RelyX Universal Resin Cement', N'Manufacturer: Solventum (3M)
Model: RelyX Universal Resin Cement
Notes: Dual-cure resin cement for indirect restorations.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/indirect-procedure/dental-cements/', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'Maxcem Elite Chroma', N'Luting & Resin Cements', N'Bright Smile Dental', N'Maxcem Elite Chroma Universal Resin Cement', N'Manufacturer: Kerr
Model: Maxcem Elite Chroma Universal Resin Cement
Notes: Self-adhesive resin cement with a color-cleanup indicator.
Links: Product reference | https://www.kerrdental.com/en-us/products/anglodent/maxcem-elite-chroma-universal-resin-cement', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'FujiCEM 2', N'Luting & Resin Cements', N'Bright Smile Dental', N'GC FujiCEM 2 Resin-Modified Glass Ionomer Cement', N'Manufacturer: GC America
Model: GC FujiCEM 2 Resin-Modified Glass Ionomer Cement
Notes: Automix RMGI luting cement for indirect restorations.
Links: Product reference | https://www.gcamerica.com/products/operatory/GC_FujiCEM_2/GCA_FujiCEM_2_Brochure_iPad.pdf', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'G-CEM ONE', N'Luting & Resin Cements', N'Bright Smile Dental', N'G-CEM ONE Self-Adhesive Resin Cement', N'Manufacturer: GC America
Model: G-CEM ONE Self-Adhesive Resin Cement
Notes: Universal self-adhesive resin cement.
Links: Product reference | https://www.gcamerica.com/products/operatory/cements.php', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'Calibra Universal', N'Luting & Resin Cements', N'Bright Smile Dental', N'Calibra Universal Self-Adhesive Resin Cement', N'Manufacturer: Dentsply Sirona
Model: Calibra Universal Self-Adhesive Resin Cement
Notes: Self-adhesive resin cement for indirect restorations.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'Variolink Esthetic DC', N'Luting & Resin Cements', N'Bright Smile Dental', N'Variolink Esthetic DC Dual-Cure Luting Composite', N'Manufacturer: Ivoclar
Model: Variolink Esthetic DC Dual-Cure Luting Composite
Notes: Adhesive resin cement for esthetic indirect restorations.
Links: Product reference | https://www.ivoclar.com/en_us/products/luting-material/variolink-esthetic', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'Ketac Cem Plus', N'Luting & Resin Cements', N'Bright Smile Dental', N'Ketac Cem Plus Resin-Modified Glass Ionomer Cement', N'Manufacturer: Solventum (3M)
Model: Ketac Cem Plus Resin-Modified Glass Ionomer Cement
Notes: RMGI cement for crowns, bridges and other indicated restorations.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/indirect-procedure/dental-cements/', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'Temp-Bond NE', N'Luting & Resin Cements', N'Bright Smile Dental', N'Temp-Bond NE Non-Eugenol Temporary Cement', N'Manufacturer: Kerr
Model: Temp-Bond NE Non-Eugenol Temporary Cement
Notes: Temporary cement for provisional crowns and bridges.
Links: Product reference | https://www.kerrdental.com/en-us/products/cements/temp-bond', N'Avoid contact with skin, eyes and soft tissue. Verify restoration compatibility, working time, cleanup window and expiration before use.', NULL, NULL, N'Dental'),
    (N'Protemp 4 Temporization Material – A2', N'Temporary & Provisional Materials', N'Bright Smile Dental', N'Protemp 4 Temporization Material, Shade A2', N'Manufacturer: Solventum (3M)
Model: Protemp 4 Temporization Material, Shade A2
Notes: Bis-acryl provisional crown-and-bridge material.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/indirect-procedure/temporization/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Protemp 4 Temporization Material – A3', N'Temporary & Provisional Materials', N'Bright Smile Dental', N'Protemp 4 Temporization Material, Shade A3', N'Manufacturer: Solventum (3M)
Model: Protemp 4 Temporization Material, Shade A3
Notes: Bis-acryl provisional crown-and-bridge material.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/indirect-procedure/temporization/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Integrity Temporary Crown & Bridge – A2', N'Temporary & Provisional Materials', N'Bright Smile Dental', N'Integrity Temporary Crown and Bridge Material, Shade A2', N'Manufacturer: Dentsply Sirona
Model: Integrity Temporary Crown and Bridge Material, Shade A2
Notes: Bis-acryl provisional material.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'J-Temp Temporary Resin', N'Temporary & Provisional Materials', N'Bright Smile Dental', N'J-Temp Temporary Resin', N'Manufacturer: Ultradent
Model: J-Temp Temporary Resin
Notes: Light-cured temporary restorative resin.
Links: Product reference | https://www.ultradent.com/resources/product-instructions', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Cavit Temporary Filling Material', N'Temporary & Provisional Materials', N'Bright Smile Dental', N'Cavit Temporary Filling Material', N'Manufacturer: Solventum (3M)
Model: Cavit Temporary Filling Material
Notes: Self-curing temporary restorative material.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/temporary-fillings/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'IRM Intermediate Restorative Material', N'Temporary & Provisional Materials', N'Bright Smile Dental', N'IRM Reinforced Zinc Oxide Eugenol Restorative', N'Manufacturer: Dentsply Sirona
Model: IRM Reinforced Zinc Oxide Eugenol Restorative
Notes: Reinforced temporary restorative material.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Palodent V3 Sectional Matrix – 4.5 mm', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Palodent V3 Matrix, 4.5 mm', N'Manufacturer: Dentsply Sirona
Model: Palodent V3 Matrix, 4.5 mm
Notes: Sectional matrix band for posterior composite restorations.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Palodent V3 Sectional Matrix – 5.5 mm', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Palodent V3 Matrix, 5.5 mm', N'Manufacturer: Dentsply Sirona
Model: Palodent V3 Matrix, 5.5 mm
Notes: Sectional matrix band for posterior composite restorations.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Palodent V3 Wedge – Small', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Palodent V3 Wedge, Small', N'Manufacturer: Dentsply Sirona
Model: Palodent V3 Wedge, Small
Notes: Anatomic wedge for sectional matrix isolation.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Palodent V3 Wedge – Medium', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Palodent V3 Wedge, Medium', N'Manufacturer: Dentsply Sirona
Model: Palodent V3 Wedge, Medium
Notes: Anatomic wedge for sectional matrix isolation.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Palodent V3 Wedge – Large', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Palodent V3 Wedge, Large', N'Manufacturer: Dentsply Sirona
Model: Palodent V3 Wedge, Large
Notes: Anatomic wedge for sectional matrix isolation.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Palodent V3 Universal Ring', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Palodent V3 Universal Retaining Ring', N'Manufacturer: Dentsply Sirona
Model: Palodent V3 Universal Retaining Ring
Notes: Reusable ring component for sectional matrix placement.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Omni-Matrix Disposable Retainer', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Omni-Matrix Disposable Retainer and Band', N'Manufacturer: Ultradent
Model: Omni-Matrix Disposable Retainer and Band
Notes: Disposable circumferential matrix system.
Links: Product reference | https://www.ultradent.com/resources/catalog', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'OpalDam Green', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'OpalDam Green Light-Cured Resin Barrier', N'Manufacturer: Ultradent
Model: OpalDam Green Light-Cured Resin Barrier
Notes: Light-cured soft-tissue barrier for whitening and other indicated procedures.
Links: Product reference | https://www.ultradent.com/resources/catalog', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Nic Tone Latex Rubber Dam – Heavy', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'Nic Tone Latex Rubber Dam, Heavy Gauge', N'Manufacturer: MDC Dental
Model: Nic Tone Latex Rubber Dam, Heavy Gauge
Notes: Rubber-dam sheet for isolation.
Links: Product reference | https://products.coltene.com/EN/US/products/isolation/dental-dam', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Hygenic Dental Dam – Non-Latex', N'Matrix, Wedges & Isolation', N'Bright Smile Dental', N'HYGENIC Non-Latex Dental Dam', N'Manufacturer: COLTENE
Model: HYGENIC Non-Latex Dental Dam
Notes: Latex-free rubber-dam sheet.
Links: Product reference | https://products.coltene.com/EN/US/products/isolation/dental-dam', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Imprint 4 Light Body VPS', N'Impression & Bite Registration', N'Bright Smile Dental', N'Imprint 4 Light VPS Impression Material, 71488', N'Manufacturer: Solventum (3M)
Model: Imprint 4 Light VPS Impression Material, 71488
Notes: Light-body wash material for final impressions.
Links: Product reference | https://www.solventum.com/en-us/home/v/v000096411/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Imprint 4 Heavy Body VPS', N'Impression & Bite Registration', N'Bright Smile Dental', N'Imprint 4 Heavy VPS Impression Material, 71492', N'Manufacturer: Solventum (3M)
Model: Imprint 4 Heavy VPS Impression Material, 71492
Notes: Heavy-body tray material for final impressions.
Links: Product reference | https://www.solventum.com/en-us/home/v/v000096415/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Imprint 4 Penta Heavy VPS', N'Impression & Bite Registration', N'Bright Smile Dental', N'Imprint 4 Penta Heavy VPS Impression Material, 71494', N'Manufacturer: Solventum (3M)
Model: Imprint 4 Penta Heavy VPS Impression Material, 71494
Notes: Automix heavy-body VPS impression material.
Links: Product reference | https://www.solventum.com/en-us/home/v/v000096417/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Imprint 4 Penta Putty VPS', N'Impression & Bite Registration', N'Bright Smile Dental', N'Imprint 4 Penta Putty VPS Impression Material, 71536', N'Manufacturer: Solventum (3M)
Model: Imprint 4 Penta Putty VPS Impression Material, 71536
Notes: Automix putty VPS impression material.
Links: Product reference | https://www.solventum.com/en-us/home/v/v000169616/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Aquasil Ultra+ XLV', N'Impression & Bite Registration', N'Bright Smile Dental', N'Aquasil Ultra+ Extra-Low Viscosity VPS', N'Manufacturer: Dentsply Sirona
Model: Aquasil Ultra+ Extra-Low Viscosity VPS
Notes: Extra-low-viscosity wash material for final impressions.
Links: Product reference | https://www.dentsplysirona.com/content/dentsply-sirona-dt/us/en/shop/brands/aquasil.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Aquasil Ultra+ Heavy', N'Impression & Bite Registration', N'Bright Smile Dental', N'Aquasil Ultra+ Heavy Tray Material', N'Manufacturer: Dentsply Sirona
Model: Aquasil Ultra+ Heavy Tray Material
Notes: Heavy-body VPS tray material.
Links: Product reference | https://www.dentsplysirona.com/content/dentsply-sirona-dt/us/en/shop/brands/aquasil.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Aquasil Ultra+ Putty', N'Impression & Bite Registration', N'Bright Smile Dental', N'Aquasil Ultra+ Putty', N'Manufacturer: Dentsply Sirona
Model: Aquasil Ultra+ Putty
Notes: VPS putty impression material.
Links: Product reference | https://www.dentsplysirona.com/en-us/shop/product-page.html/R-BP-1000186001/.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Blu-Mousse Bite Registration', N'Impression & Bite Registration', N'Bright Smile Dental', N'Blu-Mousse Super-Fast VPS Bite Registration', N'Manufacturer: Parkell
Model: Blu-Mousse Super-Fast VPS Bite Registration
Notes: Rigid VPS bite-registration material.
Links: Product reference | https://www.parkell.com/blu-mousse.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Algin.X Ultra Alginate', N'Impression & Bite Registration', N'Bright Smile Dental', N'Algin.X Ultra Alginate Impression Material', N'Manufacturer: Dentsply Sirona
Model: Algin.X Ultra Alginate Impression Material
Notes: Dust-reduced alginate for preliminary impressions.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'VPS Tray Adhesive', N'Impression & Bite Registration', N'Bright Smile Dental', N'VPS Tray Adhesive, 17 ml', N'Manufacturer: Solventum (3M)
Model: VPS Tray Adhesive, 17 ml
Notes: Tray adhesive for VPS impression materials.
Links: Product reference | https://www.solventum.com/en-us/home/f/b00007677/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'WaveOne Gold Gutta-Percha – Primary', N'Endodontic Materials', N'Bright Smile Dental', N'WaveOne Gold Conform Fit Gutta-Percha Points, Primary', N'Manufacturer: Dentsply Sirona
Model: WaveOne Gold Conform Fit Gutta-Percha Points, Primary
Notes: Matched gutta-percha points for WaveOne Gold Primary preparation.
Links: Product reference | https://www.dentsplysirona.com/en-us/explore/endodontics.html', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'WaveOne Gold Gutta-Percha – Medium', N'Endodontic Materials', N'Bright Smile Dental', N'WaveOne Gold Conform Fit Gutta-Percha Points, Medium', N'Manufacturer: Dentsply Sirona
Model: WaveOne Gold Conform Fit Gutta-Percha Points, Medium
Notes: Matched gutta-percha points for WaveOne Gold Medium preparation.
Links: Product reference | https://www.dentsplysirona.com/en-us/explore/endodontics.html', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'WaveOne Gold Paper Points – Primary', N'Endodontic Materials', N'Bright Smile Dental', N'WaveOne Gold Paper Points, Primary', N'Manufacturer: Dentsply Sirona
Model: WaveOne Gold Paper Points, Primary
Notes: Matched absorbent paper points.
Links: Product reference | https://www.dentsplysirona.com/en-us/explore/endodontics.html', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'AH Plus Jet Sealer', N'Endodontic Materials', N'Bright Smile Dental', N'AH Plus Jet Root Canal Sealer', N'Manufacturer: Dentsply Sirona
Model: AH Plus Jet Root Canal Sealer
Notes: Epoxy-amine root-canal sealer.
Links: Product reference | https://www.dentsplysirona.com/en-us/explore/endodontics.html', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'HyFlex EDM Gutta-Percha Assortment', N'Endodontic Materials', N'Bright Smile Dental', N'HyFlex EDM Gutta-Percha Points Assortment, 60 pcs', N'Manufacturer: COLTENE
Model: HyFlex EDM Gutta-Percha Points Assortment, 60 pcs
Notes: Matched gutta-percha points for HyFlex EDM preparations.
Links: Product reference | https://products.coltene.com/EN/US/products/endodontics/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'HyFlex EDM Paper Points', N'Endodontic Materials', N'Bright Smile Dental', N'HyFlex EDM Paper Points Assortment', N'Manufacturer: COLTENE
Model: HyFlex EDM Paper Points Assortment
Notes: Matched absorbent paper points.
Links: Product reference | https://products.coltene.com/EN/US/products/endodontics/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'GuttaFlow bioseal', N'Endodontic Materials', N'Bright Smile Dental', N'ROEKO GuttaFlow bioseal', N'Manufacturer: COLTENE
Model: ROEKO GuttaFlow bioseal
Notes: Bioceramic gutta-percha sealer system.
Links: Product reference | https://products.coltene.com/EN/US/products/endodontics/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'EndoREZ Sealer', N'Endodontic Materials', N'Bright Smile Dental', N'EndoREZ Methacrylate-Based Root Canal Sealer', N'Manufacturer: Ultradent
Model: EndoREZ Methacrylate-Based Root Canal Sealer
Notes: Hydrophilic resin-based root-canal sealer.
Links: Product reference | https://www.ultradent.com/resources/product-instructions', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'EDTA 17% Solution', N'Endodontic Materials', N'Bright Smile Dental', N'SmearClear 17% EDTA Solution', N'Manufacturer: Vista Apex
Model: SmearClear 17% EDTA Solution
Notes: Chelating irrigant used for smear-layer removal when indicated.
Links: Product reference | https://vistaapex.com/product-category/endodontics/irrigation/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'Sodium Hypochlorite 6%', N'Endodontic Materials', N'Bright Smile Dental', N'Chlor-XTRA 6% Sodium Hypochlorite Solution', N'Manufacturer: Vista Apex
Model: Chlor-XTRA 6% Sodium Hypochlorite Solution
Notes: Endodontic irrigant.
Links: Product reference | https://vistaapex.com/product-category/endodontics/irrigation/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'Sodium Hypochlorite 3%', N'Endodontic Materials', N'Bright Smile Dental', N'Chlor-XTRA 3% Sodium Hypochlorite Solution', N'Manufacturer: Vista Apex
Model: Chlor-XTRA 3% Sodium Hypochlorite Solution
Notes: Endodontic irrigant.
Links: Product reference | https://vistaapex.com/product-category/endodontics/irrigation/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'Chlorhexidine 2% Irrigant', N'Endodontic Materials', N'Bright Smile Dental', N'CHX-Plus 2% Chlorhexidine Solution', N'Manufacturer: Vista Apex
Model: CHX-Plus 2% Chlorhexidine Solution
Notes: Endodontic rinse used when clinically indicated.
Links: Product reference | https://vistaapex.com/product-category/endodontics/irrigation/', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'EndoActivator Tips – Medium', N'Endodontic Materials', N'Bright Smile Dental', N'EndoActivator Tips, Medium, 25 mm', N'Manufacturer: Dentsply Sirona
Model: EndoActivator Tips, Medium, 25 mm
Notes: Single-use sonic irrigation activation tips.
Links: Product reference | https://www.dentsplysirona.com/en-us/explore/endodontics.html', N'For professional endodontic use only. Follow the current IFU, maintain aseptic technique and verify size, taper, expiration and sterility before use.', NULL, NULL, N'Dental'),
    (N'Enamelast Fluoride Varnish – Cool Mint', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'Enamelast 5% Sodium Fluoride Varnish, Cool Mint', N'Manufacturer: Ultradent
Model: Enamelast 5% Sodium Fluoride Varnish, Cool Mint
Notes: Unit-dose fluoride varnish.
Links: Product reference | https://devglobal.ultradent.com/products/categories/prevent-hygiene/fluoride/enamelast-fluoride-varnish', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Enamelast Fluoride Varnish – Bubble Gum', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'Enamelast 5% Sodium Fluoride Varnish, Bubble Gum', N'Manufacturer: Ultradent
Model: Enamelast 5% Sodium Fluoride Varnish, Bubble Gum
Notes: Unit-dose fluoride varnish.
Links: Product reference | https://devglobal.ultradent.com/products/categories/prevent-hygiene/fluoride/enamelast-fluoride-varnish', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'MI Varnish', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'MI Varnish with RECALDENT', N'Manufacturer: GC America
Model: MI Varnish with RECALDENT
Notes: Fluoride varnish containing CPP-ACP.
Links: Product reference | https://www.gcamerica.com/products/preventive', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'MI Paste Plus', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'MI Paste Plus with RECALDENT and Fluoride', N'Manufacturer: GC America
Model: MI Paste Plus with RECALDENT and Fluoride
Notes: Topical remineralizing cream.
Links: Product reference | https://www.gcamerica.com/products/preventive', N'Use only as directed. Review flavor, allergen and fluoride information and prevent ingestion.', NULL, NULL, N'Dental'),
    (N'MI Paste ONE', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'MI Paste ONE Toothpaste with RECALDENT', N'Manufacturer: GC America
Model: MI Paste ONE Toothpaste with RECALDENT
Notes: Daily-use remineralizing toothpaste with fluoride.
Links: Product reference | https://www.gcamerica.com/products/preventive/MI_Paste_ONE/', N'Use only as directed. Review flavor, allergen and fluoride information and prevent ingestion.', NULL, NULL, N'Dental'),
    (N'Fuji TRIAGE – White', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'GC Fuji TRIAGE Glass Ionomer Sealant, White', N'Manufacturer: GC America
Model: GC Fuji TRIAGE Glass Ionomer Sealant, White
Notes: Moisture-tolerant glass-ionomer sealant and surface protectant.
Links: Product reference | https://www.gcamerica.com/products/preventive/GC_Fuji_TRIAGE/JCDA%20March%202007%20triage.pdf', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Fuji TRIAGE – Pink', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'GC Fuji TRIAGE Glass Ionomer Sealant, Pink', N'Manufacturer: GC America
Model: GC Fuji TRIAGE Glass Ionomer Sealant, Pink
Notes: Visible pink glass-ionomer sealant for erupting molars.
Links: Product reference | https://www.gcamerica.com/products/preventive/GC_Fuji_TRIAGE/JCDA%20March%202007%20triage.pdf', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Clinpro Sealant', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'Clinpro Sealant', N'Manufacturer: Solventum (3M)
Model: Clinpro Sealant
Notes: Light-cured pit-and-fissure sealant.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/prevention/sealants/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Clinpro 5000 Toothpaste', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'Clinpro 5000 1.1% Sodium Fluoride Toothpaste', N'Manufacturer: Solventum (3M)
Model: Clinpro 5000 1.1% Sodium Fluoride Toothpaste
Notes: Prescription-strength fluoride toothpaste.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/prevention/toothpaste/', N'Chemical dental material. Wear gloves and eye protection, avoid skin/eye contact, keep the current SDS available and follow the manufacturer''s IFU.', NULL, NULL, N'Dental'),
    (N'Cleanic Prophy Paste', N'Preventive & Hygiene Materials', N'Bright Smile Dental', N'Cleanic Prophy Paste', N'Manufacturer: Kerr
Model: Cleanic Prophy Paste
Notes: Professional prophylaxis paste.
Links: Product reference | https://www.kerrdental.com/en-us/products/preventive/cleanic', N'Use only as directed. Review flavor, allergen and fluoride information and prevent ingestion.', NULL, NULL, N'Dental'),
    (N'Septocaine 4% with Epinephrine 1:100,000', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Septocaine Articaine HCl 4% with Epinephrine 1:100,000, 1.7 ml Cartridges', N'Manufacturer: Septodont
Model: Septocaine Articaine HCl 4% with Epinephrine 1:100,000, 1.7 ml Cartridges
Notes: Dental local anesthetic cartridges.
Links: Product reference | https://www.septodontusa.com/', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'Septocaine 4% with Epinephrine 1:200,000', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Septocaine Articaine HCl 4% with Epinephrine 1:200,000, 1.7 ml Cartridges', N'Manufacturer: Septodont
Model: Septocaine Articaine HCl 4% with Epinephrine 1:200,000, 1.7 ml Cartridges
Notes: Dental local anesthetic cartridges.
Links: Product reference | https://www.septodontusa.com/product/pain-management-septocaine-epinephrine-1200000/', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'Carbocaine 3% Plain', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Carbocaine Mepivacaine HCl 3% Plain, 1.7 ml Cartridges', N'Manufacturer: Septodont
Model: Carbocaine Mepivacaine HCl 3% Plain, 1.7 ml Cartridges
Notes: Vasoconstrictor-free dental local anesthetic.
Links: Product reference | https://www.septodontusa.com/product/', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'Lidocaine 2% with Epinephrine 1:100,000', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Lidocaine HCl 2% with Epinephrine 1:100,000, Dental Cartridges', N'Manufacturer: Cook-Waite / Septodont
Model: Lidocaine HCl 2% with Epinephrine 1:100,000, Dental Cartridges
Notes: Dental local anesthetic cartridges.
Links: Product reference | https://www.septodontusa.com/product/', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'Septoject XL – Infiltration Needle', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Septoject XL Infiltration Needle, Item 01N1500', N'Manufacturer: Septodont
Model: Septoject XL Infiltration Needle, Item 01N1500
Notes: Sterile single-use dental needle.
Links: Product reference | https://www.septodontusa.com/product/pain-management-septoject-xl/', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'Septoject XL – Block Needle', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Septoject XL Block Needle, Item 01N1550', N'Manufacturer: Septodont
Model: Septoject XL Block Needle, Item 01N1550
Notes: Sterile single-use dental needle.
Links: Product reference | https://www.septodontusa.com/product/pain-management-septoject-xl/', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'Ultracare Topical Anesthetic Gel', N'Local Anesthesia & Injection', N'Bright Smile Dental', N'Ultracare 20% Benzocaine Topical Gel', N'Manufacturer: Ultradent
Model: Ultracare 20% Benzocaine Topical Gel
Notes: Topical anesthetic gel for oral mucosa.
Links: Product reference | https://devglobal.ultradent.com/products/categories/direct-restorative/related-products/ultracare-topical-gel', N'Prescription dental anesthetic or injection supply. Verify patient history, dose, lot, expiration and product integrity. Store and administer according to labeling and law.', NULL, NULL, N'Dental'),
    (N'4-0 Chromic Gut Suture', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'Chromic Gut Suture, 4-0, 27 in, PS-2 Needle', N'Manufacturer: Ethicon
Model: Chromic Gut Suture, 4-0, 27 in, PS-2 Needle
Notes: Absorbable surgical suture.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'4-0 Vicryl Suture', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'VICRYL Polyglactin 910 Suture, 4-0, PS-2 Needle', N'Manufacturer: Ethicon
Model: VICRYL Polyglactin 910 Suture, 4-0, PS-2 Needle
Notes: Absorbable braided surgical suture.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'5-0 Prolene Suture', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'PROLENE Polypropylene Suture, 5-0', N'Manufacturer: Ethicon
Model: PROLENE Polypropylene Suture, 5-0
Notes: Nonabsorbable monofilament surgical suture.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'CollaPlug Collagen Wound Dressing', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'CollaPlug Absorbable Collagen Wound Dressing', N'Manufacturer: Zimmer Biomet Dental
Model: CollaPlug Absorbable Collagen Wound Dressing
Notes: Absorbable collagen dressing for extraction sockets and surgical sites.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'OsteoGen Bone Grafting Plug', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'OsteoGen Bone Grafting Plug', N'Manufacturer: Impladent / Ultradent
Model: OsteoGen Bone Grafting Plug
Notes: Calcium apatite bone-grafting plug.
Links: Product reference | https://devglobal.ultradent.com/products/categories/surgical/bone-grafting/osteogen-bone-grafts', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'OsteoGen Bone Grafting Strip', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'OsteoGen Bone Grafting Strip', N'Manufacturer: Impladent / Ultradent
Model: OsteoGen Bone Grafting Strip
Notes: Conformable calcium apatite grafting strip.
Links: Product reference | https://devglobal.ultradent.com/products/categories/surgical/bone-grafting/osteogen-bone-grafts', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'Surgical Aspirator Tip', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'Sterile Surgical Aspirator Tip', N'Manufacturer: HVE Solutions
Model: Sterile Surgical Aspirator Tip
Notes: Single-use surgical suction tip.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sterile Irrigation Syringe – 12 ml', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'12 ml Sterile Curved-Tip Irrigation Syringe', N'Manufacturer: Medline
Model: 12 ml Sterile Curved-Tip Irrigation Syringe
Notes: Sterile irrigation syringe for surgical procedures.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sterile Saline – 500 ml', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'0.9% Sodium Chloride Irrigation, 500 ml', N'Manufacturer: Baxter
Model: 0.9% Sodium Chloride Irrigation, 500 ml
Notes: Sterile irrigation solution.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'Hemostatic Gauze', N'Surgical & Implant Consumables', N'Bright Smile Dental', N'SURGICEL Original Absorbable Hemostat', N'Manufacturer: Ethicon
Model: SURGICEL Original Absorbable Hemostat
Notes: Absorbable oxidized regenerated cellulose hemostatic material.
Links: Product reference | https://www.jnjmedtech.com/en-US/product', N'Sterile or single-use surgical supply. Verify package integrity, size, lot and expiration before use; do not reuse products labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sof-Lex Extra-Thin Discs – Coarse', N'Finishing & Polishing', N'Bright Smile Dental', N'Sof-Lex Extra-Thin Contouring and Polishing Disc, Coarse', N'Manufacturer: Solventum (3M)
Model: Sof-Lex Extra-Thin Contouring and Polishing Disc, Coarse
Notes: Composite finishing and contouring disc.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/finishing-polishing/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sof-Lex Extra-Thin Discs – Medium', N'Finishing & Polishing', N'Bright Smile Dental', N'Sof-Lex Extra-Thin Contouring and Polishing Disc, Medium', N'Manufacturer: Solventum (3M)
Model: Sof-Lex Extra-Thin Contouring and Polishing Disc, Medium
Notes: Composite finishing disc.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/finishing-polishing/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sof-Lex Extra-Thin Discs – Fine', N'Finishing & Polishing', N'Bright Smile Dental', N'Sof-Lex Extra-Thin Contouring and Polishing Disc, Fine', N'Manufacturer: Solventum (3M)
Model: Sof-Lex Extra-Thin Contouring and Polishing Disc, Fine
Notes: Composite polishing disc.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/finishing-polishing/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sof-Lex Extra-Thin Discs – Superfine', N'Finishing & Polishing', N'Bright Smile Dental', N'Sof-Lex Extra-Thin Contouring and Polishing Disc, Superfine', N'Manufacturer: Solventum (3M)
Model: Sof-Lex Extra-Thin Contouring and Polishing Disc, Superfine
Notes: Composite high-polish disc.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/finishing-polishing/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Sof-Lex Diamond Polishing Spirals', N'Finishing & Polishing', N'Bright Smile Dental', N'Sof-Lex Diamond Polishing System', N'Manufacturer: Solventum (3M)
Model: Sof-Lex Diamond Polishing System
Notes: Two-step pre-polishing and diamond polishing spirals.
Links: Product reference | https://www.solventum.com/en-us/home/oral-care/dental-solutions/direct-procedure/finishing-polishing/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Enhance Finishing Discs', N'Finishing & Polishing', N'Bright Smile Dental', N'Enhance Finishing System', N'Manufacturer: Dentsply Sirona
Model: Enhance Finishing System
Notes: One-step composite finishing system.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Enhance PoGo Polishing Cups', N'Finishing & Polishing', N'Bright Smile Dental', N'PoGo One-Step Diamond Micro-Polisher Cups', N'Manufacturer: Dentsply Sirona
Model: PoGo One-Step Diamond Micro-Polisher Cups
Notes: Diamond-impregnated composite polishing cups.
Links: Product reference | https://www.dentsplysirona.com/en/explore/restorative.html', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'OptiDisc Assorted Kit', N'Finishing & Polishing', N'Bright Smile Dental', N'OptiDisc Finishing and Polishing Discs, Assorted', N'Manufacturer: Kerr
Model: OptiDisc Finishing and Polishing Discs, Assorted
Notes: Composite finishing and polishing discs.
Links: Product reference | https://www.kerrdental.com/en-us/products/finishing/optidisc', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Jiffy Composite Polishing Cups', N'Finishing & Polishing', N'Bright Smile Dental', N'Jiffy Universal Composite Polishing Cups', N'Manufacturer: Ultradent
Model: Jiffy Universal Composite Polishing Cups
Notes: Composite polishing cups.
Links: Product reference | https://www.ultradent.com/resources/catalog', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'CaviWipes 2.0', N'Infection Control & PPE', N'Bright Smile Dental', N'CaviWipes 2.0 Surface Disinfectant Wipes', N'Manufacturer: Kerr / Metrex
Model: CaviWipes 2.0 Surface Disinfectant Wipes
Notes: EPA-registered surface disinfectant wipes.
Links: Product reference | https://www.kerrdental.com/en-us/products/infection-prevention', N'Follow the product label, SDS and required contact time. Do not mix chemicals. Use appropriate PPE and store away from incompatible materials.', NULL, NULL, N'Dental'),
    (N'CaviCide 1', N'Infection Control & PPE', N'Bright Smile Dental', N'CaviCide 1 Surface Disinfectant, 1 Gallon', N'Manufacturer: Kerr / Metrex
Model: CaviCide 1 Surface Disinfectant, 1 Gallon
Notes: Ready-to-use surface disinfectant.
Links: Product reference | https://www.kerrdental.com/en-us/products/infection-prevention', N'Follow the product label, SDS and required contact time. Do not mix chemicals. Use appropriate PPE and store away from incompatible materials.', NULL, NULL, N'Dental'),
    (N'Sani-Cloth AF3 Wipes', N'Infection Control & PPE', N'Bright Smile Dental', N'Sani-Cloth AF3 Germicidal Disposable Wipes', N'Manufacturer: PDI
Model: Sani-Cloth AF3 Germicidal Disposable Wipes
Notes: Alcohol-free surface disinfectant wipes.
Links: Product reference | https://pdihc.com/products/environment-of-care/', N'Follow the product label, SDS and required contact time. Do not mix chemicals. Use appropriate PPE and store away from incompatible materials.', NULL, NULL, N'Dental'),
    (N'Sani-Cloth Prime Wipes', N'Infection Control & PPE', N'Bright Smile Dental', N'Sani-Cloth Prime Germicidal Disposable Wipes', N'Manufacturer: PDI
Model: Sani-Cloth Prime Germicidal Disposable Wipes
Notes: Broad-spectrum surface disinfectant wipes.
Links: Product reference | https://pdihc.com/products/environment-of-care/', N'Follow the product label, SDS and required contact time. Do not mix chemicals. Use appropriate PPE and store away from incompatible materials.', NULL, NULL, N'Dental'),
    (N'PureLife Nitrile Gloves – Small', N'Infection Control & PPE', N'Bright Smile Dental', N'Nitrile Exam Gloves, Small', N'Manufacturer: PureLife
Model: Nitrile Exam Gloves, Small
Notes: Powder-free nitrile examination gloves.
Links: Product reference | https://www.purelifedental.com/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'PureLife Nitrile Gloves – Medium', N'Infection Control & PPE', N'Bright Smile Dental', N'Nitrile Exam Gloves, Medium', N'Manufacturer: PureLife
Model: Nitrile Exam Gloves, Medium
Notes: Powder-free nitrile examination gloves.
Links: Product reference | https://www.purelifedental.com/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'PureLife Nitrile Gloves – Large', N'Infection Control & PPE', N'Bright Smile Dental', N'Nitrile Exam Gloves, Large', N'Manufacturer: PureLife
Model: Nitrile Exam Gloves, Large
Notes: Powder-free nitrile examination gloves.
Links: Product reference | https://www.purelifedental.com/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'Level 3 Procedure Masks', N'Infection Control & PPE', N'Bright Smile Dental', N'SafeMask Architect Pro Level 3 Earloop Mask', N'Manufacturer: Medicom
Model: SafeMask Architect Pro Level 3 Earloop Mask
Notes: ASTM Level 3 disposable procedure mask.
Links: Product reference | https://www.medicom.com/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'N95 Respirator – Small', N'Infection Control & PPE', N'Bright Smile Dental', N'Aura Particulate Respirator 1870+, Small/Standard', N'Manufacturer: 3M
Model: Aura Particulate Respirator 1870+, Small/Standard
Notes: Disposable healthcare particulate respirator.
Links: Product reference | https://www.3m.com/3M/en_US/p/d/v000154274/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'N95 Respirator – Regular', N'Infection Control & PPE', N'Bright Smile Dental', N'Aura Particulate Respirator 1870+', N'Manufacturer: 3M
Model: Aura Particulate Respirator 1870+
Notes: Disposable healthcare particulate respirator.
Links: Product reference | https://www.3m.com/3M/en_US/p/d/v000154274/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'Disposable Isolation Gown', N'Infection Control & PPE', N'Bright Smile Dental', N'Thumb-Loop Disposable Isolation Gown', N'Manufacturer: Medline
Model: Thumb-Loop Disposable Isolation Gown
Notes: Single-use fluid-resistant isolation gown.
Links: Product reference | https://www.medicom.com/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'Face Shield', N'Infection Control & PPE', N'Bright Smile Dental', N'Ultra Light Face Shield with Disposable Visors', N'Manufacturer: Crosstex
Model: Ultra Light Face Shield with Disposable Visors
Notes: Reusable frame with disposable face-shield visor.
Links: Product reference | https://www.medicom.com/', N'Single-use protective supply. Select the correct size and protection level; replace if damaged, contaminated, wet or compromised.', NULL, NULL, N'Dental'),
    (N'Cotton Rolls – Medium', N'General Clinical Disposables', N'Bright Smile Dental', N'Reflective Cotton Rolls, Medium', N'Manufacturer: Richmond Dental & Medical
Model: Reflective Cotton Rolls, Medium
Notes: Absorbent cotton rolls for isolation.
Links: Product reference | https://richmonddental.net/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Cotton Rolls – Large', N'General Clinical Disposables', N'Bright Smile Dental', N'Reflective Cotton Rolls, Large', N'Manufacturer: Richmond Dental & Medical
Model: Reflective Cotton Rolls, Large
Notes: Absorbent cotton rolls for isolation.
Links: Product reference | https://richmonddental.net/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'2x2 Non-Woven Gauze', N'General Clinical Disposables', N'Bright Smile Dental', N'Non-Woven Sponges, 2 x 2 in, 4-Ply', N'Manufacturer: Crosstex
Model: Non-Woven Sponges, 2 x 2 in, 4-Ply
Notes: Nonsterile absorbent gauze sponges.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'4x4 Sterile Gauze', N'General Clinical Disposables', N'Bright Smile Dental', N'Sterile Woven Gauze Sponges, 4 x 4 in', N'Manufacturer: Crosstex
Model: Sterile Woven Gauze Sponges, 4 x 4 in
Notes: Sterile surgical gauze.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Saliva Ejectors – Clear', N'General Clinical Disposables', N'Bright Smile Dental', N'Comfort Plus Saliva Ejectors, Clear', N'Manufacturer: Crosstex
Model: Comfort Plus Saliva Ejectors, Clear
Notes: Single-use saliva ejector.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'HVE Tips – White', N'General Clinical Disposables', N'Bright Smile Dental', N'Comfort Plus HVE Tips, White', N'Manufacturer: Crosstex
Model: Comfort Plus HVE Tips, White
Notes: Single-use high-volume evacuation tip.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Air/Water Syringe Tips', N'General Clinical Disposables', N'Bright Smile Dental', N'Safe-Flo Disposable Air/Water Syringe Tips', N'Manufacturer: Crosstex
Model: Safe-Flo Disposable Air/Water Syringe Tips
Notes: Single-use air/water syringe tip.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Microbrush Applicators – Regular', N'General Clinical Disposables', N'Bright Smile Dental', N'Microbrush Plus Applicators, Regular', N'Manufacturer: Microbrush International
Model: Microbrush Plus Applicators, Regular
Notes: Disposable material applicators.
Links: Product reference | https://www.microbrush.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Microbrush Applicators – Fine', N'General Clinical Disposables', N'Bright Smile Dental', N'Microbrush Plus Applicators, Fine', N'Manufacturer: Microbrush International
Model: Microbrush Plus Applicators, Fine
Notes: Disposable fine applicators.
Links: Product reference | https://www.microbrush.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Disposable Prophy Angles – Soft Cup', N'General Clinical Disposables', N'Bright Smile Dental', N'Young Classic Disposable Prophy Angle, Soft Cup', N'Manufacturer: Young Dental
Model: Young Classic Disposable Prophy Angle, Soft Cup
Notes: Single-use prophy angle.
Links: Product reference | https://www.youngdental.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Prophy Cups – Soft', N'General Clinical Disposables', N'Bright Smile Dental', N'Turbo Plus Prophy Cup, Soft', N'Manufacturer: Young Dental
Model: Turbo Plus Prophy Cup, Soft
Notes: Disposable prophy cup.
Links: Product reference | https://www.youngdental.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Bite Blocks – Adult', N'General Clinical Disposables', N'Bright Smile Dental', N'Disposable Bite Blocks, Adult', N'Manufacturer: Crosstex
Model: Disposable Bite Blocks, Adult
Notes: Single-use patient bite block.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Bite Blocks – Pediatric', N'General Clinical Disposables', N'Bright Smile Dental', N'Disposable Bite Blocks, Pediatric', N'Manufacturer: Crosstex
Model: Disposable Bite Blocks, Pediatric
Notes: Single-use pediatric bite block.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Plastic Barrier Film – Blue', N'General Clinical Disposables', N'Bright Smile Dental', N'Barrier Film, Blue, Perforated', N'Manufacturer: Crosstex
Model: Barrier Film, Blue, Perforated
Notes: Disposable surface barrier film.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Chair Sleeves', N'General Clinical Disposables', N'Bright Smile Dental', N'Disposable Dental Chair Sleeves', N'Manufacturer: Crosstex
Model: Disposable Dental Chair Sleeves
Notes: Single-use chair barrier.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'X-Ray Sensor Sleeves – Size 2', N'General Clinical Disposables', N'Bright Smile Dental', N'Digital Sensor Sleeves, Size 2', N'Manufacturer: Crosstex
Model: Digital Sensor Sleeves, Size 2
Notes: Single-use intraoral sensor barrier.
Links: Product reference | https://www.crosstex.com/', N'Single-use dental supply. Verify packaging and expiration where applicable; do not reuse items labeled single-use.', NULL, NULL, N'Dental'),
    (N'Opalescence Boost 40%', N'Whitening Materials', N'Bright Smile Dental', N'Opalescence Boost 40% In-Office Whitening', N'Manufacturer: Ultradent
Model: Opalescence Boost 40% In-Office Whitening
Notes: Chemically activated in-office whitening gel.
Links: Product reference | https://devglobal.ultradent.com/products/categories/whitening/complete-opalescence-teeth-whitening-system', N'Professional whitening material. Protect soft tissues, follow concentration-specific IFU, screen for contraindications and verify expiration before use.', NULL, NULL, N'Dental'),
    (N'Opalescence PF 10% – Mint', N'Whitening Materials', N'Bright Smile Dental', N'Opalescence PF 10% Carbamide Peroxide, Mint', N'Manufacturer: Ultradent
Model: Opalescence PF 10% Carbamide Peroxide, Mint
Notes: Take-home whitening gel.
Links: Product reference | https://devglobal.ultradent.com/products/categories/whitening/complete-opalescence-teeth-whitening-system', N'Professional whitening material. Protect soft tissues, follow concentration-specific IFU, screen for contraindications and verify expiration before use.', NULL, NULL, N'Dental'),
    (N'Opalescence PF 15% – Mint', N'Whitening Materials', N'Bright Smile Dental', N'Opalescence PF 15% Carbamide Peroxide, Mint', N'Manufacturer: Ultradent
Model: Opalescence PF 15% Carbamide Peroxide, Mint
Notes: Take-home whitening gel.
Links: Product reference | https://devglobal.ultradent.com/products/categories/whitening/complete-opalescence-teeth-whitening-system', N'Professional whitening material. Protect soft tissues, follow concentration-specific IFU, screen for contraindications and verify expiration before use.', NULL, NULL, N'Dental'),
    (N'Opalescence Go 10% – Mint', N'Whitening Materials', N'Bright Smile Dental', N'Opalescence Go 10% Prefilled Whitening Trays, Mint', N'Manufacturer: Ultradent
Model: Opalescence Go 10% Prefilled Whitening Trays, Mint
Notes: Prefilled take-home whitening trays.
Links: Product reference | https://devglobal.ultradent.com/products/categories/whitening/complete-opalescence-teeth-whitening-system', N'Professional whitening material. Protect soft tissues, follow concentration-specific IFU, screen for contraindications and verify expiration before use.', NULL, NULL, N'Dental'),
    (N'OpalDam Green', N'Whitening Materials', N'Bright Smile Dental', N'OpalDam Green Light-Cured Resin Barrier', N'Manufacturer: Ultradent
Model: OpalDam Green Light-Cured Resin Barrier
Notes: Soft-tissue protection barrier for in-office whitening.
Links: Product reference | https://devglobal.ultradent.com/products/categories/whitening/complete-opalescence-teeth-whitening-system', N'Professional whitening material. Protect soft tissues, follow concentration-specific IFU, screen for contraindications and verify expiration before use.', NULL, NULL, N'Dental'),
    (N'UltraEZ Desensitizing Gel', N'Whitening Materials', N'Bright Smile Dental', N'UltraEZ 3% Potassium Nitrate / Fluoride Desensitizing Gel', N'Manufacturer: Ultradent
Model: UltraEZ 3% Potassium Nitrate / Fluoride Desensitizing Gel
Notes: Desensitizing gel for bleaching-related sensitivity.
Links: Product reference | https://devglobal.ultradent.com/products/categories/whitening/complete-opalescence-teeth-whitening-system', N'Professional whitening material. Protect soft tissues, follow concentration-specific IFU, screen for contraindications and verify expiration before use.', NULL, NULL, N'Dental'),
    (N'Copy Paper – Letter', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Premium Multi-Purpose Paper, 8.5 x 11 in, 24 lb, 97 Bright', N'Manufacturer: Hammermill
Model: Premium Multi-Purpose Paper, 8.5 x 11 in, 24 lb, 97 Bright
Notes: General office printing and copying.
Links: Product reference | https://www.hammermill.com/papers/premium-multipurpose/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Copy Paper – Letter Economy', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Copy Plus Paper, 8.5 x 11 in, 20 lb, 92 Bright', N'Manufacturer: Hammermill
Model: Copy Plus Paper, 8.5 x 11 in, 20 lb, 92 Bright
Notes: Routine internal printing and copying.
Links: Product reference | https://www.hammermill.com/papers/copy-plus/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Copy Paper – Legal', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Fore MP Paper, 8.5 x 14 in, 20 lb', N'Manufacturer: Hammermill
Model: Fore MP Paper, 8.5 x 14 in, 20 lb
Notes: Legal-size documents and contracts.
Links: Product reference | https://www.hammermill.com/papers/fore-multipurpose/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Premium Laser Paper', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'HP Premium32 Laser Paper, 8.5 x 11 in, 32 lb', N'Manufacturer: HP
Model: HP Premium32 Laser Paper, 8.5 x 11 in, 32 lb
Notes: High-quality color and presentation printing.
Links: Product reference | https://www.hp.com/us-en/shop/cat/ink--toner---paper', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Pastel Blue Copy Paper', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Colors Paper, 8.5 x 11 in, 20 lb, Blue', N'Manufacturer: Hammermill
Model: Colors Paper, 8.5 x 11 in, 20 lb, Blue
Notes: Color-coded administrative documents.
Links: Product reference | https://www.hammermill.com/papers/colors/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Pastel Green Copy Paper', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Colors Paper, 8.5 x 11 in, 20 lb, Green', N'Manufacturer: Hammermill
Model: Colors Paper, 8.5 x 11 in, 20 lb, Green
Notes: Color-coded administrative documents.
Links: Product reference | https://www.hammermill.com/papers/colors/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Pastel Yellow Copy Paper', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Colors Paper, 8.5 x 11 in, 20 lb, Canary', N'Manufacturer: Hammermill
Model: Colors Paper, 8.5 x 11 in, 20 lb, Canary
Notes: Color-coded administrative documents.
Links: Product reference | https://www.hammermill.com/papers/colors/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'White Cardstock', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Premium Color Copy Cover, 8.5 x 11 in, 80 lb', N'Manufacturer: Hammermill
Model: Premium Color Copy Cover, 8.5 x 11 in, 80 lb
Notes: Signs, covers, notices and durable printed materials.
Links: Product reference | https://www.hammermill.com/papers/premium-color-copy-cover/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Glossy Presentation Paper', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'HP Professional Business Paper, Glossy, Letter', N'Manufacturer: HP
Model: HP Professional Business Paper, Glossy, Letter
Notes: Brochures, flyers and presentation handouts.
Links: Product reference | https://www.hp.com/us-en/shop/cat/ink--toner---paper', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Three-Hole-Punched Copy Paper', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Tidal MP Paper, 8.5 x 11 in, 20 lb, 3-Hole Punch', N'Manufacturer: Hammermill
Model: Tidal MP Paper, 8.5 x 11 in, 20 lb, 3-Hole Punch
Notes: Documents intended for immediate binder filing.
Links: Product reference | https://www.hammermill.com/papers/tidal/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Laminating Pouches – Letter', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Thermal Laminating Pouches TP5854-100, 8.9 x 11.4 in, 3 mil', N'Manufacturer: Scotch / 3M
Model: Thermal Laminating Pouches TP5854-100, 8.9 x 11.4 in, 3 mil
Notes: Protects posted instructions, checklists and signs.
Links: Product reference | https://www.3m.com/3M/en_US/p/c/office-supplies/laminating-products/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Laminating Pouches – Legal', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Thermal Laminating Pouches, Legal Size, 3 mil', N'Manufacturer: Scotch / 3M
Model: Thermal Laminating Pouches, Legal Size, 3 mil
Notes: Protects legal-size notices and reference sheets.
Links: Product reference | https://www.3m.com/3M/en_US/p/c/office-supplies/laminating-products/', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'Clear Report Covers', N'Paper, Printing & Presentation', N'Bright Smile Dental', N'Clear Front Report Covers with Sliding Bar', N'Manufacturer: Avery
Model: Clear Front Report Covers with Sliding Bar
Notes: Professional presentation and temporary document binding.
Links: Product reference | https://www.avery.com/products/binders', N'Store flat in a clean, dry area. Keep sealed until needed and verify printer compatibility before use.', NULL, NULL, N'Office'),
    (N'HP 148A Black Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 148A Black Original LaserJet Toner Cartridge, W1480A', N'Manufacturer: HP
Model: HP 148A Black Original LaserJet Toner Cartridge, W1480A
Notes: Standard-yield toner for HP LaserJet Pro MFP 4101fdw.
Links: Product reference | https://www.hp.com/us-en/shop/pdp/hp-148a-black-original-laserjet-toner-cartridge', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 148X High-Yield Black Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 148X High Yield Black Original LaserJet Toner Cartridge, W1480X', N'Manufacturer: HP
Model: HP 148X High Yield Black Original LaserJet Toner Cartridge, W1480X
Notes: High-yield toner for HP LaserJet Pro MFP 4101fdw.
Links: Product reference | https://www.hp.com/us-en/shop/cat/ink--toner---paper', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210A Black Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210A Black Original LaserJet Toner Cartridge, W2100A', N'Manufacturer: HP
Model: HP 210A Black Original LaserJet Toner Cartridge, W2100A
Notes: Standard-yield black toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210A Cyan Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210A Cyan Original LaserJet Toner Cartridge, W2101A', N'Manufacturer: HP
Model: HP 210A Cyan Original LaserJet Toner Cartridge, W2101A
Notes: Standard-yield cyan toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210A Yellow Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210A Yellow Original LaserJet Toner Cartridge, W2102A', N'Manufacturer: HP
Model: HP 210A Yellow Original LaserJet Toner Cartridge, W2102A
Notes: Standard-yield yellow toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210A Magenta Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210A Magenta Original LaserJet Toner Cartridge, W2103A', N'Manufacturer: HP
Model: HP 210A Magenta Original LaserJet Toner Cartridge, W2103A
Notes: Standard-yield magenta toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210X High-Yield Black Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210X High Yield Black Original LaserJet Toner Cartridge, W2100X', N'Manufacturer: HP
Model: HP 210X High Yield Black Original LaserJet Toner Cartridge, W2100X
Notes: High-yield black toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210X High-Yield Cyan Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210X High Yield Cyan Original LaserJet Toner Cartridge, W2101X', N'Manufacturer: HP
Model: HP 210X High Yield Cyan Original LaserJet Toner Cartridge, W2101X
Notes: High-yield cyan toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210X High-Yield Yellow Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210X High Yield Yellow Original LaserJet Toner Cartridge, W2102X', N'Manufacturer: HP
Model: HP 210X High Yield Yellow Original LaserJet Toner Cartridge, W2102X
Notes: High-yield yellow toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'HP 210X High-Yield Magenta Toner', N'Printer Toner & Imaging Supplies', N'Bright Smile Dental', N'HP 210X High Yield Magenta Original LaserJet Toner Cartridge, W2103X', N'Manufacturer: HP
Model: HP 210X High Yield Magenta Original LaserJet Toner Cartridge, W2103X
Notes: High-yield magenta toner for HP Color LaserJet Pro MFP 4301fdw.
Links: Product reference | https://www.hp.com/us-en/shop/dlp/printer-toner', N'Use only in the compatible printer model. Do not touch the imaging surface, avoid inhaling loose toner and recycle spent cartridges through an approved program.', NULL, NULL, N'Office'),
    (N'Brother Standard Address Labels', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-1201 Die-Cut Standard Address Labels, 1.14 x 3.5 in, 400 Labels', N'Manufacturer: Brother
Model: DK-1201 Die-Cut Standard Address Labels, 1.14 x 3.5 in, 400 Labels
Notes: Address labels for the Brother QL-820NWB.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls/DK1201', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Brother Shipping Labels', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-1202 Die-Cut Shipping Labels, 2.4 x 3.9 in, 300 Labels', N'Manufacturer: Brother
Model: DK-1202 Die-Cut Shipping Labels, 2.4 x 3.9 in, 300 Labels
Notes: Shipping and large-address labels for the Brother QL-820NWB.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls/DK1202', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Brother File Folder Labels', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-1203 Die-Cut File Folder Labels, 0.66 x 3.4 in, 300 Labels', N'Manufacturer: Brother
Model: DK-1203 Die-Cut File Folder Labels, 0.66 x 3.4 in, 300 Labels
Notes: File-folder labels for the Brother QL-820NWB.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Brother Multi-Purpose Labels', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-1204 Die-Cut Multi-Purpose Labels, 0.66 x 2.1 in, 400 Labels', N'Manufacturer: Brother
Model: DK-1204 Die-Cut Multi-Purpose Labels, 0.66 x 2.1 in, 400 Labels
Notes: Small multipurpose labels for files and storage.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Brother Large Shipping Labels', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-1241 Die-Cut Large Shipping Labels, 4 x 6 in, 200 Labels', N'Manufacturer: Brother
Model: DK-1241 Die-Cut Large Shipping Labels, 4 x 6 in, 200 Labels
Notes: 4 x 6 shipping labels for the Brother QL-820NWB.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Brother Continuous Paper Tape', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-2205 Continuous Length Paper Tape, 2.4 in Wide', N'Manufacturer: Brother
Model: DK-2205 Continuous Length Paper Tape, 2.4 in Wide
Notes: Custom-length labels and signage.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Brother Black/Red Continuous Tape', N'Printer Labels & Label Rolls', N'Bright Smile Dental', N'DK-2251 Continuous Length Black/Red on White Paper Tape, 2.4 in Wide', N'Manufacturer: Brother
Model: DK-2251 Continuous Length Black/Red on White Paper Tape, 2.4 in Wide
Notes: Two-color labels for the Brother QL-820NWB.
Links: Product reference | https://www.brother-usa.com/p/label-printer-rolls', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Pilot G2 Gel Pens – Black', N'Writing & Marking', N'Bright Smile Dental', N'G2 Premium Gel Roller Pen, 0.7 mm, Black', N'Manufacturer: Pilot
Model: G2 Premium Gel Roller Pen, 0.7 mm, Black
Notes: Retractable gel pen for routine office writing and signatures.
Links: Product reference | https://pilotpen.us/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Pilot G2 Gel Pens – Blue', N'Writing & Marking', N'Bright Smile Dental', N'G2 Premium Gel Roller Pen, 0.7 mm, Blue', N'Manufacturer: Pilot
Model: G2 Premium Gel Roller Pen, 0.7 mm, Blue
Notes: Retractable gel pen for routine office writing and signatures.
Links: Product reference | https://pilotpen.us/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Pilot G2 Gel Pens – Red', N'Writing & Marking', N'Bright Smile Dental', N'G2 Premium Gel Roller Pen, 0.7 mm, Red', N'Manufacturer: Pilot
Model: G2 Premium Gel Roller Pen, 0.7 mm, Red
Notes: Retractable gel pen for routine office writing and signatures.
Links: Product reference | https://pilotpen.us/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Paper Mate InkJoy Ballpoint Pens – Black', N'Writing & Marking', N'Bright Smile Dental', N'InkJoy 100RT Retractable Ballpoint Pen, 1.0 mm, Black', N'Manufacturer: Paper Mate
Model: InkJoy 100RT Retractable Ballpoint Pen, 1.0 mm, Black
Notes: Economical retractable ballpoint pen.
Links: Product reference | https://www.papermate.com/pens/ballpoint-pens/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Paper Mate InkJoy Ballpoint Pens – Blue', N'Writing & Marking', N'Bright Smile Dental', N'InkJoy 100RT Retractable Ballpoint Pen, 1.0 mm, Blue', N'Manufacturer: Paper Mate
Model: InkJoy 100RT Retractable Ballpoint Pen, 1.0 mm, Blue
Notes: Economical retractable ballpoint pen.
Links: Product reference | https://www.papermate.com/pens/ballpoint-pens/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Paper Mate InkJoy Ballpoint Pens – Red', N'Writing & Marking', N'Bright Smile Dental', N'InkJoy 100RT Retractable Ballpoint Pen, 1.0 mm, Red', N'Manufacturer: Paper Mate
Model: InkJoy 100RT Retractable Ballpoint Pen, 1.0 mm, Red
Notes: Economical retractable ballpoint pen.
Links: Product reference | https://www.papermate.com/pens/ballpoint-pens/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Permanent Marker – Black Fine', N'Writing & Marking', N'Bright Smile Dental', N'Permanent Marker, Fine Point, Black', N'Manufacturer: Sharpie
Model: Permanent Marker, Fine Point, Black
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Permanent Marker – Black Ultra Fine', N'Writing & Marking', N'Bright Smile Dental', N'Permanent Marker, Ultra Fine Point, Black', N'Manufacturer: Sharpie
Model: Permanent Marker, Ultra Fine Point, Black
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Permanent Marker – Red Fine', N'Writing & Marking', N'Bright Smile Dental', N'Permanent Marker, Fine Point, Red', N'Manufacturer: Sharpie
Model: Permanent Marker, Fine Point, Red
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Chisel Tip Marker – Black', N'Writing & Marking', N'Bright Smile Dental', N'Permanent Marker, Chisel Tip, Black', N'Manufacturer: Sharpie
Model: Permanent Marker, Chisel Tip, Black
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Highlighter – Yellow', N'Writing & Marking', N'Bright Smile Dental', N'Tank Highlighter, Chisel Tip, Yellow', N'Manufacturer: Sharpie
Model: Tank Highlighter, Chisel Tip, Yellow
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Highlighter – Pink', N'Writing & Marking', N'Bright Smile Dental', N'Tank Highlighter, Chisel Tip, Pink', N'Manufacturer: Sharpie
Model: Tank Highlighter, Chisel Tip, Pink
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Sharpie Highlighter – Green', N'Writing & Marking', N'Bright Smile Dental', N'Tank Highlighter, Chisel Tip, Green', N'Manufacturer: Sharpie
Model: Tank Highlighter, Chisel Tip, Green
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.sharpie.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'EXPO Dry-Erase Marker – Black', N'Writing & Marking', N'Bright Smile Dental', N'Low-Odor Dry-Erase Marker, Chisel Tip, Black', N'Manufacturer: EXPO
Model: Low-Odor Dry-Erase Marker, Chisel Tip, Black
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.expomarkers.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'EXPO Dry-Erase Marker – Blue', N'Writing & Marking', N'Bright Smile Dental', N'Low-Odor Dry-Erase Marker, Chisel Tip, Blue', N'Manufacturer: EXPO
Model: Low-Odor Dry-Erase Marker, Chisel Tip, Blue
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.expomarkers.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'EXPO Dry-Erase Marker – Red', N'Writing & Marking', N'Bright Smile Dental', N'Low-Odor Dry-Erase Marker, Chisel Tip, Red', N'Manufacturer: EXPO
Model: Low-Odor Dry-Erase Marker, Chisel Tip, Red
Notes: Marker for labeling, highlighting or whiteboard communication.
Links: Product reference | https://www.expomarkers.com/', N'Keep capped or retracted when not in use. Permanent ink may stain surfaces and clothing.', NULL, NULL, N'Office'),
    (N'Mechanical Pencils – 0.5 mm', N'Writing & Marking', N'Bright Smile Dental', N'Sharp Mechanical Drafting Pencil, P205, 0.5 mm', N'Manufacturer: Pentel
Model: Sharp Mechanical Drafting Pencil, P205, 0.5 mm
Notes: Reusable mechanical pencil.
Links: Product reference | https://www.pentel.com/products/sharp-mechanical-drafting-pencil', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Mechanical Pencil Lead – 0.5 mm HB', N'Writing & Marking', N'Bright Smile Dental', N'Super Hi-Polymer Lead, 0.5 mm HB', N'Manufacturer: Pentel
Model: Super Hi-Polymer Lead, 0.5 mm HB
Notes: Replacement lead for 0.5 mm mechanical pencils.
Links: Product reference | https://www.pentel.com/collections/lead-refills', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Wood Pencils – #2', N'Writing & Marking', N'Bright Smile Dental', N'Ticonderoga #2 Soft Yellow Pencil', N'Manufacturer: Dixon Ticonderoga
Model: Ticonderoga #2 Soft Yellow Pencil
Notes: Standard sharpenable office pencil.
Links: Product reference | https://dixonticonderoga.com/ticonderoga-pencils/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'White Vinyl Erasers', N'Writing & Marking', N'Bright Smile Dental', N'Hi-Polymer Block Eraser, White', N'Manufacturer: Pentel
Model: Hi-Polymer Block Eraser, White
Notes: Clean-erasing vinyl eraser.
Links: Product reference | https://www.pentel.com/collections/erasers', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Correction Tape', N'Writing & Marking', N'Bright Smile Dental', N'MONO Correction Tape, 4.2 mm', N'Manufacturer: Tombow
Model: MONO Correction Tape, 4.2 mm
Notes: Dry correction tape for printed and handwritten documents.
Links: Product reference | https://www.tombowusa.com/mono-correction-tape.html', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Post-it Notes – Yellow 3 x 3', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Post-it Notes 654, 3 x 3 in, Canary Yellow', N'Manufacturer: Post-it / 3M
Model: Post-it Notes 654, 3 x 3 in, Canary Yellow
Notes: General reminders and temporary notes.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Post-it Super Sticky Notes – Assorted 3 x 3', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Post-it Super Sticky Notes 654-5SS, 3 x 3 in, Assorted', N'Manufacturer: Post-it / 3M
Model: Post-it Super Sticky Notes 654-5SS, 3 x 3 in, Assorted
Notes: High-adhesion temporary notes.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Post-it Lined Notes – 4 x 6', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Post-it Super Sticky Lined Notes, 4 x 6 in', N'Manufacturer: Post-it / 3M
Model: Post-it Super Sticky Lined Notes, 4 x 6 in
Notes: Longer notes and task lists.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Post-it Flags – Assorted', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Post-it Flags 680-5, 0.47 x 1.7 in, Assorted', N'Manufacturer: Post-it / 3M
Model: Post-it Flags 680-5, 0.47 x 1.7 in, Assorted
Notes: Document indexing and signature-location markers.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Post-it Message Flags – Sign Here', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Post-it Message Flags, Sign Here', N'Manufacturer: Post-it / 3M
Model: Post-it Message Flags, Sign Here
Notes: Flags signature locations in documents.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Post-it Tabs – 1 in Assorted', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Post-it Tabs, 1 in, Assorted Colors', N'Manufacturer: Post-it / 3M
Model: Post-it Tabs, 1 in, Assorted Colors
Notes: Durable document and binder tabs.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Scotch Magic Tape', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Scotch Magic Tape 810, 0.75 in x 1000 in', N'Manufacturer: Scotch / 3M
Model: Scotch Magic Tape 810, 0.75 in x 1000 in
Notes: General office tape.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Scotch Double-Sided Tape', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Scotch Double-Sided Tape 665, 0.5 in', N'Manufacturer: Scotch / 3M
Model: Scotch Double-Sided Tape 665, 0.5 in
Notes: Double-sided mounting and paper assembly.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Scotch Heavy Duty Packaging Tape', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Scotch Heavy Duty Shipping Packaging Tape 3750', N'Manufacturer: Scotch / 3M
Model: Scotch Heavy Duty Shipping Packaging Tape 3750
Notes: Sealing shipping cartons.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Scotch Glue Stick', N'Notes, Tape & Adhesives', N'Bright Smile Dental', N'Scotch Permanent Glue Stick 6008', N'Manufacturer: Scotch / 3M
Model: Scotch Permanent Glue Stick 6008
Notes: Paper and lightweight office projects.
Links: Product reference | https://www.3m.com/3M/en_US/office-us/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'View Binder – 0.5 in White', N'Filing & Organization', N'Bright Smile Dental', N'Durable View Binder, 0.5 in, White', N'Manufacturer: Avery
Model: Durable View Binder, 0.5 in, White
Notes: Small policy or training binder.
Links: Product reference | https://www.avery.com/products/binders', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'View Binder – 1 in White', N'Filing & Organization', N'Bright Smile Dental', N'Durable View Binder, 1 in, White', N'Manufacturer: Avery
Model: Durable View Binder, 1 in, White
Notes: General administrative binder.
Links: Product reference | https://www.avery.com/products/binders', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'View Binder – 1.5 in White', N'Filing & Organization', N'Bright Smile Dental', N'Durable View Binder, 1.5 in, White', N'Manufacturer: Avery
Model: Durable View Binder, 1.5 in, White
Notes: Administrative and compliance binder.
Links: Product reference | https://www.avery.com/products/binders', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'View Binder – 2 in White', N'Filing & Organization', N'Bright Smile Dental', N'Durable View Binder, 2 in, White', N'Manufacturer: Avery
Model: Durable View Binder, 2 in, White
Notes: Large policy or records binder.
Links: Product reference | https://www.avery.com/products/binders', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'View Binder – 3 in White', N'Filing & Organization', N'Bright Smile Dental', N'Durable View Binder, 3 in, White', N'Manufacturer: Avery
Model: Durable View Binder, 3 in, White
Notes: High-capacity records binder.
Links: Product reference | https://www.avery.com/products/binders', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Big Tab Dividers – 5 Tab', N'Filing & Organization', N'Bright Smile Dental', N'Big Tab Insertable Dividers, 5 Tabs, 11109', N'Manufacturer: Avery
Model: Big Tab Insertable Dividers, 5 Tabs, 11109
Notes: Five-section binder dividers.
Links: Product reference | https://www.avery.com/products/dividers', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Big Tab Dividers – 8 Tab', N'Filing & Organization', N'Bright Smile Dental', N'Big Tab Insertable Dividers, 8 Tabs, 11111', N'Manufacturer: Avery
Model: Big Tab Insertable Dividers, 8 Tabs, 11111
Notes: Eight-section binder dividers.
Links: Product reference | https://www.avery.com/products/dividers', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Print & Apply Dividers – 8 Tab', N'Filing & Organization', N'Bright Smile Dental', N'Index Maker Easy Apply Dividers, 8 Tabs, 11424', N'Manufacturer: Avery
Model: Index Maker Easy Apply Dividers, 8 Tabs, 11424
Notes: Printable tab dividers.
Links: Product reference | https://www.avery.com/products/dividers', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Print & Apply Dividers – 5 Tab', N'Filing & Organization', N'Bright Smile Dental', N'Index Maker Easy Apply Dividers, 5 Tabs, 11556', N'Manufacturer: Avery
Model: Index Maker Easy Apply Dividers, 5 Tabs, 11556
Notes: Printable tab dividers.
Links: Product reference | https://www.avery.com/products/dividers', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Manila File Folders – Letter', N'Filing & Organization', N'Bright Smile Dental', N'Manila File Folder, 1/3-Cut Tabs, Letter Size', N'Manufacturer: Smead
Model: Manila File Folder, 1/3-Cut Tabs, Letter Size
Notes: General filing folders.
Links: Product reference | https://www.smead.com/office-supplies/file-folders', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Colored File Folders – Assorted', N'Filing & Organization', N'Bright Smile Dental', N'Colored File Folders, 1/3-Cut Tabs, Letter Size', N'Manufacturer: Smead
Model: Colored File Folders, 1/3-Cut Tabs, Letter Size
Notes: Color-coded administrative filing.
Links: Product reference | https://www.smead.com/office-supplies/file-folders', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Hanging File Folders – Letter', N'Filing & Organization', N'Bright Smile Dental', N'Hanging File Folders, Letter Size, Standard Green', N'Manufacturer: Smead
Model: Hanging File Folders, Letter Size, Standard Green
Notes: Drawer filing system.
Links: Product reference | https://www.smead.com/office-supplies/hanging-file-folders', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Expanding File – 12 Pocket', N'Filing & Organization', N'Bright Smile Dental', N'Expanding File, 12 Pockets, Letter Size', N'Manufacturer: Smead
Model: Expanding File, 12 Pockets, Letter Size
Notes: Temporary project and monthly-document organization.
Links: Product reference | https://www.smead.com/office-supplies/expanding-files', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Classification Folder – 6 Section', N'Filing & Organization', N'Bright Smile Dental', N'Pressboard Classification Folder, 6 Section, Letter Size', N'Manufacturer: Smead
Model: Pressboard Classification Folder, 6 Section, Letter Size
Notes: Organizes multi-part administrative records.
Links: Product reference | https://www.smead.com/office-supplies/classification-folders', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Plastic File Storage Box', N'Filing & Organization', N'Bright Smile Dental', N'Stor/File Plastic File Box, Letter/Legal', N'Manufacturer: Bankers Box / Fellowes
Model: Stor/File Plastic File Box, Letter/Legal
Notes: Portable storage of inactive files.
Links: Product reference | https://www.fellowes.com/us/en/products/Pages/product-details.aspx', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Card File Box – 3 x 5', N'Filing & Organization', N'Bright Smile Dental', N'Locking Index Card Box, 3 x 5 in', N'Manufacturer: Vaultz
Model: Locking Index Card Box, 3 x 5 in
Notes: Secure storage of index cards or keys.
Links: Product reference | https://www.vaultz.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Avery Address Labels', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Avery 5160 Address Labels, 1 x 2-5/8 in, 30 per Sheet', N'Manufacturer: Avery
Model: Avery 5160 Address Labels, 1 x 2-5/8 in, 30 per Sheet
Notes: Mailing and file identification.
Links: Product reference | https://www.avery.com/templates/category/all-templates', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Avery Shipping Labels', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Avery 5163 Shipping Labels, 2 x 4 in, 10 per Sheet', N'Manufacturer: Avery
Model: Avery 5163 Shipping Labels, 2 x 4 in, 10 per Sheet
Notes: Shipping labels for envelopes and boxes.
Links: Product reference | https://www.avery.com/templates/category/all-templates', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Avery Return Address Labels', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Avery 5167 Return Address Labels, 1/2 x 1-3/4 in, 80 per Sheet', N'Manufacturer: Avery
Model: Avery 5167 Return Address Labels, 1/2 x 1-3/4 in, 80 per Sheet
Notes: Return-address labels.
Links: Product reference | https://www.avery.com/templates/category/all-templates', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Avery File Folder Labels', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Avery 5366 File Folder Labels, 2/3 x 3-7/16 in, 30 per Sheet', N'Manufacturer: Avery
Model: Avery 5366 File Folder Labels, 2/3 x 3-7/16 in, 30 per Sheet
Notes: File-folder labeling.
Links: Product reference | https://www.avery.com/templates/category/all-templates', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Avery Name Badges', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Avery 5395 Adhesive Name Badges, 2-1/3 x 3-3/8 in', N'Manufacturer: Avery
Model: Avery 5395 Adhesive Name Badges, 2-1/3 x 3-3/8 in
Notes: Temporary visitor and event name badges.
Links: Product reference | https://www.avery.com/templates/category/all-templates', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'Avery Matte Clear Address Labels', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Avery 18660 Address Labels, 1 x 2-5/8 in, Matte Clear', N'Manufacturer: Avery
Model: Avery 18660 Address Labels, 1 x 2-5/8 in, Matte Clear
Notes: Professional clear mailing labels.
Links: Product reference | https://www.avery.com/products/labels/18660', N'Verify printer type, label dimensions and template number before printing. Store flat and dry; do not use damaged or curled sheets.', NULL, NULL, N'Office'),
    (N'#10 Security Envelopes', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'#10 Security-Tint Business Envelopes, Self-Seal', N'Manufacturer: Quality Park
Model: #10 Security-Tint Business Envelopes, Self-Seal
Notes: Confidential correspondence and payments.
Links: Product reference | https://www.qualitypark.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'9 x 12 Catalog Envelopes', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'9 x 12 Brown Kraft Catalog Envelopes', N'Manufacturer: Quality Park
Model: 9 x 12 Brown Kraft Catalog Envelopes
Notes: Mailing unfolded documents.
Links: Product reference | https://www.qualitypark.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'6 x 9 Catalog Envelopes', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'6 x 9 Brown Kraft Catalog Envelopes', N'Manufacturer: Quality Park
Model: 6 x 9 Brown Kraft Catalog Envelopes
Notes: Mailing small document packets.
Links: Product reference | https://www.qualitypark.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Padded Mailers – Size 0', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Jiffy Padded Mailer, Size 0', N'Manufacturer: Sealed Air / Jiffy
Model: Jiffy Padded Mailer, Size 0
Notes: Protective mailing of small items.
Links: Product reference | https://www.sealedair.com/products/protective-mailers', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Padded Mailers – Size 2', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Jiffy Padded Mailer, Size 2', N'Manufacturer: Sealed Air / Jiffy
Model: Jiffy Padded Mailer, Size 2
Notes: Protective mailing of medium items.
Links: Product reference | https://www.sealedair.com/products/protective-mailers', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Forever Stamps', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'First-Class Mail Forever Stamps', N'Manufacturer: United States Postal Service
Model: First-Class Mail Forever Stamps
Notes: Routine letter postage.
Links: Product reference | https://store.usps.com/store/stamps/forever-stamps/_/N-1e3a37', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Certified Mail Labels and Forms', N'Labels, Envelopes & Mailing', N'Bright Smile Dental', N'Certified Mail Receipt PS Form 3800', N'Manufacturer: United States Postal Service
Model: Certified Mail Receipt PS Form 3800
Notes: Proof-of-mailing and delivery documentation.
Links: Product reference | https://about.usps.com/forms/ps3800.pdf', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Standard Staples', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'S.F. 4 Premium Staples, 1/4 in, 35450', N'Manufacturer: Swingline
Model: S.F. 4 Premium Staples, 1/4 in, 35450
Notes: Standard desktop stapler refills.
Links: Product reference | https://www.swingline.com/p/staples/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Heavy-Duty Staples – 3/8 in', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Heavy Duty Staples, 3/8 in', N'Manufacturer: Swingline
Model: Heavy Duty Staples, 3/8 in
Notes: Heavy-duty stapler refills.
Links: Product reference | https://www.swingline.com/p/staples/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Paper Clips – Standard', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Smooth Paper Clips, #1, Silver', N'Manufacturer: Acco
Model: Smooth Paper Clips, #1, Silver
Notes: General document fastening.
Links: Product reference | https://www.accobrands.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Paper Clips – Jumbo', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Jumbo Paper Clips, Silver', N'Manufacturer: Acco
Model: Jumbo Paper Clips, Silver
Notes: Fastening larger document sets.
Links: Product reference | https://www.accobrands.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Binder Clips – Small', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Binder Clips, Small, 3/4 in', N'Manufacturer: Acco
Model: Binder Clips, Small, 3/4 in
Notes: Reusable document fastening.
Links: Product reference | https://www.accobrands.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Binder Clips – Medium', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Binder Clips, Medium, 1-1/4 in', N'Manufacturer: Acco
Model: Binder Clips, Medium, 1-1/4 in
Notes: Reusable document fastening.
Links: Product reference | https://www.accobrands.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Binder Clips – Large', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Binder Clips, Large, 2 in', N'Manufacturer: Acco
Model: Binder Clips, Large, 2 in
Notes: Reusable document fastening.
Links: Product reference | https://www.accobrands.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Rubber Bands – Size 64', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Pale Crepe Gold Rubber Bands, Size 64', N'Manufacturer: Alliance
Model: Pale Crepe Gold Rubber Bands, Size 64
Notes: Bundling office documents and supplies.
Links: Product reference | https://www.rubberband.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Push Pins – Clear', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Clear Push Pins, Standard', N'Manufacturer: Officemate
Model: Clear Push Pins, Standard
Notes: Posting notices to corkboards.
Links: Product reference | https://www.officemate.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Thumbtacks – Silver', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Steel Thumbtacks, Silver', N'Manufacturer: Officemate
Model: Steel Thumbtacks, Silver
Notes: Posting lightweight notices.
Links: Product reference | https://www.officemate.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Utility Scissors – 8 in', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Scotch Precision Scissors, 8 in', N'Manufacturer: Scotch / 3M
Model: Scotch Precision Scissors, 8 in
Notes: General paper and packaging cutting.
Links: Product reference | https://www.3m.com/3M/en_US/p/c/office-supplies/cutting-tools/', N'Cutting or puncture hazard. Store safely and keep blades or points directed away from users.', NULL, NULL, N'Office'),
    (N'Letter Opener', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'KleenEarth Letter Opener', N'Manufacturer: Westcott
Model: KleenEarth Letter Opener
Notes: Opening envelopes and mail.
Links: Product reference | https://www.westcottbrand.com/', N'Cutting or puncture hazard. Store safely and keep blades or points directed away from users.', NULL, NULL, N'Office'),
    (N'Replacement Utility Blades', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'1992 Heavy-Duty Utility Blades', N'Manufacturer: Stanley
Model: 1992 Heavy-Duty Utility Blades
Notes: Replacement blades for approved utility knives.
Links: Product reference | https://www.stanleytools.com/product/11-921/1992-heavy-duty-utility-blades', N'Cutting or puncture hazard. Store safely and keep blades or points directed away from users.', NULL, NULL, N'Office'),
    (N'Ruler – 12 in', N'Desk Accessories & Fasteners', N'Bright Smile Dental', N'Stainless Steel Office Ruler, 12 in', N'Manufacturer: Westcott
Model: Stainless Steel Office Ruler, 12 in
Notes: Measuring and straight-edge work.
Links: Product reference | https://www.westcottbrand.com/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Telephone Message Pads', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'While You Were Out Message Book, 2-Part', N'Manufacturer: Adams
Model: While You Were Out Message Book, 2-Part
Notes: Records telephone messages for staff.
Links: Product reference | https://www.adamsforms.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Visitor Sign-In Log', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Visitor Sign-In Log Book with Privacy Cover', N'Manufacturer: Avery
Model: Visitor Sign-In Log Book with Privacy Cover
Notes: Tracks non-patient visitors and vendors.
Links: Product reference | https://www.avery.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Employee Time-Off Request Forms', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Employee Time-Off Request Forms', N'Manufacturer: Adams
Model: Employee Time-Off Request Forms
Notes: Paper backup for leave requests.
Links: Product reference | https://www.adamsforms.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Cash Receipt Book', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Money and Rent Receipt Book, 2-Part Carbonless', N'Manufacturer: Adams
Model: Money and Rent Receipt Book, 2-Part Carbonless
Notes: Documents miscellaneous cash receipts.
Links: Product reference | https://www.adamsforms.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Purchase Order Book', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Purchase Order Book, 3-Part Carbonless', N'Manufacturer: Adams
Model: Purchase Order Book, 3-Part Carbonless
Notes: Paper backup for approved purchases.
Links: Product reference | https://www.adamsforms.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Bank Deposit Bags', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Tamper-Evident Deposit Bags', N'Manufacturer: Controltek
Model: Tamper-Evident Deposit Bags
Notes: Secure transport and documentation of deposits.
Links: Product reference | https://www.controltekusa.com/products/security-bags/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Tamper-Evident Security Bags', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'TripLok Tamper-Evident Security Bags', N'Manufacturer: Controltek
Model: TripLok Tamper-Evident Security Bags
Notes: Secures keys, cash or confidential materials.
Links: Product reference | https://www.controltekusa.com/products/security-bags/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Index Cards – 3 x 5 Ruled', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Ruled Index Cards, 3 x 5 in, White', N'Manufacturer: Oxford
Model: Ruled Index Cards, 3 x 5 in, White
Notes: Temporary notes and reference cards.
Links: Product reference | https://www.tops-products.com/oxford/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Index Cards – 4 x 6 Ruled', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Ruled Index Cards, 4 x 6 in, White', N'Manufacturer: Oxford
Model: Ruled Index Cards, 4 x 6 in, White
Notes: Larger reference and training cards.
Links: Product reference | https://www.tops-products.com/oxford/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Legal Pads – Canary', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'The Legal Pad, 8.5 x 11.75 in, Canary', N'Manufacturer: TOPS
Model: The Legal Pad, 8.5 x 11.75 in, Canary
Notes: Meeting and administrative notes.
Links: Product reference | https://www.tops-products.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Composition Notebooks', N'Forms, Logs & Recordkeeping', N'Bright Smile Dental', N'Five Star Composition Book, College Ruled', N'Manufacturer: Mead
Model: Five Star Composition Book, College Ruled
Notes: Staff training and project notes.
Links: Product reference | https://www.fivestarbuiltstrong.com/', N'Administrative supply may contain confidential information after use. Secure completed forms and destroy them according to the office retention and privacy policy.', NULL, NULL, N'Office'),
    (N'Green Mountain Breakfast Blend K-Cups', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Breakfast Blend Coffee K-Cup Pods', N'Manufacturer: Keurig / Green Mountain Coffee Roasters
Model: Breakfast Blend Coffee K-Cup Pods
Notes: Light-roast coffee for staff breakroom.
Links: Product reference | https://www.keurig.com/Beverages/Breakfast-Blend-Coffee/p/Breakfast-Blend-Coffee-K-Cup-Green-Mountain', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Green Mountain Dark Magic K-Cups', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Dark Magic Extra Bold Coffee K-Cup Pods', N'Manufacturer: Keurig / Green Mountain Coffee Roasters
Model: Dark Magic Extra Bold Coffee K-Cup Pods
Notes: Dark-roast coffee for staff breakroom.
Links: Product reference | https://www.keurig.com/Beverages/Coffee/Regular/', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Green Mountain Breakfast Blend Decaf K-Cups', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Breakfast Blend Decaf Coffee K-Cup Pods', N'Manufacturer: Keurig / Green Mountain Coffee Roasters
Model: Breakfast Blend Decaf Coffee K-Cup Pods
Notes: Decaffeinated coffee for staff breakroom.
Links: Product reference | https://www.keurig.com/Beverages/Coffee/Breakfast-Blend-Decaf/', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Lipton Black Tea Bags', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Black Tea Bags, Individually Wrapped', N'Manufacturer: Lipton
Model: Black Tea Bags, Individually Wrapped
Notes: Hot tea for staff and guests.
Links: Product reference | https://www.lipton.com/us/en/our-teas/', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Splenda Sweetener Packets', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Original Sweetener Packets', N'Manufacturer: Splenda
Model: Original Sweetener Packets
Notes: Zero-calorie beverage sweetener.
Links: Product reference | https://www.splenda.com/product/splenda-original-sweetener-packets/', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Domino Sugar Packets', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Pure Cane Granulated Sugar Packets', N'Manufacturer: Domino Sugar
Model: Pure Cane Granulated Sugar Packets
Notes: Individual sugar packets.
Links: Product reference | https://www.dominosugar.com/products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Coffee-Mate Original Creamer', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Original Powdered Coffee Creamer', N'Manufacturer: Nestlé Coffee mate
Model: Original Powdered Coffee Creamer
Notes: Shelf-stable powdered coffee creamer.
Links: Product reference | https://www.goodnes.com/coffeemate/products/original-powdered-coffee-creamer/', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Bottled Water – 16.9 oz', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Purified Drinking Water, 16.9 fl oz Bottles', N'Manufacturer: Niagara
Model: Purified Drinking Water, 16.9 fl oz Bottles
Notes: Staff and visitor bottled water.
Links: Product reference | https://www.niagarawater.com/products/purified-drinking-water/', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Dixie Hot Cups – 12 oz', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'PerfecTouch Insulated Paper Hot Cups, 12 oz', N'Manufacturer: Dixie / Georgia-Pacific
Model: PerfecTouch Insulated Paper Hot Cups, 12 oz
Notes: Disposable hot beverage cups.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Dixie Cold Cups – 9 oz', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Paper Cold Cups, 9 oz', N'Manufacturer: Dixie / Georgia-Pacific
Model: Paper Cold Cups, 9 oz
Notes: Disposable cold-drink cups.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Dixie Paper Plates – 10 in', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Ultra Paper Plates, 10 in', N'Manufacturer: Dixie / Georgia-Pacific
Model: Ultra Paper Plates, 10 in
Notes: Disposable breakroom plates.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Disposable Cutlery – Forks', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Heavyweight Polystyrene Forks', N'Manufacturer: Dixie / Georgia-Pacific
Model: Heavyweight Polystyrene Forks
Notes: Disposable breakroom forks.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Disposable Cutlery – Spoons', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Heavyweight Polystyrene Spoons', N'Manufacturer: Dixie / Georgia-Pacific
Model: Heavyweight Polystyrene Spoons
Notes: Disposable breakroom spoons.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Beverage Stirrers', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Plastic Beverage Stirrers, 5 in', N'Manufacturer: Dixie / Georgia-Pacific
Model: Plastic Beverage Stirrers, 5 in
Notes: Coffee and tea stirrers.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Lunch Napkins', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Everyday Napkins', N'Manufacturer: Vanity Fair / Georgia-Pacific
Model: Everyday Napkins
Notes: Breakroom napkins.
Links: Product reference | https://www.gp.com/product-overview/consumer-products', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Aluminum Foil', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Reynolds Wrap Heavy Duty Aluminum Foil', N'Manufacturer: Reynolds
Model: Reynolds Wrap Heavy Duty Aluminum Foil
Notes: Food wrapping and breakroom use.
Links: Product reference | https://www.reynoldsbrands.com/products/aluminum-foil/heavy-duty-foil', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Food Storage Bags – Quart', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Ziploc Storage Bags, Quart', N'Manufacturer: Ziploc
Model: Ziploc Storage Bags, Quart
Notes: Staff food storage.
Links: Product reference | https://ziploc.com/en/Products/Bags/Storage/Storage-Bags-Quart', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Food Storage Bags – Gallon', N'Breakroom Food & Beverage', N'Bright Smile Dental', N'Ziploc Storage Bags, Gallon', N'Manufacturer: Ziploc
Model: Ziploc Storage Bags, Gallon
Notes: Staff food storage.
Links: Product reference | https://ziploc.com/en/Products/Bags/Storage/Storage-Bags-Gallon', N'Store in a clean, dry area. Check package integrity, allergens and expiration dates before serving.', NULL, NULL, N'Office'),
    (N'Toilet Paper – Ultra Strong', N'Restroom & Personal Care', N'Bright Smile Dental', N'Ultra Strong 2-Ply Mega Roll Toilet Paper', N'Manufacturer: Charmin
Model: Ultra Strong 2-Ply Mega Roll Toilet Paper
Notes: Restroom toilet tissue.
Links: Product reference | https://www.charmin.com/en-us/shop-products/ultra-strong-toilet-paper', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Commercial Bath Tissue', N'Restroom & Personal Care', N'Bright Smile Dental', N'Compact Coreless 2-Ply High-Capacity Bath Tissue', N'Manufacturer: Georgia-Pacific Professional
Model: Compact Coreless 2-Ply High-Capacity Bath Tissue
Notes: Commercial restroom tissue refill.
Links: Product reference | https://www.gppro.com/gp/tissue', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Multifold Paper Towels', N'Restroom & Personal Care', N'Bright Smile Dental', N'Pacific Blue Basic Multifold Paper Towels', N'Manufacturer: Georgia-Pacific Professional
Model: Pacific Blue Basic Multifold Paper Towels
Notes: Restroom and handwashing paper towels.
Links: Product reference | https://www.gppro.com/gp/towels', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Facial Tissue', N'Restroom & Personal Care', N'Bright Smile Dental', N'Kleenex Professional Facial Tissue, 2-Ply', N'Manufacturer: Kleenex Professional
Model: Kleenex Professional Facial Tissue, 2-Ply
Notes: Reception, offices and staff areas.
Links: Product reference | https://www.kcprofessional.com/en-us/products/wipers/facial-tissue', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Foaming Hand Soap Refill', N'Restroom & Personal Care', N'Bright Smile Dental', N'PURELL Professional Healthy Soap 0.5% BAK Foam Refill', N'Manufacturer: PURELL
Model: PURELL Professional Healthy Soap 0.5% BAK Foam Refill
Notes: Restroom and staff handwashing soap.
Links: Product reference | https://www.gojo.com/en/Product-Catalog/Hand-Soap', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Hand Sanitizer Refill', N'Restroom & Personal Care', N'Bright Smile Dental', N'PURELL Advanced Hand Sanitizer Green Certified Foam Refill', N'Manufacturer: PURELL
Model: PURELL Advanced Hand Sanitizer Green Certified Foam Refill
Notes: Administrative and common-area hand sanitizer.
Links: Product reference | https://www.gojo.com/en/Product-Catalog/Hand-Sanitizer', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Feminine Hygiene Pads', N'Restroom & Personal Care', N'Bright Smile Dental', N'Always Ultra Thin Regular Pads with Wings', N'Manufacturer: Always
Model: Always Ultra Thin Regular Pads with Wings
Notes: Staff and guest restroom emergency supply.
Links: Product reference | https://always.com/en-us/shop-products/menstrual-pads/ultra-thin-pads', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Feminine Hygiene Tampons', N'Restroom & Personal Care', N'Bright Smile Dental', N'Tampax Pearl Regular Tampons', N'Manufacturer: Tampax
Model: Tampax Pearl Regular Tampons
Notes: Staff and guest restroom emergency supply.
Links: Product reference | https://tampax.com/en-us/all-products/pearl/regular/', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Toilet Seat Covers', N'Restroom & Personal Care', N'Bright Smile Dental', N'Health Gards Half-Fold Toilet Seat Covers', N'Manufacturer: Hospeco
Model: Health Gards Half-Fold Toilet Seat Covers
Notes: Disposable restroom seat covers.
Links: Product reference | https://www.hospecobrands.com/', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Air Freshener Refill', N'Restroom & Personal Care', N'Bright Smile Dental', N'Febreze Air Heavy Duty Aerosol, Linen & Sky', N'Manufacturer: Febreze Professional
Model: Febreze Air Heavy Duty Aerosol, Linen & Sky
Notes: Restroom and common-area odor control.
Links: Product reference | https://pgpro.com/en-us/brands/febreze', N'Store in a clean, dry location. Do not place paper towels, wipes or feminine products in toilets unless specifically labeled flushable.', NULL, NULL, N'Office'),
    (N'Clorox Disinfecting Wipes', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Clorox Disinfecting Wipes, Fresh Scent', N'Manufacturer: CloroxPro
Model: Clorox Disinfecting Wipes, Fresh Scent
Notes: Administrative and common-area hard-surface cleaning.
Links: Product reference | https://www.cloroxpro.com/products/clorox/clorox-disinfecting-wipes/', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Clorox Germicidal Bleach', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Clorox Germicidal Bleach', N'Manufacturer: CloroxPro
Model: Clorox Germicidal Bleach
Notes: Laundry and approved hard-surface disinfection when diluted as labeled.
Links: Product reference | https://www.cloroxpro.com/products/clorox/germicidal-bleach/', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Clorox Screen+ Sanitizing Wipes', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Screen+ Sanitizing Wipes for Screens and Electronics', N'Manufacturer: CloroxPro
Model: Screen+ Sanitizing Wipes for Screens and Electronics
Notes: Cleaning electronics and touchscreens as directed.
Links: Product reference | https://www.cloroxpro.com/products/clorox/screenwipes/', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Windex Original Glass Cleaner', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Windex Original Glass Cleaner', N'Manufacturer: SC Johnson Professional
Model: Windex Original Glass Cleaner
Notes: Glass and mirror cleaning.
Links: Product reference | https://www.scjp.com/en-us/products/windex', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Mr. Clean Multi-Surface Cleaner', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Mr. Clean Finished Floor Cleaner', N'Manufacturer: P&G Professional
Model: Mr. Clean Finished Floor Cleaner
Notes: Routine floor and hard-surface cleaning.
Links: Product reference | https://pgpro.com/en-us/brands/mr-clean', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Dawn Professional Dish Detergent', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Dawn Professional Manual Pot and Pan Detergent', N'Manufacturer: P&G Professional
Model: Dawn Professional Manual Pot and Pan Detergent
Notes: Breakroom dishwashing.
Links: Product reference | https://pgpro.com/en-us/brands/dawn-professional', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Cascade Professional Dishwasher Detergent', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Cascade Professional ActionPacs', N'Manufacturer: P&G Professional
Model: Cascade Professional ActionPacs
Notes: Automatic dishwasher detergent.
Links: Product reference | https://pgpro.com/en-us/brands/cascade-professional', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Tide Professional Laundry Detergent', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Tide Professional Commercial Laundry Detergent', N'Manufacturer: P&G Professional
Model: Tide Professional Commercial Laundry Detergent
Notes: Office laundry and washable towels.
Links: Product reference | https://pgpro.com/en-us/brands/tide-professional', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Swiffer Heavy Duty Duster Refills', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Heavy Duty Duster Refills', N'Manufacturer: Swiffer
Model: Heavy Duty Duster Refills
Notes: Dusting offices and common areas.
Links: Product reference | https://swiffer.com/en-us/shop-products/dusting/swiffer-dusters-heavy-duty-refills', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Swiffer WetJet Pad Refills', N'Cleaning & Janitorial', N'Bright Smile Dental', N'WetJet Mopping Pad Refills', N'Manufacturer: Swiffer
Model: WetJet Mopping Pad Refills
Notes: Routine hard-floor cleaning.
Links: Product reference | https://swiffer.com/en-us/shop-products/mopping/swiffer-wetjet-mopping-pad-refills', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Scotch-Brite Non-Scratch Scrub Sponges', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Non-Scratch Scrub Sponge 621', N'Manufacturer: Scotch-Brite / 3M
Model: Non-Scratch Scrub Sponge 621
Notes: Breakroom sink and dish cleaning.
Links: Product reference | https://www.scotch-brite.com/3M/en_US/p/c/cleaning-tools/sponges/', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Microfiber Cleaning Cloths', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Scotch-Brite High Performance Microfiber Cleaning Cloth', N'Manufacturer: 3M
Model: Scotch-Brite High Performance Microfiber Cleaning Cloth
Notes: Reusable general cleaning cloth.
Links: Product reference | https://www.3m.com/3M/en_US/commercial-cleaning-us/', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Trash Bags – 13 Gallon', N'Cleaning & Janitorial', N'Bright Smile Dental', N'ForceFlex Tall Kitchen Drawstring Trash Bags, 13 Gallon', N'Manufacturer: Glad
Model: ForceFlex Tall Kitchen Drawstring Trash Bags, 13 Gallon
Notes: Breakroom and office trash liners.
Links: Product reference | https://www.glad.com/trash/kitchen/forceflexplus-tall-kitchen-drawstring-trash-bags', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Trash Bags – 30 Gallon', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Large Drawstring Trash Bags, 30 Gallon', N'Manufacturer: Glad
Model: Large Drawstring Trash Bags, 30 Gallon
Notes: Medium facility trash liners.
Links: Product reference | https://www.glad.com/trash/large/', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'Trash Bags – 55 Gallon', N'Cleaning & Janitorial', N'Bright Smile Dental', N'Can Liner, 55 Gallon, Heavy Duty', N'Manufacturer: Berry Global
Model: Can Liner, 55 Gallon, Heavy Duty
Notes: Large facility trash liners.
Links: Product reference | https://www.berryglobal.com/en/product/product-item/can-liners-10006259', N'Read the product label and current SDS. Wear appropriate PPE, provide ventilation and never mix cleaning chemicals.', NULL, NULL, N'Office'),
    (N'AA Alkaline Batteries', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'Coppertop AA Alkaline Batteries, MN1500', N'Manufacturer: Duracell
Model: Coppertop AA Alkaline Batteries, MN1500
Notes: Batteries for office electronics and emergency devices.
Links: Product reference | https://www.duracell.com/en-us/product/coppertop-battery/', N'Keep away from heat, moisture and children. Do not mix battery types or old and new batteries; recycle or dispose of used batteries properly.', NULL, NULL, N'Office'),
    (N'AAA Alkaline Batteries', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'Coppertop AAA Alkaline Batteries, MN2400', N'Manufacturer: Duracell
Model: Coppertop AAA Alkaline Batteries, MN2400
Notes: Batteries for remotes and small office electronics.
Links: Product reference | https://www.duracell.com/en-us/product/coppertop-battery/', N'Keep away from heat, moisture and children. Do not mix battery types or old and new batteries; recycle or dispose of used batteries properly.', NULL, NULL, N'Office'),
    (N'9V Alkaline Batteries', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'Coppertop 9V Alkaline Batteries, MN1604', N'Manufacturer: Duracell
Model: Coppertop 9V Alkaline Batteries, MN1604
Notes: Batteries for compatible office and safety devices.
Links: Product reference | https://www.duracell.com/en-us/product/coppertop-battery/', N'Keep away from heat, moisture and children. Do not mix battery types or old and new batteries; recycle or dispose of used batteries properly.', NULL, NULL, N'Office'),
    (N'CR2032 Lithium Coin Batteries', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'CR2032 Lithium Coin Batteries', N'Manufacturer: Energizer
Model: CR2032 Lithium Coin Batteries
Notes: Coin-cell batteries for compatible electronics.
Links: Product reference | https://www.energizer.com/batteries/energizer-lithium-coin-batteries', N'Keep away from heat, moisture and children. Do not mix battery types or old and new batteries; recycle or dispose of used batteries properly.', NULL, NULL, N'Office'),
    (N'USB-C to USB-C Cable – 6 ft', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'BoostCharge USB-C to USB-C Cable, 6.6 ft', N'Manufacturer: Belkin
Model: BoostCharge USB-C to USB-C Cable, 6.6 ft
Notes: Replacement charging and data cable.
Links: Product reference | https://www.belkin.com/products/cables/usb-c-cables/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'USB-A to USB-C Cable – 6 ft', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'BoostCharge USB-A to USB-C Cable, 6.6 ft', N'Manufacturer: Belkin
Model: BoostCharge USB-A to USB-C Cable, 6.6 ft
Notes: Replacement charging and data cable.
Links: Product reference | https://www.belkin.com/products/cables/usb-c-cables/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'HDMI Cable – 6 ft', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'Ultra HD High Speed HDMI Cable, 6.6 ft', N'Manufacturer: Belkin
Model: Ultra HD High Speed HDMI Cable, 6.6 ft
Notes: Replacement display cable.
Links: Product reference | https://www.belkin.com/products/cables/hdmi-cables/', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Ethernet Patch Cable – Cat6 7 ft', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'Cat6 Gigabit Snagless Molded Patch Cable, 7 ft', N'Manufacturer: Tripp Lite by Eaton
Model: Cat6 Gigabit Snagless Molded Patch Cable, 7 ft
Notes: Replacement short network patch cable.
Links: Product reference | https://tripplite.eaton.com/products/cat6-ethernet-cables~27-101', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Cable Ties – 8 in', N'Batteries, Cables & IT Consumables', N'Bright Smile Dental', N'Pan-Ty Nylon Cable Ties, 8 in', N'Manufacturer: Panduit
Model: Pan-Ty Nylon Cable Ties, 8 in
Notes: Cable organization and light bundling.
Links: Product reference | https://www.panduit.com/en/products/wire-routing-management-protection/cable-wire-ties-mounts-straps/cable-ties.html', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Corrugated Shipping Box – 12 x 12 x 12', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'200 lb Test Corrugated Box, 12 x 12 x 12 in', N'Manufacturer: Uline
Model: 200 lb Test Corrugated Box, 12 x 12 x 12 in
Notes: General shipping and storage carton.
Links: Product reference | https://www.uline.com/BL_425/Corrugated-Boxes-200-lb-Test', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Corrugated Shipping Box – 16 x 12 x 10', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'200 lb Test Corrugated Box, 16 x 12 x 10 in', N'Manufacturer: Uline
Model: 200 lb Test Corrugated Box, 16 x 12 x 10 in
Notes: Medium shipping carton.
Links: Product reference | https://www.uline.com/BL_425/Corrugated-Boxes-200-lb-Test', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Bubble Wrap – Small Bubble', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'Bubble Wrap Brand Small Bubble Cushioning', N'Manufacturer: Sealed Air
Model: Bubble Wrap Brand Small Bubble Cushioning
Notes: Protective packaging for shipped items.
Links: Product reference | https://www.sealedair.com/products/protective-packaging/bubble-wrap-brand-cushioning', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Packing Paper', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'Newsprint Packing Paper, 24 x 36 in', N'Manufacturer: Uline
Model: Newsprint Packing Paper, 24 x 36 in
Notes: Void fill and product protection.
Links: Product reference | https://www.uline.com/BL_1958/Newsprint-Packing-Paper', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Stretch Wrap – 18 in', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'Hand Stretch Wrap, 18 in x 1500 ft', N'Manufacturer: Uline
Model: Hand Stretch Wrap, 18 in x 1500 ft
Notes: Secures boxes and stored items.
Links: Product reference | https://www.uline.com/BL_179/Hand-Stretch-Wrap', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Packing List Envelopes', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'Packing List Envelopes, Full Face, 4.5 x 5.5 in', N'Manufacturer: Uline
Model: Packing List Envelopes, Full Face, 4.5 x 5.5 in
Notes: Protects shipping documents on packages.
Links: Product reference | https://www.uline.com/BL_1305/Packing-List-Envelopes', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Reusable Storage Bags – Large', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'Slider Storage Bags, Gallon', N'Manufacturer: Hefty
Model: Slider Storage Bags, Gallon
Notes: Small-parts and office-supply organization.
Links: Product reference | https://www.hefty.com/products/storage-bags', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office'),
    (N'Permanent Storage Labels', N'Shipping, Packaging & Storage', N'Bright Smile Dental', N'Durable ID Labels, White Film', N'Manufacturer: Avery
Model: Durable ID Labels, White Film
Notes: Labels bins, shelves and office assets.
Links: Product reference | https://www.avery.com/products/labels/usage/durable-id-labels', N'Inspect packaging before use and store according to the manufacturer instructions.', NULL, NULL, N'Office');


DECLARE @Instruments TABLE (
    Name NVARCHAR(255), Category NVARCHAR(255), SkuNumber NVARCHAR(100), OfficeName NVARCHAR(255), Description NVARCHAR(MAX), Notes NVARCHAR(MAX), Warnings NVARCHAR(MAX), ImageUrl NVARCHAR(MAX), DocumentUrl NVARCHAR(MAX), Links NVARCHAR(MAX)
);
INSERT INTO @Instruments (Name, Category, SkuNumber, OfficeName, Description, Notes, Warnings, ImageUrl, DocumentUrl, Links)
VALUES
    (N'#5 HD Mouth Mirror', N'Diagnostic & Examination', N'#5 HD Mouth Mirror (MIR5HD)', N'Bright Smile Dental', N'Used for indirect vision, retraction and illumination.', N'Manufacturer: HuFriedyGroup
Model: #5 HD Mouth Mirror (MIR5HD)
Notes: Used for indirect vision, retraction and illumination.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/mirrors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'#6 Cone Socket Mirror Handle', N'Diagnostic & Examination', N'#6 Cone Socket Mirror Handle (MH6)', N'Bright Smile Dental', N'Mirror handle for cone-socket mirror heads; blunt end may be used for percussion and mobility checks.', N'Manufacturer: HuFriedyGroup
Model: #6 Cone Socket Mirror Handle (MH6)
Notes: Mirror handle for cone-socket mirror heads; blunt end may be used for percussion and mobility checks.', N'Reusable dental instrument. Clean, inspect, package and sterilize after each patient according to the manufacturer instructions.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/mouth-mirror-handles/6-cone-socket-mirror-handle
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'TU17/23 Explorer', N'Diagnostic & Examination', N'TU17/23 Explorer (EXTU17/23)', N'Bright Smile Dental', N'Double-ended explorer for caries and calculus detection.', N'Manufacturer: HuFriedyGroup
Model: TU17/23 Explorer (EXTU17/23)
Notes: Double-ended explorer for caries and calculus detection.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/dental-explorers/tu17-23-explorer
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'#5 Explorer', N'Diagnostic & Examination', N'#5 Explorer (EXD5)', N'Bright Smile Dental', N'Double-ended explorer used for caries, calculus and restoration evaluation.', N'Manufacturer: HuFriedyGroup
Model: #5 Explorer (EXD5)
Notes: Double-ended explorer used for caries, calculus and restoration evaluation.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/dental-explorers/5-explorer
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'UNC-15 Periodontal Probe', N'Diagnostic & Examination', N'UNC-15 Color-Coded Probe', N'Bright Smile Dental', N'Millimeter-marked periodontal probe for pocket-depth measurements.', N'Manufacturer: HuFriedyGroup
Model: UNC-15 Color-Coded Probe
Notes: Millimeter-marked periodontal probe for pocket-depth measurements.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/dental-probe-8025
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'CP-12 Periodontal Probe', N'Diagnostic & Examination', N'CP-12 Color-Coded Probe', N'Bright Smile Dental', N'Color-coded periodontal probe for routine charting.', N'Manufacturer: HuFriedyGroup
Model: CP-12 Color-Coded Probe
Notes: Color-coded periodontal probe for routine charting.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/dental-probe-8025
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Nabers 2N Furcation Probe', N'Diagnostic & Examination', N'Nabers 2N Furcation Probe', N'Bright Smile Dental', N'Curved probe for furcation assessment.', N'Manufacturer: HuFriedyGroup
Model: Nabers 2N Furcation Probe
Notes: Curved probe for furcation assessment.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/dental-probe-8025
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'23/UNC Expro', N'Diagnostic & Examination', N'23 Explorer / UNC Probe Combination (XP23/UNC)', N'Bright Smile Dental', N'Combination explorer and periodontal probe.', N'Manufacturer: HuFriedyGroup
Model: 23 Explorer / UNC Probe Combination (XP23/UNC)
Notes: Combination explorer and periodontal probe.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/expros-8027
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'#2 College Dressing Pliers', N'Diagnostic & Examination', N'#2 College Dressing Pliers (DP2)', N'Bright Smile Dental', N'Transfers cotton, gauze and small materials into or out of the oral cavity.', N'Manufacturer: HuFriedyGroup
Model: #2 College Dressing Pliers (DP2)
Notes: Transfers cotton, gauze and small materials into or out of the oral cavity.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/cotton-dressing-pliers/2-college-dressing-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'#3 Locking Dressing Pliers', N'Diagnostic & Examination', N'#3 Dressing Pliers (DP3)', N'Bright Smile Dental', N'Serrated locking dressing pliers for grasping small materials.', N'Manufacturer: HuFriedyGroup
Model: #3 Dressing Pliers (DP3)
Notes: Serrated locking dressing pliers for grasping small materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/cotton-dressing-pliers/3-dressing-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Miller Articulating Paper Forceps', N'Diagnostic & Examination', N'Miller Articulating Paper Forceps', N'Bright Smile Dental', N'Holds articulating paper for occlusal marking.', N'Manufacturer: HuFriedyGroup
Model: Miller Articulating Paper Forceps
Notes: Holds articulating paper for occlusal marking.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/diagnostic-8024
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'DG16/17 Endodontic Explorer', N'Diagnostic & Examination', N'DG16/17 Endodontic Explorer', N'Bright Smile Dental', N'Locates canal orifices and examines the pulpal floor.', N'Manufacturer: HuFriedyGroup
Model: DG16/17 Endodontic Explorer
Notes: Locates canal orifices and examines the pulpal floor.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/dental-explorers-8026
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'H6/H7 Sickle Scaler', N'Hygiene & Periodontal', N'H6/H7 Anterior Sickle Scaler', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: H6/H7 Anterior Sickle Scaler
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/scalers/universal
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'204S Posterior Sickle Scaler', N'Hygiene & Periodontal', N'204S Posterior Sickle Scaler', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: 204S Posterior Sickle Scaler
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/scalers/universal
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Anterior Sickle/Hoe Scaler', N'Hygiene & Periodontal', N'Anterior Sickle/Hoe Scaler (SDH1009E2)', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Anterior Sickle/Hoe Scaler (SDH1009E2)
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/anterior-sickle-scalers/anterior-sickle-hoe-scaler
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Columbia 13/14 Universal Curette', N'Hygiene & Periodontal', N'Columbia 13/14 Universal Curette (SC13/149E2)', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Columbia 13/14 Universal Curette (SC13/149E2)
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/universal-curettes/13-14-columbia-university-curette-harmonytm-handle-9-everedgetm
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Barnhart 5/6 Universal Curette', N'Hygiene & Periodontal', N'Barnhart 5/6 Universal Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Barnhart 5/6 Universal Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/scalers/universal
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'McCall 13/14 Universal Curette', N'Hygiene & Periodontal', N'McCall 13/14 Universal Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: McCall 13/14 Universal Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/scalers/universal
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gracey 1/2 Curette', N'Hygiene & Periodontal', N'Gracey 1/2 Area-Specific Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Gracey 1/2 Area-Specific Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/gracey-curettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gracey 5/6 Curette', N'Hygiene & Periodontal', N'Gracey 5/6 Area-Specific Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Gracey 5/6 Area-Specific Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/gracey-curettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gracey 7/8 Curette', N'Hygiene & Periodontal', N'Gracey 7/8 Area-Specific Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Gracey 7/8 Area-Specific Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/gracey-curettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gracey 11/12 Curette', N'Hygiene & Periodontal', N'Gracey 11/12 Harmony Handle (SG11/12XE2)', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Gracey 11/12 Harmony Handle (SG11/12XE2)
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/standard-gracey-curettes/11-12-gracey-curette-harmonytm-ergonomic-handle
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gracey 13/14 Curette', N'Hygiene & Periodontal', N'Gracey 13/14 Area-Specific Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Gracey 13/14 Area-Specific Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/gracey-curettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'After Five Gracey 11/12 Curette', N'Hygiene & Periodontal', N'After Five Gracey 11/12 (SRPG11/12XE2)', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: After Five Gracey 11/12 (SRPG11/12XE2)
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/after-fivetm-gracey-curettes/11-12-after-fivetm-gracey-curette-harmonytm-handle
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Mini Five Gracey 11/12 Curette', N'Hygiene & Periodontal', N'Mini Five Gracey 11/12', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Mini Five Gracey 11/12
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/mini-fivetm-gracey-curettes/11-12-rigid-mini-fivetm-gracey-curette
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Nevi 1 Anterior Scaler', N'Hygiene & Periodontal', N'Nevi 1 Anterior Sickle Scaler', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Nevi 1 Anterior Sickle Scaler
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/scalers/universal
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Younger-Good 7/8 Curette', N'Hygiene & Periodontal', N'Younger-Good 7/8 Universal Curette', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Younger-Good 7/8 Universal Curette
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/scalers/universal
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Hirschfeld 3/7 Periodontal File', N'Hygiene & Periodontal', N'Hirschfeld 3/7 Periodontal File', N'Bright Smile Dental', N'Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Manufacturer: HuFriedyGroup
Model: Hirschfeld 3/7 Periodontal File
Notes: Hand-scaling instrument for periodontal debridement. Maintain a sharp working edge and store in a protected cassette.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/periodontal-files
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Goldstein Flexi-Thin Composite Instrument', N'Restorative & Composite', N'Goldstein Flexi-Thin 1 (TNCIGFT1)', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Goldstein Flexi-Thin 1 (TNCIGFT1)
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/composite-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'IPC-L Composite Instrument', N'Restorative & Composite', N'IPC-L Composite Instrument (TNCIPCL)', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: IPC-L Composite Instrument (TNCIPCL)
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/composite-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Woodson #1 Plastic Filling Instrument', N'Restorative & Composite', N'Woodson #1 Plastic Filling Instrument', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Woodson #1 Plastic Filling Instrument
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/plastic-filling-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Plastic Filling Instrument #49', N'Restorative & Composite', N'Plastic Filling Instrument #49', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Plastic Filling Instrument #49
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/plastic-filling-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Amalgam Condenser 0/1', N'Restorative & Composite', N'Amalgam Condenser 0/1', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Amalgam Condenser 0/1
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/condensers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Ball Burnisher 26/27S', N'Restorative & Composite', N'Ball Burnisher 26/27S', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Ball Burnisher 26/27S
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/burnishers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Acorn Burnisher 21B', N'Restorative & Composite', N'Acorn Burnisher 21B', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Acorn Burnisher 21B
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/burnishers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Hollenback 3S Carver', N'Restorative & Composite', N'Hollenback 3S Carver', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Hollenback 3S Carver
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/carvers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Cleoid-Discoid 89/92 Carver', N'Restorative & Composite', N'Cleoid-Discoid 89/92 Carver', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Cleoid-Discoid 89/92 Carver
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/carvers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Spoon Excavator #17', N'Restorative & Composite', N'Spoon Excavator #17', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Spoon Excavator #17
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/excavators
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Spoon Excavator #18', N'Restorative & Composite', N'Spoon Excavator #18', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Spoon Excavator #18
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/excavators
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Dycal Applicator', N'Restorative & Composite', N'Double-Ended Dycal Applicator', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Double-Ended Dycal Applicator
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/plastic-filling-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Cement Spatula #24', N'Restorative & Composite', N'Cement Spatula #24', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Cement Spatula #24
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/spatulas
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Universal Tofflemire Matrix Retainer', N'Restorative & Composite', N'Universal Tofflemire Matrix Retainer', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Universal Tofflemire Matrix Retainer
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/matrix-retainers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Ivory 8N Matrix Retainer', N'Restorative & Composite', N'Ivory 8N Matrix Retainer', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Ivory 8N Matrix Retainer
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/matrix-retainers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Amalgam Well', N'Restorative & Composite', N'Stainless Steel Amalgam Well', N'Bright Smile Dental', N'Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Manufacturer: HuFriedyGroup
Model: Stainless Steel Amalgam Well
Notes: Reusable restorative instrument for placement, contouring, carving or finishing restorative materials.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/amalgam-wells
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Christensen Crown Remover', N'Crown, Bridge & Prosthodontic', N'Christensen Crown Remover', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Christensen Crown Remover
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/crown-removers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Crown Gripper Forceps', N'Crown, Bridge & Prosthodontic', N'Crown Gripper Forceps', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Crown Gripper Forceps
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/crown-removers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Crown and Gold Scissors', N'Crown, Bridge & Prosthodontic', N'Crown and Gold Curved Scissors', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Crown and Gold Curved Scissors
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/scissors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Pediatric Crown and Gold Scissors', N'Crown, Bridge & Prosthodontic', N'Crown & Gold Curved Pediatric Scissors (SCGCP)', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Crown & Gold Curved Pediatric Scissors (SCGCP)
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/documents/2426
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gingival Cord Packer 113', N'Crown, Bridge & Prosthodontic', N'Gingival Cord Packer 113', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Gingival Cord Packer 113
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/cord-packers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gingival Cord Packer 170', N'Crown, Bridge & Prosthodontic', N'Gingival Cord Packer 170', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Gingival Cord Packer 170
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/cord-packers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Gingival Cord Packer 113 Serrated', N'Crown, Bridge & Prosthodontic', N'Gingival Cord Packer 113 Serrated', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Gingival Cord Packer 113 Serrated
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/cord-packers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Wax Spatula #7', N'Crown, Bridge & Prosthodontic', N'Wax Spatula #7 (WS7)', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Wax Spatula #7 (WS7)
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/documents/2426
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Le Cron Wax Carver', N'Crown, Bridge & Prosthodontic', N'Le Cron Wax Carver', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Le Cron Wax Carver
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/waxing-carvers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Crown and Bridge Hemostat', N'Crown, Bridge & Prosthodontic', N'Curved Kelly Hemostat', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Curved Kelly Hemostat
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/hemostats
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Temporary Crown Contouring Pliers', N'Crown, Bridge & Prosthodontic', N'Crown and Band Contouring Pliers', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Crown and Band Contouring Pliers
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/orthodontic-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Crown Removing Pliers', N'Crown, Bridge & Prosthodontic', N'Crown Removing Pliers', N'Bright Smile Dental', N'Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Manufacturer: HuFriedyGroup
Model: Crown Removing Pliers
Notes: Reusable instrument for crown, bridge, provisional, cord-packing or laboratory procedures.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/crown-removers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'DG16 Endodontic Explorer', N'Endodontic Instruments', N'DG16 Endodontic Explorer', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: DG16 Endodontic Explorer
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-explorers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'DG16/17 Endodontic Explorer', N'Endodontic Instruments', N'DG16/17 Endodontic Explorer', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: DG16/17 Endodontic Explorer
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-explorers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Endodontic Spoon Excavator 31L', N'Endodontic Instruments', N'Endodontic Spoon Excavator 31L', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Endodontic Spoon Excavator 31L
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/excavators
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Glick #1 Endodontic Instrument', N'Endodontic Instruments', N'Glick #1 Plugger / Paddle', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Glick #1 Plugger / Paddle
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-pluggers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'D11T Endodontic Spreader', N'Endodontic Instruments', N'D11T Finger Spreader', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: D11T Finger Spreader
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-spreaders
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Endodontic Plugger 5/7', N'Endodontic Instruments', N'Endodontic Plugger 5/7', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Endodontic Plugger 5/7
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-pluggers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Machtou Plugger 1/2', N'Endodontic Instruments', N'Machtou Plugger 1/2', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Machtou Plugger 1/2
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-pluggers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Perry Locking Cotton Pliers', N'Endodontic Instruments', N'Perry Locking Cotton Pliers', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Perry Locking Cotton Pliers
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/cotton-dressing-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Steiglitz Root Fragment Forceps', N'Endodontic Instruments', N'Steiglitz Root Fragment Forceps', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Steiglitz Root Fragment Forceps
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Endodontic Measuring Forceps', N'Endodontic Instruments', N'Endodontic Measuring Forceps', N'Bright Smile Dental', N'Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Manufacturer: HuFriedyGroup
Model: Endodontic Measuring Forceps
Notes: Reusable endodontic hand instrument. Inspect the working end under magnification before use and sterilize after each patient.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/endodontic-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Punch', N'Isolation & Rubber Dam', N'Ainsworth Rubber Dam Punch', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Ainsworth Rubber Dam Punch
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-punches
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp Forceps', N'Isolation & Rubber Dam', N'Washington Rubber Dam Clamp Forceps', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Washington Rubber Dam Clamp Forceps
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamp-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Young Rubber Dam Frame', N'Isolation & Rubber Dam', N'Young-Style Rubber Dam Frame', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Young-Style Rubber Dam Frame
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Reusable dental instrument. Clean, inspect, package and sterilize after each patient according to the manufacturer instructions.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-frames
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp #2A', N'Isolation & Rubber Dam', N'Rubber Dam Clamp #2A', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Rubber Dam Clamp #2A
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Spring-loaded clamp. Inspect for cracks or distortion and secure with dental floss before intraoral placement.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp #7', N'Isolation & Rubber Dam', N'Rubber Dam Clamp #7', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Rubber Dam Clamp #7
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Spring-loaded clamp. Inspect for cracks or distortion and secure with dental floss before intraoral placement.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp #8A', N'Isolation & Rubber Dam', N'Rubber Dam Clamp #8A', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Rubber Dam Clamp #8A
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Spring-loaded clamp. Inspect for cracks or distortion and secure with dental floss before intraoral placement.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp #14A', N'Isolation & Rubber Dam', N'Rubber Dam Clamp #14A', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Rubber Dam Clamp #14A
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Spring-loaded clamp. Inspect for cracks or distortion and secure with dental floss before intraoral placement.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp #212', N'Isolation & Rubber Dam', N'Rubber Dam Clamp #212 Cervical Clamp', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Rubber Dam Clamp #212 Cervical Clamp
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Spring-loaded clamp. Inspect for cracks or distortion and secure with dental floss before intraoral placement.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Rubber Dam Clamp W8A', N'Isolation & Rubber Dam', N'Wingless W8A Rubber Dam Clamp', N'Bright Smile Dental', N'Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Manufacturer: HuFriedyGroup
Model: Wingless W8A Rubber Dam Clamp
Notes: Reusable rubber-dam instrument. Clean and sterilize after each patient; inspect clamps and forceps before placement.', N'Spring-loaded clamp. Inspect for cracks or distortion and secure with dental floss before intraoral placement.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rubber-dam-clamps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Scalpel Handle #3', N'Oral Surgery & Extraction', N'Scalpel Handle #3', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Scalpel Handle #3
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/scalpel-handles
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Molt #9 Periosteal Elevator', N'Oral Surgery & Extraction', N'Molt #9 Periosteal Elevator', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Molt #9 Periosteal Elevator
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/periosteal-elevators
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Prichard Periosteal Elevator', N'Oral Surgery & Extraction', N'Prichard Periosteal Elevator', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Prichard Periosteal Elevator
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/periosteal-elevators
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Minnesota Cheek Retractor', N'Oral Surgery & Extraction', N'Minnesota Retractor', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Minnesota Retractor
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/retractors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Austin Cheek Retractor', N'Oral Surgery & Extraction', N'Austin Retractor', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Austin Retractor
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/retractors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Seldin 23 Retractor', N'Oral Surgery & Extraction', N'Seldin 23 Retractor', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Seldin 23 Retractor
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/retractors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Lucas 86 Surgical Curette', N'Oral Surgery & Extraction', N'Lucas 86 Bone Curette', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Lucas 86 Bone Curette
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/surgical-curettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Molt 2/4 Surgical Curette', N'Oral Surgery & Extraction', N'Molt 2/4 Surgical Curette', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Molt 2/4 Surgical Curette
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/surgical-curettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Miller 21 Bone File', N'Oral Surgery & Extraction', N'Miller 21 Bone File', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Miller 21 Bone File
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/bone-files
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Friedman Mini Rongeur', N'Oral Surgery & Extraction', N'Friedman Mini Rongeur', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Friedman Mini Rongeur
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rongeurs
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Blumenthal 30 Rongeur', N'Oral Surgery & Extraction', N'Blumenthal 30 Rongeur', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Blumenthal 30 Rongeur
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/rongeurs
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Straight Elevator 301', N'Oral Surgery & Extraction', N'301 Straight Elevator', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: 301 Straight Elevator
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/elevators-luxating-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Coupland Elevator #1', N'Oral Surgery & Extraction', N'Coupland #1 Elevator', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Coupland #1 Elevator
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/elevators-luxating-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Cryer Elevator 44', N'Oral Surgery & Extraction', N'Cryer 44 Elevator', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Cryer 44 Elevator
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/elevators-luxating-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Cryer Elevator 45', N'Oral Surgery & Extraction', N'Cryer 45 Elevator', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Cryer 45 Elevator
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/elevators-luxating-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Root Tip Pick #1', N'Oral Surgery & Extraction', N'Root Tip Pick #1', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Root Tip Pick #1
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/root-tip-picks
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Root Tip Pick #2', N'Oral Surgery & Extraction', N'Root Tip Pick #2', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Root Tip Pick #2
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/root-tip-picks
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Universal Extraction Forceps 150', N'Oral Surgery & Extraction', N'Universal Upper Forceps 150', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Universal Upper Forceps 150
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Universal Extraction Forceps 151', N'Oral Surgery & Extraction', N'Universal Lower Forceps 151', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Universal Lower Forceps 151
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Cowhorn Forceps 23', N'Oral Surgery & Extraction', N'Lower Molar Cowhorn Forceps 23', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Lower Molar Cowhorn Forceps 23
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Upper Molar Forceps 53R', N'Oral Surgery & Extraction', N'Upper Right Molar Forceps 53R', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Upper Right Molar Forceps 53R
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Upper Molar Forceps 53L', N'Oral Surgery & Extraction', N'Upper Left Molar Forceps 53L', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Upper Left Molar Forceps 53L
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Upper Molar Forceps 88R', N'Oral Surgery & Extraction', N'Upper Right Molar Forceps 88R', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Upper Right Molar Forceps 88R
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Upper Molar Forceps 88L', N'Oral Surgery & Extraction', N'Upper Left Molar Forceps 88L', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Upper Left Molar Forceps 88L
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Root Forceps 65', N'Oral Surgery & Extraction', N'Upper Root Forceps 65', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Upper Root Forceps 65
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Root Fragment Forceps 69', N'Oral Surgery & Extraction', N'Root Fragment Forceps 69', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Root Fragment Forceps 69
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Pediatric Extraction Forceps 150S', N'Oral Surgery & Extraction', N'Pediatric Upper Forceps 150S', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Pediatric Upper Forceps 150S
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Pediatric Extraction Forceps 151S', N'Oral Surgery & Extraction', N'Pediatric Lower Forceps 151S', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Pediatric Lower Forceps 151S
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/extraction-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Mayo-Hegar Needle Holder', N'Oral Surgery & Extraction', N'Mayo-Hegar Needle Holder', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Mayo-Hegar Needle Holder
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/needle-holders
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Castroviejo Needle Holder', N'Oral Surgery & Extraction', N'Castroviejo Needle Holder', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Castroviejo Needle Holder
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/needle-holders
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Curved Kelly Hemostat', N'Oral Surgery & Extraction', N'Curved Kelly Hemostat', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Curved Kelly Hemostat
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/hemostats
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Curved Mosquito Hemostat', N'Oral Surgery & Extraction', N'Curved Mosquito Hemostat', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Curved Mosquito Hemostat
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/hemostats
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Adson 1x2 Tissue Forceps', N'Oral Surgery & Extraction', N'Adson 1x2 Tissue Forceps', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Adson 1x2 Tissue Forceps
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/tissue-forceps
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Plain Micro Tissue Pliers', N'Oral Surgery & Extraction', N'Plain Straight Micro Tissue Pliers, Diamond Dusted (8-905DD)', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Plain Straight Micro Tissue Pliers, Diamond Dusted (8-905DD)
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/tissue-forceps/plain-straight-micro-tissue-pliers-diamond-dusted
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Dean Suture Scissors', N'Oral Surgery & Extraction', N'Dean Suture Scissors', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Dean Suture Scissors
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/scissors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Curved Iris Scissors', N'Oral Surgery & Extraction', N'Curved Iris Scissors', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Curved Iris Scissors
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/scissors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Metzenbaum Scissors', N'Oral Surgery & Extraction', N'Curved Metzenbaum Scissors', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Curved Metzenbaum Scissors
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/scissors
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Frazier Suction Tube', N'Oral Surgery & Extraction', N'Frazier Suction Tube', N'Bright Smile Dental', N'Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Manufacturer: HuFriedyGroup
Model: Frazier Suction Tube
Notes: Reusable surgical instrument. Include in the appropriate procedure cassette and verify function before use.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/surgical-aspirators
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Castroviejo Bone Caliper', N'Implant & Bone Management', N'Castroviejo Bone Caliper', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Castroviejo Bone Caliper
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/calipers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Boley Gauge', N'Implant & Bone Management', N'Boley Gauge', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Boley Gauge
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Reusable dental instrument. Clean, inspect, package and sterilize after each patient according to the manufacturer instructions.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/calipers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Implant Probe', N'Implant & Bone Management', N'Plastic Implant Probe', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Plastic Implant Probe
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Use only as intended around implant components. Avoid scratching implant surfaces and inspect the working end before use.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/implant-maintenance
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Titanium Implant Scaler', N'Implant & Bone Management', N'Titanium Implant Scaler', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Titanium Implant Scaler
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Use only as intended around implant components. Avoid scratching implant surfaces and inspect the working end before use.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/implant-maintenance
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Titanium Implant Curette 11/12', N'Implant & Bone Management', N'Titanium Implant Curette 11/12', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Titanium Implant Curette 11/12
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Use only as intended around implant components. Avoid scratching implant surfaces and inspect the working end before use.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/implant-maintenance
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Periotome 1/2', N'Implant & Bone Management', N'Periotome 1/2', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Periotome 1/2
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/periotomes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Luxating Elevator 3 mm Straight', N'Implant & Bone Management', N'3 mm Straight Luxating Elevator', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: 3 mm Straight Luxating Elevator
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/elevators-luxating-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Luxating Elevator 4 mm Curved', N'Implant & Bone Management', N'4 mm Curved Luxating Elevator', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: 4 mm Curved Luxating Elevator
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/elevators-luxating-instruments
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Surgical Mallet', N'Implant & Bone Management', N'Stainless Steel Surgical Mallet', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Stainless Steel Surgical Mallet
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/mallets
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Bone Condenser', N'Implant & Bone Management', N'Double-Ended Bone Condenser', N'Bright Smile Dental', N'Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Manufacturer: HuFriedyGroup
Model: Double-Ended Bone Condenser
Notes: Reusable implant or bone-management instrument. Verify compatibility with the implant system and procedure.', N'Surgical sharp. Inspect alignment and cutting edges before use; transport in a closed cassette and sterilize before each procedure.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/bone-condensers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Weingart Utility Pliers', N'Orthodontic & Pediatric', N'Weingart Pliers (678-201)', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Weingart Pliers (678-201)
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/orthodontic-pliers/weingart-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Straight How Pliers', N'Orthodontic & Pediatric', N'Straight How Pliers (678-203)', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Straight How Pliers (678-203)
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/orthodontic-pliers/straight-how-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Bird Beak Pliers', N'Orthodontic & Pediatric', N'Bird Beak Pliers (678-304)', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Bird Beak Pliers (678-304)
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/documents/2426
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Distal End Cutter', N'Orthodontic & Pediatric', N'Distal End Cutter', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Distal End Cutter
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/pliers-8088
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Ligature Cutter', N'Orthodontic & Pediatric', N'Ligature Cutter', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Ligature Cutter
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Sharp cutting edges. Wear eye protection and keep the working end directed away from staff and patients.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/pliers-8088
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Bracket Removing Pliers', N'Orthodontic & Pediatric', N'Bracket Removing Pliers', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Bracket Removing Pliers
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/pliers-8088
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Crown and Band Contouring Pliers', N'Orthodontic & Pediatric', N'Slim Crown and Band Contouring Pliers (678-221)', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Slim Crown and Band Contouring Pliers (678-221)
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/documents/2426
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Mini Three-Jaw Pliers', N'Orthodontic & Pediatric', N'Mini Three-Jaw Pliers (678-312)', N'Bright Smile Dental', N'Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Manufacturer: HuFriedyGroup
Model: Mini Three-Jaw Pliers (678-312)
Notes: Reusable orthodontic or pediatric instrument for limited orthodontic procedures, appliance adjustment or stainless-steel crown work.', N'Hinged instrument. Clean and sterilize in the open position; lubricate the joint only with an approved instrument lubricant.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/collections-kits/dr-josh-wren-pediatric-kit
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Utility Pick-Up Dressing Pliers', N'Instrument Handling & Cassettes', N'U17 Utility Pick-Up Dressing Pliers (DPU17)', N'Bright Smile Dental', N'Used to transport contaminated items while reducing direct handling.', N'Manufacturer: HuFriedyGroup
Model: U17 Utility Pick-Up Dressing Pliers (DPU17)
Notes: Used to transport contaminated items while reducing direct handling.', N'Sharp working end. Handle with care, use puncture-resistant transport and remove from service if bent, damaged or corroded.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/cotton-dressing-pliers/u17-utility-pick-dressing-pliers
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'10-Instrument Procedure Cassette', N'Instrument Handling & Cassettes', N'IMS Signature Series 10-Instrument Cassette', N'Bright Smile Dental', N'Reusable cassette for organizing and protecting instruments during cleaning and sterilization.', N'Manufacturer: HuFriedyGroup
Model: IMS Signature Series 10-Instrument Cassette
Notes: Reusable cassette for organizing and protecting instruments during cleaning and sterilization.', N'Do not overload. Verify latches and silicone rails; position hinged instruments open for processing.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/instrument-management-cassettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'5-Instrument Exam Cassette', N'Instrument Handling & Cassettes', N'IMS Signature Series 5-Instrument Cassette', N'Bright Smile Dental', N'Reusable cassette for diagnostic instrument setups.', N'Manufacturer: HuFriedyGroup
Model: IMS Signature Series 5-Instrument Cassette
Notes: Reusable cassette for diagnostic instrument setups.', N'Do not overload. Verify latches and silicone rails before processing.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/instrument-management-cassettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Surgical Instrument Cassette', N'Instrument Handling & Cassettes', N'IMS Surgical Instrument Cassette', N'Bright Smile Dental', N'Reusable cassette for extraction and surgical setups.', N'Manufacturer: HuFriedyGroup
Model: IMS Surgical Instrument Cassette
Notes: Reusable cassette for extraction and surgical setups.', N'Confirm that sharp tips are fully contained and the cassette closes without force.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/instrument-management-cassettes
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets'),
    (N'Instrument Stringer', N'Instrument Handling & Cassettes', N'Stainless Steel Instrument Stringer', N'Bright Smile Dental', N'Holds hinged instruments open during cleaning and sterilization.', N'Manufacturer: HuFriedyGroup
Model: Stainless Steel Instrument Stringer
Notes: Holds hinged instruments open during cleaning and sterilization.', N'Do not overload. Inspect the locking mechanism and ensure instruments remain open during processing.', NULL, NULL, N'Product reference | https://www.hufriedygroup.com/en/products/categories/instrument-management
Instrument reprocessing guide | https://www.hufriedygroup.com/en/compliance-sheets');


DECLARE @Utilities TABLE (
    UtilityName NVARCHAR(255), Category NVARCHAR(255), Provider NVARCHAR(255), Service NVARCHAR(255), AccountNumber NVARCHAR(255),
    ServiceStartDate DATE, ContractTerm NVARCHAR(100), OfficeName NVARCHAR(255), ContractEndDate DATE, MonthlyCost DECIMAL(12,2),
    ImageUrl NVARCHAR(MAX), DocumentUrl NVARCHAR(MAX), Notes NVARCHAR(MAX), Warnings NVARCHAR(MAX)
);
INSERT INTO @Utilities (UtilityName, Category, Provider, Service, AccountNumber, ServiceStartDate, ContractTerm, OfficeName, ContractEndDate, MonthlyCost, ImageUrl, DocumentUrl, Notes, Warnings)
VALUES
    (N'Curve Dental Practice Management Software', N'Practice Management Software', N'Curve Dental', N'Curve Dental', N'HYP-CURVE-482901', CONVERT(date, '2025-08-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-07-31'), 899.00, NULL, NULL, N'Cloud practice-management subscription. Hypothetical billing is monthly by autopay.', N'Auto-renews annually unless cancelled in writing at least 60 days before renewal.'),
    (N'Weave Phone, Texting and Patient Communication', N'Phone & Communications', N'Weave', N'Weave', N'HYP-WEAVE-613820', CONVERT(date, '2025-09-15'), N'36 Months', N'Bright Smile Dental', CONVERT(date, '2028-09-14'), 749.00, NULL, NULL, N'Business phones, texting, call analytics and patient communication. Hypothetical account.', N'Early-termination fees may apply. Confirm number-porting ownership and cancellation terms.'),
    (N'Microsoft 365 Business Subscription', N'Business Software', N'Microsoft 365', N'Xpress Computer Services', N'HYP-MS365-947120', CONVERT(date, '2025-07-01'), N'Annual', N'Bright Smile Dental', CONVERT(date, '2026-06-30'), 176.00, NULL, NULL, N'Hypothetical license allowance for office computers and administrative users. Xpress administers the tenant.', N'Licenses may auto-renew. Remove terminated users promptly and retain administrator access.'),
    (N'Google Workspace Business Subscription', N'Business Software', N'Google Workspace', N'Xpress Computer Services', N'HYP-GWS-381774', CONVERT(date, '2025-07-01'), N'Annual', N'Bright Smile Dental', CONVERT(date, '2026-06-30'), 126.00, NULL, NULL, N'Hypothetical email and collaboration subscription for Bright Smile Dental.', N'Protect the super-administrator account with multifactor authentication and recovery controls.'),
    (N'Torch Orders Procurement Platform', N'Procurement Software', N'Torch Orders', N'Torch Orders', N'HYP-TORCH-205731', CONVERT(date, '2025-10-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-09-30'), 299.00, NULL, NULL, N'Dental-supply purchasing and order-management subscription. Hypothetical rate.', N'Confirm renewal pricing, user limits and data-export rights before renewal.'),
    (N'Comcast Business Internet', N'Internet & Network', N'Comcast/Xfinity', N'Comcast/Xfinity', N'HYP-COMCAST-710284', CONVERT(date, '2025-08-12'), N'36 Months', N'Bright Smile Dental', CONVERT(date, '2028-08-11'), 289.00, NULL, NULL, N'Primary business internet connection with static IP service. Hypothetical account and pricing.', N'Early-termination fees may apply. Document modem ownership, static IPs and outage support number.'),
    (N'Verizon Business Wireless Service', N'Phone & Communications', N'Verizon', N'Verizon', N'HYP-VZW-993105', CONVERT(date, '2025-11-01'), N'24 Months', N'Bright Smile Dental', CONVERT(date, '2027-10-31'), 185.00, NULL, NULL, N'Hypothetical wireless plan for manager and emergency business devices.', N'Review device-payment balances and line-cancellation fees before changing carriers.'),
    (N'Electric Utility Service', N'Electric Utility', N'Dominion Energy Virginia', N'Dominion Energy Virginia', N'HYP-DOM-584920', CONVERT(date, '2025-07-10'), N'No Fixed Term', N'Bright Smile Dental', NULL, 1350.00, NULL, NULL, N'Hypothetical average monthly electric cost; actual billing varies with usage and season.', N'Variable utility cost. Track unusual consumption and preserve outage and emergency contact information.'),
    (N'Natural Gas Utility Service', N'Natural Gas Utility', N'Washington Gas', N'Washington Gas', N'HYP-WGAS-274610', CONVERT(date, '2025-07-10'), N'No Fixed Term', N'Bright Smile Dental', NULL, 190.00, NULL, NULL, N'Hypothetical average monthly natural-gas cost; actual billing varies by season and usage.', N'Gas leak emergency: evacuate, avoid switches or ignition sources and contact the utility from a safe location.'),
    (N'ADT Intrusion and Fire Alarm Monitoring', N'Security & Monitoring', N'ADT Security', N'ADT Security', N'HYP-ADT-ALARM-903416', CONVERT(date, '2025-07-15'), N'36 Months', N'Bright Smile Dental', CONVERT(date, '2028-07-14'), 139.00, NULL, NULL, N'Hypothetical monitoring agreement for intrusion and connected life-safety devices.', N'Auto-renewal and early-termination provisions may apply. Keep emergency contacts and passcodes current.'),
    (N'ADT Video Surveillance Cloud Service', N'Security & Monitoring', N'ADT Security', N'ADT Security', N'HYP-ADT-VIDEO-447521', CONVERT(date, '2025-07-15'), N'36 Months', N'Bright Smile Dental', CONVERT(date, '2028-07-14'), 119.00, NULL, NULL, N'Hypothetical cloud recording and remote video-access subscription.', N'Set retention rules carefully. Cameras must not capture protected clinical information or private areas.'),
    (N'Commercial Trash Collection', N'Waste & Recycling', N'Republic Services', N'Republic Services', N'HYP-REP-TRASH-635117', CONVERT(date, '2025-08-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-07-31'), 285.00, NULL, NULL, N'Hypothetical twice-weekly commercial trash pickup.', N'Contract may auto-renew. Overfill, contamination and extra-pickup charges may apply.'),
    (N'Commercial Recycling Collection', N'Waste & Recycling', N'Republic Services', N'Republic Services', N'HYP-REP-RECYCLE-822436', CONVERT(date, '2025-08-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-07-31'), 115.00, NULL, NULL, N'Hypothetical weekly mixed-recycling pickup.', N'Contaminated loads may be rejected or assessed additional fees.'),
    (N'Biohazard and Regulated Medical Waste Pickup', N'Biohazard & Medical Waste', N'MedPro Waste Disposal', N'MedPro Waste Disposal', N'HYP-MEDPRO-741926', CONVERT(date, '2025-09-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-08-31'), 189.00, NULL, NULL, N'Hypothetical scheduled pickup for regulated medical waste and sharps containers.', N'Retain manifests and training records. Do not place pharmaceutical, chemical or amalgam waste in standard biohazard containers.'),
    (N'Managed IT Support', N'IT & Cybersecurity', N'Xpress Computer Services', N'Xpress Computer Services', N'HYP-XPRESS-MSP-418503', CONVERT(date, '2025-07-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-06-30'), 795.00, NULL, NULL, N'Hypothetical managed IT agreement covering help desk, device monitoring and routine maintenance.', N'Confirm response times, after-hours charges, excluded projects and ownership of all administrator credentials.'),
    (N'Endpoint Security and Cloud Backup', N'IT & Cybersecurity', N'Xpress Computer Services', N'Xpress Computer Services', N'HYP-XPRESS-SEC-561708', CONVERT(date, '2025-07-01'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-06-30'), 385.00, NULL, NULL, N'Hypothetical managed endpoint protection, backup monitoring and recovery testing.', N'A backup that is never tested is worthless. Require documented restore testing and offsite retention.'),
    (N'Commercial Pest-Control Service', N'Building & Facility Services', N'Permatreat Pest Control', N'Permatreat Pest Control', N'HYP-PERMA-150294', CONVERT(date, '2025-08-20'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-08-19'), 95.00, NULL, NULL, N'Hypothetical quarterly preventive pest-control plan, billed monthly.', N'Require notice before chemical application and keep service reports for facility records.'),
    (N'Merchant Payment Processing Service', N'Banking & Merchant Services', N'Rectangle Health', N'Rectangle Health', N'HYP-RECT-890153', CONVERT(date, '2025-07-01'), N'36 Months', N'Bright Smile Dental', CONVERT(date, '2028-06-30'), 325.00, NULL, NULL, N'Hypothetical fixed monthly platform and terminal cost. Processing percentage fees are not included.', N'Do not evaluate this contract using the monthly fee alone. Review percentage rates, PCI fees, chargeback fees and termination penalties.'),
    (N'Medical Oxygen Cylinder Rental and Exchange', N'Medical Gas Service', N'Dalco Medical Products', N'Dalco Medical Products', N'HYP-DALCO-O2-775421', CONVERT(date, '2025-10-15'), N'12 Months', N'Bright Smile Dental', CONVERT(date, '2026-10-14'), 85.00, NULL, NULL, N'Hypothetical cylinder rental and exchange service for the emergency oxygen system.', N'Secure cylinders upright, separate full and empty cylinders and keep oxygen away from oil, heat and ignition sources.'),
    (N'Dental X-Ray Equipment Registration', N'Compliance & Licensing', N'Virginia Department of Health – Office of Radiological Health', N'Virginia Department of Health – Office of Radiological Health', N'HYP-VDH-XRAY-620715', CONVERT(date, '2025-07-01'), N'Annual', N'Bright Smile Dental', CONVERT(date, '2026-06-30'), 28.00, NULL, NULL, N'Hypothetical monthly equivalent of an annual registration or regulatory fee.', N'Regulatory deadlines are not optional. Replace the hypothetical dates and fee with the actual registration certificate and renewal date.');


DECLARE @MissingClinics TABLE (OfficeName NVARCHAR(255) PRIMARY KEY);
INSERT INTO @MissingClinics (OfficeName)
SELECT DISTINCT OfficeName FROM (
    SELECT OfficeName FROM @DentalEquipment
    UNION SELECT OfficeName FROM @OfficeEquipment
    UNION SELECT OfficeName FROM @Supplies
    UNION SELECT OfficeName FROM @Instruments
    UNION SELECT OfficeName FROM @Utilities
) offices
WHERE OfficeName IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.Clinics c WHERE LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(offices.OfficeName))));

IF EXISTS (SELECT 1 FROM @MissingClinics)
BEGIN
    SELECT 'Missing clinic; create or rename this clinic before running import' AS Issue, OfficeName FROM @MissingClinics;
    THROW 51010, 'Import stopped because one or more Office values do not match dbo.Clinics.Name.', 1;
END;

IF NULLIF(LTRIM(RTRIM(@AppUsername)), N'') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL THROW 51011, 'Missing dbo.Users table; cannot link app user to imported clinic.', 1;
    IF OBJECT_ID(N'dbo.UserClinics', N'U') IS NULL THROW 51012, 'Missing dbo.UserClinics table; cannot link app user to imported clinic.', 1;

    DECLARE @ImportUserId INT;
    SELECT TOP 1 @ImportUserId = u.Id
    FROM dbo.Users u
    WHERE LOWER(LTRIM(RTRIM(u.Username))) = LOWER(LTRIM(RTRIM(@AppUsername)))
    ORDER BY u.Id;

    IF @ImportUserId IS NULL THROW 51013, 'The @AppUsername value was not found in dbo.Users.Username.', 1;

    INSERT INTO dbo.UserClinics (UserId, ClinicId)
    SELECT @ImportUserId, c.Id
    FROM (
        SELECT OfficeName FROM @DentalEquipment
        UNION SELECT OfficeName FROM @OfficeEquipment
        UNION SELECT OfficeName FROM @Supplies
        UNION SELECT OfficeName FROM @Instruments
        UNION SELECT OfficeName FROM @Utilities
    ) offices
    JOIN dbo.Clinics c ON LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(offices.OfficeName)))
    WHERE offices.OfficeName IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.UserClinics uc
          WHERE uc.UserId = @ImportUserId
            AND uc.ClinicId = c.Id
      );

    SELECT 'Linked app user to imported clinic access' AS Item, @AppUsername AS Username, @@ROWCOUNT AS NewLinksAdded;
END
ELSE
BEGIN
    SELECT 'Set @AppUsername near the top of this script, then rerun it so the imported rows are visible in the app.' AS ImportVisibilityNote;
END;

INSERT INTO dbo.Equipment (Name, Category, Brand, Model, SerialNumber, Description, ClinicId, RoomId, PurchaseDate, PurchasePrice, WarrantyExpiry, Status, Condition, ServiceVendor, VendorId, Notes, Warnings, ImageUrl, DocumentUrl, IsActive, CreatedDate, ModifiedDate)
SELECT s.Name, s.Category, s.Brand, s.Model, s.SerialNumber, s.Model, c.Id, roomMatch.Id, s.PurchaseDate, s.PurchasePrice, s.WarrantyExpiry, N'Operational', s.Condition, s.ServiceVendor, vendorMatch.Id, s.Notes, s.Warnings, s.ImageUrl, s.DocumentUrl, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM @DentalEquipment s
JOIN dbo.Clinics c ON LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(s.OfficeName)))
OUTER APPLY (SELECT TOP 1 r.Id FROM dbo.Rooms r WHERE r.ClinicId = c.Id AND LOWER(LTRIM(RTRIM(r.Name))) = LOWER(LTRIM(RTRIM(s.RoomName))) ORDER BY r.Id) roomMatch
OUTER APPLY (SELECT TOP 1 v.Id FROM dbo.Vendors v WHERE LOWER(LTRIM(RTRIM(v.Name))) = LOWER(LTRIM(RTRIM(s.ServiceVendor))) ORDER BY v.Id) vendorMatch
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Equipment e
    WHERE (s.SerialNumber IS NOT NULL AND e.SerialNumber = s.SerialNumber)
       OR (s.SerialNumber IS NULL AND e.Name = s.Name AND ISNULL(e.ClinicId, -1) = c.Id)
);

INSERT INTO dbo.OfficeEquipment (Name, Category, Brand, Model, SerialNumber, Description, ClinicId, RoomId, PurchaseDate, PurchasePrice, WarrantyExpiry, Status, Condition, ServiceVendor, VendorId, Notes, Warnings, ImageUrl, DocumentUrl, IsActive, CreatedDate, ModifiedDate)
SELECT s.Name, s.Category, s.Brand, s.Model, s.SerialNumber, s.Model, c.Id, roomMatch.Id, s.PurchaseDate, s.PurchasePrice, s.WarrantyExpiry, N'Operational', s.Condition, s.ServiceVendor, vendorMatch.Id, s.Notes, s.Warnings, s.ImageUrl, s.DocumentUrl, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM @OfficeEquipment s
JOIN dbo.Clinics c ON LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(s.OfficeName)))
OUTER APPLY (SELECT TOP 1 r.Id FROM dbo.Rooms r WHERE r.ClinicId = c.Id AND LOWER(LTRIM(RTRIM(r.Name))) = LOWER(LTRIM(RTRIM(s.RoomName))) ORDER BY r.Id) roomMatch
OUTER APPLY (SELECT TOP 1 v.Id FROM dbo.Vendors v WHERE LOWER(LTRIM(RTRIM(v.Name))) = LOWER(LTRIM(RTRIM(s.ServiceVendor))) ORDER BY v.Id) vendorMatch
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.OfficeEquipment e
    WHERE (s.SerialNumber IS NOT NULL AND e.SerialNumber = s.SerialNumber)
       OR (s.SerialNumber IS NULL AND e.Name = s.Name AND ISNULL(e.ClinicId, -1) = c.Id)
);

INSERT INTO dbo.Supplies (Name, Category, SKU, Description, Unit, QuantityInStock, MinimumStock, ReorderPoint, UnitCost, ClinicId, Notes, Warnings, ImageUrl, DocumentUrl, IsActive, SupplyType, CreatedDate, ModifiedDate)
SELECT s.Name, s.Category, NULL, s.Description, NULL, 0, 0, 0, NULL, c.Id, s.Notes, s.Warnings, s.ImageUrl, s.DocumentUrl, 1, s.SupplyType, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM @Supplies s
JOIN dbo.Clinics c ON LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(s.OfficeName)))
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Supplies existing
    WHERE existing.Name = s.Name
      AND ISNULL(existing.Category, N'') = ISNULL(s.Category, N'')
      AND ISNULL(existing.ClinicId, -1) = c.Id
      AND ISNULL(existing.SupplyType, N'') = ISNULL(s.SupplyType, N'')
);

INSERT INTO dbo.Instruments (Name, SkuNumber, Category, Description, Quantity, ClinicId, SterilizationRequired, Status, Notes, Warnings, ImageUrl, DocumentUrl, Links, CreatedDate, ModifiedDate)
SELECT s.Name, s.SkuNumber, s.Category, s.Description, 1, c.Id, 1, N'available', s.Notes, s.Warnings, s.ImageUrl, s.DocumentUrl, s.Links, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM @Instruments s
JOIN dbo.Clinics c ON LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(s.OfficeName)))
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Instruments existing
    WHERE existing.Name = s.Name
      AND ISNULL(existing.Category, N'') = ISNULL(s.Category, N'')
      AND ISNULL(existing.ClinicId, -1) = c.Id
);

INSERT INTO dbo.Utilities (UtilityName, Category, Provider, Service, AccountNumber, ServiceStartDate, ContractTerm, ClinicId, ContractEndDate, MonthlyCost, Notes, Warnings, ImageUrl, DocumentUrl, IsActive, CreatedDate, ModifiedDate)
SELECT s.UtilityName, s.Category, s.Provider, s.Service, s.AccountNumber, s.ServiceStartDate, s.ContractTerm, c.Id, s.ContractEndDate, s.MonthlyCost, s.Notes, s.Warnings, s.ImageUrl, s.DocumentUrl, 1, GETUTCDATE(), GETUTCDATE()
FROM @Utilities s
JOIN dbo.Clinics c ON LOWER(LTRIM(RTRIM(c.Name))) = LOWER(LTRIM(RTRIM(s.OfficeName)))
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Utilities existing
    WHERE existing.UtilityName = s.UtilityName
      AND ISNULL(existing.Provider, N'') = ISNULL(s.Provider, N'')
      AND ISNULL(existing.AccountNumber, N'') = ISNULL(s.AccountNumber, N'')
      AND ISNULL(existing.ClinicId, -1) = c.Id
);

SELECT 'Staged dental equipment' AS Item, COUNT(*) AS Count FROM @DentalEquipment
UNION ALL SELECT 'Staged office equipment', COUNT(*) FROM @OfficeEquipment
UNION ALL SELECT 'Staged supplies/materials', COUNT(*) FROM @Supplies
UNION ALL SELECT 'Staged instruments', COUNT(*) FROM @Instruments
UNION ALL SELECT 'Staged utilities/services', COUNT(*) FROM @Utilities;

SELECT 'Post-import Equipment rows matching uploaded serials' AS Item, COUNT(*) AS Count FROM dbo.Equipment WHERE SerialNumber IN (SELECT SerialNumber FROM @DentalEquipment WHERE SerialNumber IS NOT NULL)
UNION ALL SELECT 'Post-import OfficeEquipment rows matching uploaded serials', COUNT(*) FROM dbo.OfficeEquipment WHERE SerialNumber IN (SELECT SerialNumber FROM @OfficeEquipment WHERE SerialNumber IS NOT NULL)
UNION ALL SELECT 'Post-import Supplies rows matching upload names', COUNT(*) FROM dbo.Supplies WHERE Name IN (SELECT Name FROM @Supplies)
UNION ALL SELECT 'Post-import Instruments rows matching upload names', COUNT(*) FROM dbo.Instruments WHERE Name IN (SELECT Name FROM @Instruments)
UNION ALL SELECT 'Post-import Utilities rows matching upload names', COUNT(*) FROM dbo.Utilities WHERE UtilityName IN (SELECT UtilityName FROM @Utilities);

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
