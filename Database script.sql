/****** Object:  Database [reformdentaldb]    Script Date: 3/12/2026 10:56:06 PM ******/
CREATE DATABASE [reformdentaldb]  (EDITION = 'GeneralPurpose', SERVICE_OBJECTIVE = 'GP_S_Gen5_1', MAXSIZE = 32 GB) WITH CATALOG_COLLATION = SQL_Latin1_General_CP1_CI_AS, LEDGER = OFF;
GO
ALTER DATABASE [reformdentaldb] SET COMPATIBILITY_LEVEL = 170
GO
ALTER DATABASE [reformdentaldb] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [reformdentaldb] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [reformdentaldb] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [reformdentaldb] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [reformdentaldb] SET ARITHABORT OFF 
GO
ALTER DATABASE [reformdentaldb] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [reformdentaldb] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [reformdentaldb] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [reformdentaldb] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [reformdentaldb] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [reformdentaldb] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [reformdentaldb] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [reformdentaldb] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [reformdentaldb] SET ALLOW_SNAPSHOT_ISOLATION ON 
GO
ALTER DATABASE [reformdentaldb] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [reformdentaldb] SET READ_COMMITTED_SNAPSHOT ON 
GO
ALTER DATABASE [reformdentaldb] SET  MULTI_USER 
GO
ALTER DATABASE [reformdentaldb] SET ENCRYPTION ON
GO
ALTER DATABASE [reformdentaldb] SET QUERY_STORE = ON
GO
ALTER DATABASE [reformdentaldb] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 100, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
/*** The scripts of database scoped configurations in Azure should be executed inside the target database connection. ***/
GO
-- ALTER DATABASE SCOPED CONFIGURATION SET MAXDOP = 8;
GO
/****** Object:  Table [dbo].[Users]    Script Date: 3/12/2026 10:56:06 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](50) NOT NULL,
	[PasswordHash] [nvarchar](255) NOT NULL,
	[FirstName] [nvarchar](100) NULL,
	[MiddleName] [nvarchar](100) NULL,
	[LastName] [nvarchar](100) NULL,
	[Gender] [nvarchar](20) NULL,
	[DateOfBirth] [date] NULL,
	[PersonalEmail] [nvarchar](255) NULL,
	[WorkEmail] [nvarchar](255) NULL,
	[HomePhone] [nvarchar](20) NULL,
	[CellPhone] [nvarchar](20) NULL,
	[Address] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[State] [nvarchar](50) NULL,
	[ZipCode] [nvarchar](20) NULL,
	[JobTitle] [nvarchar](100) NULL,
	[StaffType] [nvarchar](50) NULL,
	[EmployeeType] [nvarchar](50) NULL,
	[Department] [nvarchar](100) NULL,
	[EmployeeStatus] [nvarchar](50) NULL,
	[Role] [nvarchar](50) NOT NULL,
	[HireDate] [date] NULL,
	[HourlyRate] [decimal](10, 2) NULL,
	[Salary] [decimal](12, 2) NULL,
	[Color] [nvarchar](20) NULL,
	[ProfileImage] [nvarchar](max) NULL,
	[Permissions] [nvarchar](max) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
	[IsOnline] [bit] NOT NULL,
	[LastSeen] [datetime] NULL,
	[RoleId] [int] NULL,
	[Title] [nvarchar](100) NULL,
	[SSN] [nvarchar](20) NULL,
	[EmergencyContactName] [nvarchar](150) NULL,
	[EmergencyContactRelationship] [nvarchar](100) NULL,
	[EmergencyContactPhone] [nvarchar](30) NULL,
	[EmergencyContactEmail] [nvarchar](255) NULL,
	[NextReviewDate] [date] NULL,
	[OfficeLocation] [nvarchar](150) NULL,
	[DirectSupervisor] [nvarchar](150) NULL,
	[SeparationDate] [date] NULL,
	[SeparationReason] [nvarchar](500) NULL,
	[PhotoFileName] [nvarchar](255) NULL,
	[Documents] [nvarchar](max) NULL,
	[FailedLoginAttempts] [int] NOT NULL,
	[UsernameNormalized]  AS (lower(ltrim(rtrim([Username])))) PERSISTED,
	[HRInfo] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  View [dbo].[vw_ActiveEmployees]    Script Date: 3/12/2026 10:56:06 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Active Employees with details
CREATE VIEW [dbo].[vw_ActiveEmployees] AS
SELECT 
    u.Id,
    u.Username,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS FullName,
    u.JobTitle,
    u.StaffType,
    u.Role,
    u.WorkEmail,
    u.CellPhone,
    u.Color
FROM Users u
WHERE u.IsActive = 1 AND u.EmployeeStatus = 'active';
GO
/****** Object:  Table [dbo].[Clinics]    Script Date: 3/12/2026 10:56:06 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Clinics](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Address] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[State] [nvarchar](50) NULL,
	[ZipCode] [nvarchar](20) NULL,
	[Phone] [nvarchar](20) NULL,
	[Email] [nvarchar](255) NULL,
	[Color] [nvarchar](20) NULL,
	[Icon] [nvarchar](50) NULL,
	[Description] [nvarchar](max) NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rooms]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rooms](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ClinicId] [int] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[RoomType] [nvarchar](50) NULL,
	[Description] [nvarchar](max) NULL,
	[Color] [nvarchar](20) NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Schedules]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Schedules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[ClinicId] [int] NOT NULL,
	[RoomId] [int] NULL,
	[AssistantId] [int] NULL,
	[StartDate] [date] NOT NULL,
	[EndDate] [date] NULL,
	[StartTime] [time](7) NOT NULL,
	[EndTime] [time](7) NOT NULL,
	[DaysOfWeek] [nvarchar](100) NULL,
	[Color] [nvarchar](20) NULL,
	[Notes] [nvarchar](max) NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  View [dbo].[vw_TodaySchedules]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Today's Schedules
CREATE VIEW [dbo].[vw_TodaySchedules] AS
SELECT 
    s.Id,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS EmployeeName,
    c.Name AS ClinicName,
    r.Name AS RoomName,
    s.StartTime,
    s.EndTime,
    s.DaysOfWeek
FROM Schedules s
JOIN Users u ON s.UserId = u.Id
JOIN Clinics c ON s.ClinicId = c.Id
LEFT JOIN Rooms r ON s.RoomId = r.Id
WHERE s.IsActive = 1
    AND CAST(GETDATE() AS DATE) BETWEEN s.StartDate AND ISNULL(s.EndDate, '2099-12-31')
    AND s.DaysOfWeek LIKE '%' + LEFT(DATENAME(WEEKDAY, GETDATE()), 3) + '%';
GO
/****** Object:  Table [dbo].[Tasks]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Tasks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](50) NULL,
	[Priority] [nvarchar](20) NOT NULL,
	[Status] [nvarchar](50) NOT NULL,
	[DueDate] [date] NULL,
	[DueTime] [time](7) NULL,
	[AssignedToId] [int] NULL,
	[AssignedById] [int] NULL,
	[ClinicId] [int] NULL,
	[CompletedDate] [datetime2](7) NULL,
	[CompletedById] [int] NULL,
	[Notes] [nvarchar](max) NULL,
	[Tags] [nvarchar](max) NULL,
	[IsRecurring] [bit] NULL,
	[RecurrenceRule] [nvarchar](255) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[TaskType] [nvarchar](20) NULL,
	[IsPaid] [bit] NULL,
	[PayAmount] [decimal](10, 2) NULL,
	[Location] [nvarchar](100) NULL,
	[TimeEstimate] [nvarchar](50) NULL,
	[Assignee] [nvarchar](100) NULL,
	[ClaimedBy] [nvarchar](100) NULL,
	[ClaimedAt] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  View [dbo].[vw_PendingTasks]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Pending Tasks
CREATE VIEW [dbo].[vw_PendingTasks] AS
SELECT 
    t.Id,
    t.Title,
    t.Category,
    t.Priority,
    t.DueDate,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS AssignedTo,
    c.Name AS ClinicName
FROM Tasks t
LEFT JOIN Users u ON t.AssignedToId = u.Id
LEFT JOIN Clinics c ON t.ClinicId = c.Id
WHERE t.Status IN ('Pending', 'In Progress');
GO
/****** Object:  Table [dbo].[Supplies]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Supplies](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Category] [nvarchar](100) NULL,
	[SKU] [nvarchar](50) NULL,
	[Description] [nvarchar](max) NULL,
	[Unit] [nvarchar](50) NULL,
	[QuantityInStock] [int] NULL,
	[MinimumStock] [int] NULL,
	[ReorderPoint] [int] NULL,
	[UnitCost] [decimal](10, 2) NULL,
	[ClinicId] [int] NULL,
	[StorageLocation] [nvarchar](100) NULL,
	[VendorId] [int] NULL,
	[ExpirationDate] [date] NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[Notes] [nvarchar](max) NULL,
	[Warnings] [nvarchar](max) NULL,
	[ImageUrl] [nvarchar](max) NULL,
	[DocumentUrl] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  View [dbo].[vw_LowStockSupplies]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Low Stock Supplies
CREATE VIEW [dbo].[vw_LowStockSupplies] AS
SELECT 
    s.Id,
    s.Name,
    s.Category,
    s.QuantityInStock,
    s.MinimumStock,
    s.ReorderPoint,
    c.Name AS ClinicName
FROM Supplies s
LEFT JOIN Clinics c ON s.ClinicId = c.Id
WHERE s.QuantityInStock <= s.ReorderPoint AND s.IsActive = 1;
GO
/****** Object:  Table [dbo].[ComplianceTypes]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplianceTypes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](50) NOT NULL,
	[RequiresEmployee] [bit] NULL,
	[RequiresClinic] [bit] NULL,
	[DefaultExpiryMonths] [int] NULL,
	[IsActive] [bit] NULL,
	[Color] [nvarchar](20) NULL,
	[Icon] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Compliances]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Compliances](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ComplianceTypeId] [int] NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[UserId] [int] NULL,
	[ClinicId] [int] NULL,
	[IssueDate] [datetime2](7) NOT NULL,
	[ExpiryDate] [datetime2](7) NULL,
	[ReminderDate] [datetime2](7) NULL,
	[Status] [nvarchar](50) NULL,
	[Priority] [nvarchar](20) NULL,
	[AttachmentUrl] [nvarchar](max) NULL,
	[AttachmentName] [nvarchar](255) NULL,
	[DocumentType] [nvarchar](100) NULL,
	[ReferenceNumber] [nvarchar](100) NULL,
	[IssuingAuthority] [nvarchar](255) NULL,
	[Cost] [decimal](10, 2) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedById] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedById] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  View [dbo].[vw_ActiveCompliances]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Active Compliances
CREATE VIEW [dbo].[vw_ActiveCompliances] AS
SELECT
    c.Id,
    ct.Name AS ComplianceType,
    ct.Category,
    c.Title,
    c.Description,
    c.IssueDate,
    c.ExpiryDate,
    c.Status,
    c.Priority,
    CASE
        WHEN c.UserId IS NOT NULL THEN u.FirstName + ' ' + ISNULL(u.LastName, '')
        ELSE cl.Name
    END AS AssignedTo,
    c.AttachmentUrl,
    c.ReferenceNumber,
    DATEDIFF(DAY, GETDATE(), c.ExpiryDate) AS DaysUntilExpiry
FROM Compliances c
JOIN ComplianceTypes ct ON c.ComplianceTypeId = ct.Id
LEFT JOIN Users u ON c.UserId = u.Id
LEFT JOIN Clinics cl ON c.ClinicId = cl.Id
WHERE c.Status = 'active' AND ct.IsActive = 1;
GO
/****** Object:  View [dbo].[vw_ExpiringCompliances]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Expiring Compliances (next 30 days)
CREATE VIEW [dbo].[vw_ExpiringCompliances] AS
SELECT * FROM vw_ActiveCompliances
WHERE DaysUntilExpiry <= 30 AND DaysUntilExpiry >= 0;
GO
/****** Object:  View [dbo].[vw_ExpiredCompliances]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Expired Compliances
CREATE VIEW [dbo].[vw_ExpiredCompliances] AS
SELECT * FROM vw_ActiveCompliances
WHERE DaysUntilExpiry < 0;
GO
/****** Object:  View [dbo].[vw_EmployeeCompliances]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- View: Compliances by Employee
CREATE VIEW [dbo].[vw_EmployeeCompliances] AS
SELECT
    u.Id AS UserId,
    u.FirstName + ' ' + ISNULL(u.LastName, '') AS EmployeeName,
    u.JobTitle,
    COUNT(c.Id) AS TotalCompliances,
    COUNT(CASE WHEN c.Status = 'active' AND c.ExpiryDate > GETDATE() THEN 1 END) AS ActiveCompliances,
    COUNT(CASE WHEN c.ExpiryDate <= GETDATE() THEN 1 END) AS ExpiredCompliances,
    MIN(DATEDIFF(DAY, GETDATE(), c.ExpiryDate)) AS ClosestExpiryDays
FROM Users u
LEFT JOIN Compliances c ON u.Id = c.UserId AND c.Status = 'active'
WHERE u.IsActive = 1 AND u.EmployeeStatus = 'active'
GROUP BY u.Id, u.FirstName, u.LastName, u.JobTitle;
GO
/****** Object:  Table [dbo].[AttendanceAbsences]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceAbsences](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[DisplayName] [nvarchar](255) NULL,
	[WorkDate] [date] NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[RecordedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendanceAbsences_Backup]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceAbsences_Backup](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[DisplayName] [nvarchar](255) NULL,
	[WorkDate] [date] NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[RecordedAt] [datetime2](7) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendanceNotifications]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceNotifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[Message] [nvarchar](1000) NOT NULL,
	[NotificationType] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendanceNotifications_Backup]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceNotifications_Backup](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[Message] [nvarchar](1000) NOT NULL,
	[NotificationType] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendancePolicies]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendancePolicies](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[AllowFlex] [bit] NOT NULL,
	[BeforeMins] [int] NOT NULL,
	[AfterMins] [int] NOT NULL,
	[ModifiedBy] [nvarchar](255) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendancePolicies_Backup]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendancePolicies_Backup](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[AllowFlex] [bit] NOT NULL,
	[BeforeMins] [int] NOT NULL,
	[AfterMins] [int] NOT NULL,
	[ModifiedBy] [nvarchar](255) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendanceRecords]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceRecords](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[LocalRecordId] [nvarchar](120) NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](150) NOT NULL,
	[DisplayName] [nvarchar](255) NULL,
	[WorkDate] [date] NOT NULL,
	[ScheduledStart] [time](7) NULL,
	[ScheduledEnd] [time](7) NULL,
	[ClockIn] [datetime2](7) NULL,
	[ClockOut] [datetime2](7) NULL,
	[MinutesWorked] [int] NOT NULL,
	[FlagsJson] [nvarchar](max) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendanceRecords_Backup]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceRecords_Backup](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[LocalRecordId] [nvarchar](120) NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](150) NOT NULL,
	[DisplayName] [nvarchar](255) NULL,
	[WorkDate] [date] NOT NULL,
	[ScheduledStart] [time](7) NULL,
	[ScheduledEnd] [time](7) NULL,
	[ClockIn] [datetime2](7) NULL,
	[ClockOut] [datetime2](7) NULL,
	[MinutesWorked] [int] NOT NULL,
	[FlagsJson] [nvarchar](max) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AuditLog]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AuditLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TableName] [nvarchar](100) NOT NULL,
	[RecordId] [int] NOT NULL,
	[Action] [nvarchar](50) NOT NULL,
	[UserId] [int] NULL,
	[OldValues] [nvarchar](max) NULL,
	[NewValues] [nvarchar](max) NULL,
	[IPAddress] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Categories]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Categories](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[CategoryType] [nvarchar](50) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[SortOrder] [int] NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedDate] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ChatMessageAttachments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChatMessageAttachments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MessageId] [int] NOT NULL,
	[FileName] [nvarchar](255) NOT NULL,
	[ContentType] [nvarchar](200) NOT NULL,
	[FileSize] [int] NOT NULL,
	[FileData] [nvarchar](max) NOT NULL,
	[CreatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ChatMessages]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChatMessages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SenderId] [int] NOT NULL,
	[ReceiverId] [int] NOT NULL,
	[Message] [nvarchar](max) NOT NULL,
	[SentAt] [datetime] NULL,
	[IsRead] [bit] NULL,
	[ReadAt] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ClinicWorkingHours]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ClinicWorkingHours](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ClinicId] [int] NOT NULL,
	[DayKey] [nvarchar](20) NOT NULL,
	[IsOpen] [bit] NOT NULL,
	[OpenTime] [time](7) NULL,
	[CloseTime] [time](7) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CopilotConversationMessages]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CopilotConversationMessages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConversationPkId] [int] NOT NULL,
	[Role] [nvarchar](20) NOT NULL,
	[Content] [nvarchar](max) NOT NULL,
	[MessageOrder] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CopilotConversations]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CopilotConversations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[ConversationId] [nvarchar](100) NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[IsDeleted] [bit] NOT NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Duties]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Duties](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[Schedule] [nvarchar](50) NULL,
	[ScheduleTime] [nvarchar](50) NULL,
	[ScheduleDay] [nvarchar](50) NULL,
	[Location] [nvarchar](100) NULL,
	[Priority] [nvarchar](20) NULL,
	[AssignedToUserId] [int] NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedDate] [datetime] NULL,
	[IsActive] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Equipment]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Equipment](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Category] [nvarchar](100) NULL,
	[Brand] [nvarchar](100) NULL,
	[Model] [nvarchar](100) NULL,
	[SerialNumber] [nvarchar](100) NULL,
	[Description] [nvarchar](max) NULL,
	[ClinicId] [int] NULL,
	[RoomId] [int] NULL,
	[PurchaseDate] [date] NULL,
	[PurchasePrice] [decimal](12, 2) NULL,
	[WarrantyExpiry] [date] NULL,
	[Status] [nvarchar](50) NULL,
	[MaintenanceSchedule] [nvarchar](50) NULL,
	[LastMaintenanceDate] [date] NULL,
	[NextMaintenanceDate] [date] NULL,
	[VendorId] [int] NULL,
	[Notes] [nvarchar](max) NULL,
	[ImageUrl] [nvarchar](max) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[Warnings] [nvarchar](max) NULL,
	[DocumentUrl] [nvarchar](max) NULL,
	[ServiceIntervalDays] [int] NULL,
	[LastServiceDate] [date] NULL,
	[NextServiceDate] [date] NULL,
	[ServiceVendor] [nvarchar](120) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EquipmentServiceTickets]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EquipmentServiceTickets](
	[Id] [uniqueidentifier] NOT NULL,
	[EquipmentId] [int] NOT NULL,
	[ServiceType] [nvarchar](30) NOT NULL,
	[Priority] [nvarchar](20) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ScheduledDate] [date] NULL,
	[CompletedDate] [date] NULL,
	[Vendor] [nvarchar](120) NULL,
	[Cost] [decimal](12, 2) NULL,
	[Description] [nvarchar](500) NULL,
	[Notes] [nvarchar](max) NULL,
	[IsAutoGenerated] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Events]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Events](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[EventType] [nvarchar](50) NULL,
	[StartDateTime] [datetime2](7) NOT NULL,
	[EndDateTime] [datetime2](7) NOT NULL,
	[AllDay] [bit] NULL,
	[UserId] [int] NULL,
	[ClinicId] [int] NULL,
	[RoomId] [int] NULL,
	[Color] [nvarchar](20) NULL,
	[Priority] [nvarchar](20) NULL,
	[Status] [nvarchar](50) NULL,
	[RecurrenceRule] [nvarchar](255) NULL,
	[CreatedBy] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[EventDate] [date] NULL,
	[StartTime] [nvarchar](20) NULL,
	[EndTime] [nvarchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Instruments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Instruments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Category] [nvarchar](100) NULL,
	[Description] [nvarchar](max) NULL,
	[Quantity] [int] NULL,
	[ClinicId] [int] NULL,
	[SterilizationRequired] [bit] NULL,
	[Status] [nvarchar](50) NULL,
	[PurchaseDate] [date] NULL,
	[UnitCost] [decimal](10, 2) NULL,
	[VendorId] [int] NULL,
	[ImageUrl] [nvarchar](max) NULL,
	[Icon] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[Notes] [nvarchar](max) NULL,
	[Warnings] [nvarchar](max) NULL,
	[DocumentUrl] [nvarchar](max) NULL,
	[SkuNumber] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProcedureInstruments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProcedureInstruments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProcedureId] [int] NOT NULL,
	[InstrumentId] [int] NOT NULL,
	[Quantity] [int] NULL,
	[Position] [int] NULL,
	[Notes] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Procedures]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Procedures](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](100) NULL,
	[EstimatedDuration] [int] NULL,
	[IsTemplate] [bit] NULL,
	[CreatedById] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PtoCredits]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PtoCredits](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[CreditHours] [decimal](10, 2) NOT NULL,
	[ModifiedBy] [nvarchar](255) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PtoCredits_Backup]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PtoCredits_Backup](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[CreditHours] [decimal](10, 2) NOT NULL,
	[ModifiedBy] [nvarchar](255) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PtoRequests]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PtoRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[EmployeeName] [nvarchar](255) NULL,
	[StartDate] [date] NOT NULL,
	[EndDate] [date] NOT NULL,
	[Hours] [decimal](10, 2) NOT NULL,
	[Reason] [nvarchar](max) NULL,
	[Status] [nvarchar](30) NOT NULL,
	[ReviewedBy] [nvarchar](255) NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PtoRequests_Backup]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PtoRequests_Backup](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](150) NOT NULL,
	[EmployeeName] [nvarchar](255) NULL,
	[StartDate] [date] NOT NULL,
	[EndDate] [date] NOT NULL,
	[Hours] [decimal](10, 2) NOT NULL,
	[Reason] [nvarchar](max) NULL,
	[Status] [nvarchar](30) NOT NULL,
	[ReviewedBy] [nvarchar](255) NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RequestAttachments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RequestAttachments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [int] NOT NULL,
	[FileName] [nvarchar](255) NOT NULL,
	[ContentType] [nvarchar](150) NOT NULL,
	[SizeBytes] [int] NOT NULL,
	[Data] [varbinary](max) NOT NULL,
	[UploadedBy] [nvarchar](255) NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RequestComments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RequestComments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [int] NOT NULL,
	[CommentText] [nvarchar](max) NOT NULL,
	[CreatedBy] [nvarchar](255) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RequestNotifications]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RequestNotifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [int] NOT NULL,
	[ToUser] [nvarchar](255) NOT NULL,
	[FromUser] [nvarchar](255) NULL,
	[NotificationType] [nvarchar](50) NOT NULL,
	[Message] [nvarchar](1000) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[IsRead] [bit] NOT NULL,
	[ReadAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RequestRoutingLog]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RequestRoutingLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [int] NOT NULL,
	[EventType] [nvarchar](50) NOT NULL,
	[Actor] [nvarchar](200) NULL,
	[FromUser] [nvarchar](200) NULL,
	[ToUser] [nvarchar](200) NULL,
	[Message] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Requests]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Requests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](200) NOT NULL,
	[Type] [nvarchar](50) NOT NULL,
	[Priority] [nvarchar](20) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[RequestedBy] [nvarchar](200) NOT NULL,
	[AssignedTo] [nvarchar](200) NULL,
	[NeededBy] [date] NULL,
	[Location] [nvarchar](100) NULL,
	[Description] [nvarchar](max) NOT NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleName] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[Duties] [nvarchar](max) NULL,
	[Responsibilities] [nvarchar](max) NULL,
	[FileUrl] [nvarchar](500) NULL,
	[FileName] [nvarchar](255) NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedDate] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduleEmailLog]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduleEmailLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SentAt] [datetime2](0) NOT NULL,
	[RequestedBy] [nvarchar](150) NULL,
	[Recipients] [nvarchar](max) NOT NULL,
	[RecipientCount] [int] NOT NULL,
	[Subject] [nvarchar](300) NOT NULL,
	[Status] [nvarchar](30) NOT NULL,
	[ErrorMessage] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Settings]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Settings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SettingKey] [nvarchar](200) NOT NULL,
	[SettingValue] [nvarchar](max) NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedDate] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[SettingKey] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[StationaryTemplates]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StationaryTemplates](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TemplateKey] [nvarchar](150) NOT NULL,
	[TemplateName] [nvarchar](255) NOT NULL,
	[TemplateJson] [nvarchar](max) NOT NULL,
	[ClinicId] [int] NULL,
	[CreatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[StickyNotes]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StickyNotes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Content] [nvarchar](max) NOT NULL,
	[Color] [nvarchar](20) NULL,
	[UserId] [int] NULL,
	[Position] [nvarchar](100) NULL,
	[IsDeleted] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[Text] [nvarchar](max) NULL,
	[PositionX] [int] NULL,
	[PositionY] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TaskTemplates]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TaskTemplates](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](50) NULL,
	[Priority] [nvarchar](20) NULL,
	[DefaultAssigneeRole] [nvarchar](50) NULL,
	[EstimatedDuration] [int] NULL,
	[Icon] [nvarchar](50) NULL,
	[Color] [nvarchar](20) NULL,
	[IsActive] [bit] NULL,
	[CreatedById] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserClinics]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserClinics](
	[UserId] [int] NOT NULL,
	[ClinicId] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_UserClinics] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserComplianceAssignments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserComplianceAssignments](
	[UserId] [int] NOT NULL,
	[ComplianceId] [int] NOT NULL,
	[AssignedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_UserComplianceAssignments] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[ComplianceId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserDutyAssignments]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserDutyAssignments](
	[UserId] [int] NOT NULL,
	[DutyId] [int] NOT NULL,
	[AssignedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[DutyId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserHRBenefits]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserHRBenefits](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserHRInfoId] [int] NOT NULL,
	[BenefitKey] [nvarchar](150) NOT NULL,
	[BenefitName] [nvarchar](200) NULL,
	[IsEnabled] [bit] NOT NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
 CONSTRAINT [PK_UserHRBenefits] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserHRInfo]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserHRInfo](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[HRData] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[LastUpdated] [datetime2](3) NOT NULL,
	[EmploymentType] [nvarchar](100) NULL,
	[ActiveStatus] [nvarchar](50) NULL,
	[PayType] [nvarchar](50) NULL,
	[Salary] [decimal](12, 2) NULL,
	[HourlyRate] [decimal](10, 2) NULL,
	[ExpectedHours] [decimal](6, 2) NULL,
	[BenefitStartDate] [date] NULL,
	[BenefitEndDate] [date] NULL,
	[Notes] [nvarchar](max) NULL,
	[HealthInsurance] [bit] NULL,
	[DentalInsurance] [bit] NULL,
	[VisionInsurance] [bit] NULL,
	[Retirement401K] [bit] NULL,
	[PaidTimeOff] [bit] NULL,
	[LifeInsurance] [bit] NULL,
	[BenefitsJson] [nvarchar](max) NULL,
	[HRDataJson] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
 CONSTRAINT [PK_UserHRInfo] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserLoginAudit]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserLoginAudit](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[SessionId] [nvarchar](120) NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](120) NOT NULL,
	[DisplayName] [nvarchar](200) NULL,
	[UserRole] [nvarchar](60) NULL,
	[EventType] [nvarchar](80) NOT NULL,
	[EventSource] [nvarchar](60) NULL,
	[EventAt] [datetime2](3) NOT NULL,
	[ForcedBy] [nvarchar](120) NULL,
	[Note] [nvarchar](400) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserLoginSessions]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserLoginSessions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SessionId] [nvarchar](120) NOT NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](120) NOT NULL,
	[DisplayName] [nvarchar](200) NULL,
	[UserRole] [nvarchar](60) NULL,
	[Source] [nvarchar](60) NULL,
	[LoginAt] [datetime2](3) NOT NULL,
	[LastSeenAt] [datetime2](3) NOT NULL,
	[LogoutAt] [datetime2](3) NULL,
	[LogoutReason] [nvarchar](80) NULL,
	[ForcedLogoutAt] [datetime2](3) NULL,
	[ForcedBy] [nvarchar](120) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedDate] [datetime2](3) NOT NULL,
	[ModifiedDate] [datetime2](3) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_UserLoginSessions_SessionId] UNIQUE NONCLUSTERED 
(
	[SessionId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Vendors]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Vendors](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[ContactName] [nvarchar](100) NULL,
	[Email] [nvarchar](255) NULL,
	[Phone] [nvarchar](20) NULL,
	[Address] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[State] [nvarchar](50) NULL,
	[ZipCode] [nvarchar](20) NULL,
	[Website] [nvarchar](255) NULL,
	[Category] [nvarchar](100) NULL,
	[Notes] [nvarchar](max) NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[VendorType] [nvarchar](100) NULL,
	[AlternatePhone] [nvarchar](50) NULL,
	[PortalUsername] [nvarchar](255) NULL,
	[PortalPassword] [nvarchar](255) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VendorTypes]    Script Date: 3/12/2026 10:56:07 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VendorTypes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[SortOrder] [int] NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_AttendanceAbsences_WorkDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_AttendanceAbsences_WorkDate] ON [dbo].[AttendanceAbsences]
(
	[WorkDate] DESC,
	[Id] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_AttendanceAbsences_Username_WorkDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_AttendanceAbsences_Username_WorkDate] ON [dbo].[AttendanceAbsences]
(
	[Username] ASC,
	[WorkDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AttendanceNotifications_Username_CreatedAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_AttendanceNotifications_Username_CreatedAt] ON [dbo].[AttendanceNotifications]
(
	[Username] ASC,
	[CreatedAt] DESC,
	[Id] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_AttendancePolicies_Username]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_AttendancePolicies_Username] ON [dbo].[AttendancePolicies]
(
	[Username] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AttendanceRecords_Username_WorkDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_AttendanceRecords_Username_WorkDate] ON [dbo].[AttendanceRecords]
(
	[Username] ASC,
	[WorkDate] DESC,
	[Id] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AttendanceRecords_WorkDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_AttendanceRecords_WorkDate] ON [dbo].[AttendanceRecords]
(
	[WorkDate] DESC,
	[Id] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_AttendanceRecords_LocalRecordId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_AttendanceRecords_LocalRecordId] ON [dbo].[AttendanceRecords]
(
	[LocalRecordId] ASC
)
WHERE ([LocalRecordId] IS NOT NULL)
WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AuditLog_CreatedDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_AuditLog_CreatedDate] ON [dbo].[AuditLog]
(
	[CreatedDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AuditLog_TableName]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_AuditLog_TableName] ON [dbo].[AuditLog]
(
	[TableName] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Categories_CategoryType]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Categories_CategoryType] ON [dbo].[Categories]
(
	[CategoryType] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChatMessageAttachments_MessageId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChatMessageAttachments_MessageId] ON [dbo].[ChatMessageAttachments]
(
	[MessageId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChatMessages_ReceiverId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChatMessages_ReceiverId] ON [dbo].[ChatMessages]
(
	[ReceiverId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChatMessages_SenderId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChatMessages_SenderId] ON [dbo].[ChatMessages]
(
	[SenderId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChatMessages_SentAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChatMessages_SentAt] ON [dbo].[ChatMessages]
(
	[SentAt] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChatMessages_Unread]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChatMessages_Unread] ON [dbo].[ChatMessages]
(
	[ReceiverId] ASC,
	[IsRead] ASC
)
WHERE ([IsRead]=(0))
WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ClinicWorkingHours_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ClinicWorkingHours_ClinicId] ON [dbo].[ClinicWorkingHours]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_ClinicWorkingHours_ClinicId_DayKey]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ClinicWorkingHours_ClinicId_DayKey] ON [dbo].[ClinicWorkingHours]
(
	[ClinicId] ASC,
	[DayKey] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Compliances_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Compliances_ClinicId] ON [dbo].[Compliances]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Compliances_ComplianceTypeId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Compliances_ComplianceTypeId] ON [dbo].[Compliances]
(
	[ComplianceTypeId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Compliances_ExpiryDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Compliances_ExpiryDate] ON [dbo].[Compliances]
(
	[ExpiryDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Compliances_ReminderDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Compliances_ReminderDate] ON [dbo].[Compliances]
(
	[ReminderDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Compliances_Status]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Compliances_Status] ON [dbo].[Compliances]
(
	[Status] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Compliances_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Compliances_UserId] ON [dbo].[Compliances]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ComplianceTypes_Category]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ComplianceTypes_Category] ON [dbo].[ComplianceTypes]
(
	[Category] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplianceTypes_IsActive]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ComplianceTypes_IsActive] ON [dbo].[ComplianceTypes]
(
	[IsActive] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CopilotConversationMessages_Conversation_Order]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_CopilotConversationMessages_Conversation_Order] ON [dbo].[CopilotConversationMessages]
(
	[ConversationPkId] ASC,
	[MessageOrder] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CopilotConversations_User_ModifiedDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_CopilotConversations_User_ModifiedDate] ON [dbo].[CopilotConversations]
(
	[UserId] ASC,
	[ModifiedDate] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_CopilotConversations_User_Conversation]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_CopilotConversations_User_Conversation] ON [dbo].[CopilotConversations]
(
	[UserId] ASC,
	[ConversationId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Equipment_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Equipment_ClinicId] ON [dbo].[Equipment]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Equipment_Status]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Equipment_Status] ON [dbo].[Equipment]
(
	[Status] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_EquipmentServiceTickets_EquipmentId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_EquipmentServiceTickets_EquipmentId] ON [dbo].[EquipmentServiceTickets]
(
	[EquipmentId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_EquipmentServiceTickets_StatusScheduled]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_EquipmentServiceTickets_StatusScheduled] ON [dbo].[EquipmentServiceTickets]
(
	[Status] ASC,
	[ScheduledDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Events_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Events_ClinicId] ON [dbo].[Events]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Events_StartDateTime]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Events_StartDateTime] ON [dbo].[Events]
(
	[StartDateTime] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Events_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Events_UserId] ON [dbo].[Events]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Instruments_Category]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Instruments_Category] ON [dbo].[Instruments]
(
	[Category] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Instruments_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Instruments_ClinicId] ON [dbo].[Instruments]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ProcedureInstruments_ProcedureId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ProcedureInstruments_ProcedureId] ON [dbo].[ProcedureInstruments]
(
	[ProcedureId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_PtoCredits_Username]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_PtoCredits_Username] ON [dbo].[PtoCredits]
(
	[Username] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PtoRequests_Status_CreatedAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_PtoRequests_Status_CreatedAt] ON [dbo].[PtoRequests]
(
	[Status] ASC,
	[CreatedAt] DESC,
	[Id] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PtoRequests_Username_Status]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_PtoRequests_Username_Status] ON [dbo].[PtoRequests]
(
	[Username] ASC,
	[Status] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RequestAttachments_RequestId_UploadedAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_RequestAttachments_RequestId_UploadedAt] ON [dbo].[RequestAttachments]
(
	[RequestId] ASC,
	[UploadedAt] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RequestComments_RequestId_CreatedAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_RequestComments_RequestId_CreatedAt] ON [dbo].[RequestComments]
(
	[RequestId] ASC,
	[CreatedAt] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RequestNotifications_ToUser_IsRead_CreatedAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_RequestNotifications_ToUser_IsRead_CreatedAt] ON [dbo].[RequestNotifications]
(
	[ToUser] ASC,
	[IsRead] ASC,
	[CreatedAt] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RequestRoutingLog_RequestId_CreatedAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_RequestRoutingLog_RequestId_CreatedAt] ON [dbo].[RequestRoutingLog]
(
	[RequestId] ASC,
	[CreatedAt] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Requests_AssignedTo]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Requests_AssignedTo] ON [dbo].[Requests]
(
	[AssignedTo] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Requests_Status]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Requests_Status] ON [dbo].[Requests]
(
	[Status] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Requests_Type]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Requests_Type] ON [dbo].[Requests]
(
	[Type] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rooms_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Rooms_ClinicId] ON [dbo].[Rooms]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleEmailLog_SentAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleEmailLog_SentAt] ON [dbo].[ScheduleEmailLog]
(
	[SentAt] DESC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_ClinicId] ON [dbo].[Schedules]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_StartDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_StartDate] ON [dbo].[Schedules]
(
	[StartDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_UserId] ON [dbo].[Schedules]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Settings_SettingKey]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Settings_SettingKey] ON [dbo].[Settings]
(
	[SettingKey] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_StationaryTemplates_ClinicUserActive]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_StationaryTemplates_ClinicUserActive] ON [dbo].[StationaryTemplates]
(
	[ClinicId] ASC,
	[CreatedByUserId] ASC,
	[IsActive] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_StationaryTemplates_ScopeKey_Active]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_StationaryTemplates_ScopeKey_Active] ON [dbo].[StationaryTemplates]
(
	[ClinicId] ASC,
	[CreatedByUserId] ASC,
	[TemplateKey] ASC
)
WHERE ([IsActive]=(1))
WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_StickyNotes_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_StickyNotes_UserId] ON [dbo].[StickyNotes]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Supplies_Category]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Supplies_Category] ON [dbo].[Supplies]
(
	[Category] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Supplies_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Supplies_ClinicId] ON [dbo].[Supplies]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Tasks_AssignedToId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Tasks_AssignedToId] ON [dbo].[Tasks]
(
	[AssignedToId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Tasks_Category]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Tasks_Category] ON [dbo].[Tasks]
(
	[Category] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Tasks_DueDate]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Tasks_DueDate] ON [dbo].[Tasks]
(
	[DueDate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Tasks_Status]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Tasks_Status] ON [dbo].[Tasks]
(
	[Status] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserClinics_ClinicId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserClinics_ClinicId] ON [dbo].[UserClinics]
(
	[ClinicId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserClinics_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserClinics_UserId] ON [dbo].[UserClinics]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserComplianceAssignments_ComplianceId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserComplianceAssignments_ComplianceId] ON [dbo].[UserComplianceAssignments]
(
	[ComplianceId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserComplianceAssignments_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserComplianceAssignments_UserId] ON [dbo].[UserComplianceAssignments]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_UserHRBenefits_UserHRInfoId_BenefitKey]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_UserHRBenefits_UserHRInfoId_BenefitKey] ON [dbo].[UserHRBenefits]
(
	[UserHRInfoId] ASC,
	[BenefitKey] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_UserHRInfo_UserId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_UserHRInfo_UserId] ON [dbo].[UserHRInfo]
(
	[UserId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserLoginAudit_EventAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserLoginAudit_EventAt] ON [dbo].[UserLoginAudit]
(
	[EventAt] DESC
)
INCLUDE([Username],[DisplayName],[UserRole],[EventType],[SessionId],[ForcedBy]) WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_UserLoginAudit_Username_EventAt]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserLoginAudit_Username_EventAt] ON [dbo].[UserLoginAudit]
(
	[Username] ASC,
	[EventAt] DESC
)
INCLUDE([EventType],[SessionId],[ForcedBy]) WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserLoginSessions_Active_LastSeen]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserLoginSessions_Active_LastSeen] ON [dbo].[UserLoginSessions]
(
	[IsActive] ASC,
	[LastSeenAt] DESC
)
INCLUDE([SessionId],[Username],[DisplayName],[UserRole],[LoginAt],[ForcedLogoutAt],[ForcedBy]) WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_UserLoginSessions_Username]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserLoginSessions_Username] ON [dbo].[UserLoginSessions]
(
	[Username] ASC
)
INCLUDE([SessionId],[IsActive],[LastSeenAt],[ForcedLogoutAt]) WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_IsActive]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_IsActive] ON [dbo].[Users]
(
	[IsActive] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_IsOnline_LastSeen]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_IsOnline_LastSeen] ON [dbo].[Users]
(
	[IsOnline] ASC,
	[LastSeen] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_Role]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_Role] ON [dbo].[Users]
(
	[Role] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_RoleId]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_RoleId] ON [dbo].[Users]
(
	[RoleId] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_StaffType]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_StaffType] ON [dbo].[Users]
(
	[StaffType] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_Username]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_Username] ON [dbo].[Users]
(
	[Username] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ARITHABORT ON
SET CONCAT_NULL_YIELDS_NULL ON
SET QUOTED_IDENTIFIER ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
SET NUMERIC_ROUNDABORT OFF
GO
/****** Object:  Index [UX_Users_UsernameNormalized]    Script Date: 3/12/2026 10:56:07 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Users_UsernameNormalized] ON [dbo].[Users]
(
	[UsernameNormalized] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[AttendanceAbsences] ADD  CONSTRAINT [DF_AttendanceAbsences_RecordedAt]  DEFAULT (sysdatetime()) FOR [RecordedAt]
GO
ALTER TABLE [dbo].[AttendanceNotifications] ADD  CONSTRAINT [DF_AttendanceNotifications_Type]  DEFAULT ('info') FOR [NotificationType]
GO
ALTER TABLE [dbo].[AttendanceNotifications] ADD  CONSTRAINT [DF_AttendanceNotifications_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AttendancePolicies] ADD  CONSTRAINT [DF_AttendancePolicies_AllowFlex]  DEFAULT ((0)) FOR [AllowFlex]
GO
ALTER TABLE [dbo].[AttendancePolicies] ADD  CONSTRAINT [DF_AttendancePolicies_BeforeMins]  DEFAULT ((0)) FOR [BeforeMins]
GO
ALTER TABLE [dbo].[AttendancePolicies] ADD  CONSTRAINT [DF_AttendancePolicies_AfterMins]  DEFAULT ((0)) FOR [AfterMins]
GO
ALTER TABLE [dbo].[AttendancePolicies] ADD  CONSTRAINT [DF_AttendancePolicies_CreatedDate]  DEFAULT (sysdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[AttendancePolicies] ADD  CONSTRAINT [DF_AttendancePolicies_ModifiedDate]  DEFAULT (sysdatetime()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[AttendanceRecords] ADD  CONSTRAINT [DF_AttendanceRecords_MinutesWorked]  DEFAULT ((0)) FOR [MinutesWorked]
GO
ALTER TABLE [dbo].[AttendanceRecords] ADD  CONSTRAINT [DF_AttendanceRecords_CreatedDate]  DEFAULT (sysdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[AttendanceRecords] ADD  CONSTRAINT [DF_AttendanceRecords_ModifiedDate]  DEFAULT (sysdatetime()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[AuditLog] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ChatMessageAttachments] ADD  DEFAULT ((0)) FOR [FileSize]
GO
ALTER TABLE [dbo].[ChatMessageAttachments] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ChatMessages] ADD  DEFAULT (getdate()) FOR [SentAt]
GO
ALTER TABLE [dbo].[ChatMessages] ADD  DEFAULT ((0)) FOR [IsRead]
GO
ALTER TABLE [dbo].[Clinics] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Clinics] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Clinics] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[ClinicWorkingHours] ADD  CONSTRAINT [DF_ClinicWorkingHours_IsOpen]  DEFAULT ((0)) FOR [IsOpen]
GO
ALTER TABLE [dbo].[ClinicWorkingHours] ADD  CONSTRAINT [DF_ClinicWorkingHours_CreatedDate]  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ClinicWorkingHours] ADD  CONSTRAINT [DF_ClinicWorkingHours_ModifiedDate]  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Compliances] ADD  DEFAULT ('active') FOR [Status]
GO
ALTER TABLE [dbo].[Compliances] ADD  DEFAULT ('medium') FOR [Priority]
GO
ALTER TABLE [dbo].[Compliances] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Compliances] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT ((0)) FOR [RequiresEmployee]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT ((0)) FOR [RequiresClinic]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT ('#3b82f6') FOR [Color]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT ('fas fa-file-contract') FOR [Icon]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ComplianceTypes] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[CopilotConversationMessages] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[CopilotConversations] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[CopilotConversations] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[CopilotConversations] ADD  DEFAULT (sysutcdatetime()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Duties] ADD  DEFAULT ('Daily') FOR [Schedule]
GO
ALTER TABLE [dbo].[Duties] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[Duties] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Duties] ADD  DEFAULT (getdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Duties] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Equipment] ADD  DEFAULT ('operational') FOR [Status]
GO
ALTER TABLE [dbo].[Equipment] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Equipment] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[EquipmentServiceTickets] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[EquipmentServiceTickets] ADD  DEFAULT ((0)) FOR [IsAutoGenerated]
GO
ALTER TABLE [dbo].[EquipmentServiceTickets] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EquipmentServiceTickets] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Events] ADD  DEFAULT ((0)) FOR [AllDay]
GO
ALTER TABLE [dbo].[Events] ADD  DEFAULT ('scheduled') FOR [Status]
GO
ALTER TABLE [dbo].[Events] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Events] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Instruments] ADD  DEFAULT ((1)) FOR [Quantity]
GO
ALTER TABLE [dbo].[Instruments] ADD  DEFAULT ((1)) FOR [SterilizationRequired]
GO
ALTER TABLE [dbo].[Instruments] ADD  DEFAULT ('available') FOR [Status]
GO
ALTER TABLE [dbo].[Instruments] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Instruments] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[ProcedureInstruments] ADD  DEFAULT ((1)) FOR [Quantity]
GO
ALTER TABLE [dbo].[Procedures] ADD  DEFAULT ((0)) FOR [IsTemplate]
GO
ALTER TABLE [dbo].[Procedures] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Procedures] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[PtoCredits] ADD  CONSTRAINT [DF_PtoCredits_CreditHours]  DEFAULT ((80)) FOR [CreditHours]
GO
ALTER TABLE [dbo].[PtoCredits] ADD  CONSTRAINT [DF_PtoCredits_CreatedDate]  DEFAULT (sysdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[PtoCredits] ADD  CONSTRAINT [DF_PtoCredits_ModifiedDate]  DEFAULT (sysdatetime()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[PtoRequests] ADD  CONSTRAINT [DF_PtoRequests_Status]  DEFAULT ('pending') FOR [Status]
GO
ALTER TABLE [dbo].[PtoRequests] ADD  CONSTRAINT [DF_PtoRequests_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PtoRequests] ADD  CONSTRAINT [DF_PtoRequests_ModifiedDate]  DEFAULT (sysdatetime()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[RequestAttachments] ADD  CONSTRAINT [DF_RequestAttachments_UploadedAt]  DEFAULT (sysdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[RequestComments] ADD  CONSTRAINT [DF_RequestComments_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RequestNotifications] ADD  CONSTRAINT [DF_RequestNotifications_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RequestNotifications] ADD  CONSTRAINT [DF_RequestNotifications_IsRead]  DEFAULT ((0)) FOR [IsRead]
GO
ALTER TABLE [dbo].[RequestRoutingLog] ADD  CONSTRAINT [DF_RequestRoutingLog_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Requests] ADD  DEFAULT ('New') FOR [Status]
GO
ALTER TABLE [dbo].[Requests] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT (getdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Rooms] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Rooms] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Rooms] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[ScheduleEmailLog] ADD  DEFAULT (sysutcdatetime()) FOR [SentAt]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Settings] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Settings] ADD  DEFAULT (getdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[StationaryTemplates] ADD  CONSTRAINT [DF_StationaryTemplates_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[StationaryTemplates] ADD  CONSTRAINT [DF_StationaryTemplates_CreatedDate]  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[StationaryTemplates] ADD  CONSTRAINT [DF_StationaryTemplates_ModifiedDate]  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[StickyNotes] ADD  DEFAULT ('#fef3c7') FOR [Color]
GO
ALTER TABLE [dbo].[StickyNotes] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[StickyNotes] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[StickyNotes] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[StickyNotes] ADD  DEFAULT ((100)) FOR [PositionX]
GO
ALTER TABLE [dbo].[StickyNotes] ADD  DEFAULT ((100)) FOR [PositionY]
GO
ALTER TABLE [dbo].[Supplies] ADD  DEFAULT ((0)) FOR [QuantityInStock]
GO
ALTER TABLE [dbo].[Supplies] ADD  DEFAULT ((0)) FOR [MinimumStock]
GO
ALTER TABLE [dbo].[Supplies] ADD  DEFAULT ((0)) FOR [ReorderPoint]
GO
ALTER TABLE [dbo].[Supplies] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Supplies] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Supplies] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT ((0)) FOR [IsRecurring]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT ('Regular') FOR [TaskType]
GO
ALTER TABLE [dbo].[Tasks] ADD  DEFAULT ((0)) FOR [IsPaid]
GO
ALTER TABLE [dbo].[TaskTemplates] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[TaskTemplates] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[TaskTemplates] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[TaskTemplates] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[UserClinics] ADD  CONSTRAINT [DF_UserClinics_CreatedDate]  DEFAULT (sysutcdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[UserComplianceAssignments] ADD  CONSTRAINT [DF_UserComplianceAssignments_AssignedAt]  DEFAULT (sysutcdatetime()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[UserDutyAssignments] ADD  DEFAULT (sysutcdatetime()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[UserHRBenefits] ADD  CONSTRAINT [DF_UserHRBenefits_IsEnabled]  DEFAULT ((0)) FOR [IsEnabled]
GO
ALTER TABLE [dbo].[UserHRBenefits] ADD  CONSTRAINT [DF_UserHRBenefits_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UserHRBenefits] ADD  CONSTRAINT [DF_UserHRBenefits_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[UserHRInfo] ADD  CONSTRAINT [DF_UserHRInfo_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UserHRInfo] ADD  CONSTRAINT [DF_UserHRInfo_LastUpdated]  DEFAULT (sysutcdatetime()) FOR [LastUpdated]
GO
ALTER TABLE [dbo].[UserHRInfo] ADD  CONSTRAINT [DF_UserHRInfo_UpdatedAt_Fix]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[UserLoginAudit] ADD  DEFAULT (sysutcdatetime()) FOR [EventAt]
GO
ALTER TABLE [dbo].[UserLoginSessions] ADD  DEFAULT (sysutcdatetime()) FOR [LoginAt]
GO
ALTER TABLE [dbo].[UserLoginSessions] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[UserLoginSessions] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[UserLoginSessions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[UserLoginSessions] ADD  DEFAULT (sysutcdatetime()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('user') FOR [Role]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [IsOnline]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_FailedLoginAttempts]  DEFAULT ((0)) FOR [FailedLoginAttempts]
GO
ALTER TABLE [dbo].[Vendors] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Vendors] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Vendors] ADD  DEFAULT (getutcdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[VendorTypes] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[VendorTypes] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[VendorTypes] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[VendorTypes] ADD  DEFAULT (getdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[AttendanceRecords]  WITH CHECK ADD  CONSTRAINT [FK_AttendanceRecords_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[AttendanceRecords] CHECK CONSTRAINT [FK_AttendanceRecords_Users]
GO
ALTER TABLE [dbo].[AuditLog]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[ChatMessageAttachments]  WITH CHECK ADD  CONSTRAINT [FK_ChatMessageAttachments_Message] FOREIGN KEY([MessageId])
REFERENCES [dbo].[ChatMessages] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ChatMessageAttachments] CHECK CONSTRAINT [FK_ChatMessageAttachments_Message]
GO
ALTER TABLE [dbo].[ChatMessages]  WITH CHECK ADD FOREIGN KEY([ReceiverId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[ChatMessages]  WITH CHECK ADD FOREIGN KEY([SenderId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[ClinicWorkingHours]  WITH CHECK ADD  CONSTRAINT [FK_ClinicWorkingHours_Clinics] FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[ClinicWorkingHours] CHECK CONSTRAINT [FK_ClinicWorkingHours_Clinics]
GO
ALTER TABLE [dbo].[Compliances]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Compliances]  WITH CHECK ADD FOREIGN KEY([ComplianceTypeId])
REFERENCES [dbo].[ComplianceTypes] ([Id])
GO
ALTER TABLE [dbo].[Compliances]  WITH CHECK ADD FOREIGN KEY([CreatedById])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Compliances]  WITH CHECK ADD FOREIGN KEY([ModifiedById])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Compliances]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[CopilotConversationMessages]  WITH CHECK ADD FOREIGN KEY([ConversationPkId])
REFERENCES [dbo].[CopilotConversations] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CopilotConversations]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Equipment]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Equipment]  WITH CHECK ADD FOREIGN KEY([RoomId])
REFERENCES [dbo].[Rooms] ([Id])
GO
ALTER TABLE [dbo].[EquipmentServiceTickets]  WITH CHECK ADD  CONSTRAINT [FK_EquipmentServiceTickets_Equipment] FOREIGN KEY([EquipmentId])
REFERENCES [dbo].[Equipment] ([Id])
GO
ALTER TABLE [dbo].[EquipmentServiceTickets] CHECK CONSTRAINT [FK_EquipmentServiceTickets_Equipment]
GO
ALTER TABLE [dbo].[Events]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Events]  WITH CHECK ADD FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Events]  WITH CHECK ADD FOREIGN KEY([RoomId])
REFERENCES [dbo].[Rooms] ([Id])
GO
ALTER TABLE [dbo].[Events]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Instruments]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[ProcedureInstruments]  WITH CHECK ADD FOREIGN KEY([InstrumentId])
REFERENCES [dbo].[Instruments] ([Id])
GO
ALTER TABLE [dbo].[ProcedureInstruments]  WITH CHECK ADD FOREIGN KEY([ProcedureId])
REFERENCES [dbo].[Procedures] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Procedures]  WITH CHECK ADD FOREIGN KEY([CreatedById])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Rooms]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([AssistantId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([RoomId])
REFERENCES [dbo].[Rooms] ([Id])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StationaryTemplates]  WITH CHECK ADD  CONSTRAINT [FK_StationaryTemplates_Clinic] FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[StationaryTemplates] CHECK CONSTRAINT [FK_StationaryTemplates_Clinic]
GO
ALTER TABLE [dbo].[StationaryTemplates]  WITH CHECK ADD  CONSTRAINT [FK_StationaryTemplates_User] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StationaryTemplates] CHECK CONSTRAINT [FK_StationaryTemplates_User]
GO
ALTER TABLE [dbo].[StickyNotes]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Supplies]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Tasks]  WITH CHECK ADD FOREIGN KEY([AssignedById])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Tasks]  WITH CHECK ADD FOREIGN KEY([AssignedToId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Tasks]  WITH CHECK ADD FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
GO
ALTER TABLE [dbo].[Tasks]  WITH CHECK ADD FOREIGN KEY([CompletedById])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[TaskTemplates]  WITH CHECK ADD FOREIGN KEY([CreatedById])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[UserClinics]  WITH CHECK ADD  CONSTRAINT [FK_UserClinics_Clinics] FOREIGN KEY([ClinicId])
REFERENCES [dbo].[Clinics] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserClinics] CHECK CONSTRAINT [FK_UserClinics_Clinics]
GO
ALTER TABLE [dbo].[UserClinics]  WITH CHECK ADD  CONSTRAINT [FK_UserClinics_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserClinics] CHECK CONSTRAINT [FK_UserClinics_Users]
GO
ALTER TABLE [dbo].[UserComplianceAssignments]  WITH CHECK ADD  CONSTRAINT [FK_UserComplianceAssignments_Compliances] FOREIGN KEY([ComplianceId])
REFERENCES [dbo].[Compliances] ([Id])
GO
ALTER TABLE [dbo].[UserComplianceAssignments] CHECK CONSTRAINT [FK_UserComplianceAssignments_Compliances]
GO
ALTER TABLE [dbo].[UserComplianceAssignments]  WITH CHECK ADD  CONSTRAINT [FK_UserComplianceAssignments_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[UserComplianceAssignments] CHECK CONSTRAINT [FK_UserComplianceAssignments_Users]
GO
ALTER TABLE [dbo].[UserDutyAssignments]  WITH CHECK ADD FOREIGN KEY([DutyId])
REFERENCES [dbo].[Duties] ([Id])
GO
ALTER TABLE [dbo].[UserDutyAssignments]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[UserHRBenefits]  WITH CHECK ADD  CONSTRAINT [FK_UserHRBenefits_UserHRInfo_UserHRInfoId] FOREIGN KEY([UserHRInfoId])
REFERENCES [dbo].[UserHRInfo] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserHRBenefits] CHECK CONSTRAINT [FK_UserHRBenefits_UserHRInfo_UserHRInfoId]
GO
ALTER TABLE [dbo].[UserHRInfo]  WITH CHECK ADD  CONSTRAINT [FK_UserHRInfo_Users_UserId] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserHRInfo] CHECK CONSTRAINT [FK_UserHRInfo_Users_UserId]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [FK_Users_Roles] FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Roles]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [FK_Users_Roles_RoleId] FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Roles_RoleId]
GO
ALTER TABLE [dbo].[ClinicWorkingHours]  WITH CHECK ADD  CONSTRAINT [CK_ClinicWorkingHours_DayKey] CHECK  ((lower([DayKey])='sunday' OR lower([DayKey])='saturday' OR lower([DayKey])='friday' OR lower([DayKey])='thursday' OR lower([DayKey])='wednesday' OR lower([DayKey])='tuesday' OR lower([DayKey])='monday'))
GO
ALTER TABLE [dbo].[ClinicWorkingHours] CHECK CONSTRAINT [CK_ClinicWorkingHours_DayKey]
GO
ALTER TABLE [dbo].[ClinicWorkingHours]  WITH CHECK ADD  CONSTRAINT [CK_ClinicWorkingHours_TimeRange] CHECK  (([IsOpen]=(0) OR [OpenTime] IS NOT NULL AND [CloseTime] IS NOT NULL AND [OpenTime]<[CloseTime]))
GO
ALTER TABLE [dbo].[ClinicWorkingHours] CHECK CONSTRAINT [CK_ClinicWorkingHours_TimeRange]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_ColorHex] CHECK  (([Color] IS NULL OR len([Color])=(7) AND [Color] like '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_ColorHex]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_DateOrder] CHECK  (([SeparationDate] IS NULL OR [HireDate] IS NULL OR [SeparationDate]>=[HireDate]))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_DateOrder]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_EmployeeStatus] CHECK  (([EmployeeStatus]='Terminated' OR [EmployeeStatus]='On Leave' OR [EmployeeStatus]='Inactive' OR [EmployeeStatus]='Active'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_EmployeeStatus]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_EmployeeType] CHECK  (([EmployeeType]='provider' OR [EmployeeType]='assistant'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_EmployeeType]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_FailedLoginAttempts] CHECK  (([FailedLoginAttempts]>=(0)))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_FailedLoginAttempts]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_HourlyRate] CHECK  (([HourlyRate] IS NULL OR [HourlyRate]>=(0)))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_HourlyRate]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_Role] CHECK  (([Role]='user' OR [Role]='manager' OR [Role]='admin'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Role]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_Salary] CHECK  (([Salary] IS NULL OR [Salary]>=(0)))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Salary]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_StaffType] CHECK  (([StaffType]='non-clinical' OR [StaffType]='clinical'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_StaffType]
GO
ALTER DATABASE [reformdentaldb] SET  READ_WRITE 
GO
