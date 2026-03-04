-- Attendance API vs Database Audit
-- Run this in the same SQL database used by the Function App.

SET NOCOUNT ON;

PRINT '=== Attendance API DB Audit ===';
SELECT
    DB_NAME() AS CurrentDatabase,
    @@SERVERNAME AS SqlServerName,
    SYSDATETIMEOFFSET() AS AuditTime;

PRINT '=== Table Presence ===';
SELECT
    CASE WHEN OBJECT_ID('dbo.AttendanceRecords', 'U') IS NOT NULL THEN 1 ELSE 0 END AS AttendanceRecordsExists,
    CASE WHEN OBJECT_ID('dbo.AttendancePolicies', 'U') IS NOT NULL THEN 1 ELSE 0 END AS AttendancePoliciesExists,
    CASE WHEN OBJECT_ID('dbo.PtoCredits', 'U') IS NOT NULL THEN 1 ELSE 0 END AS PtoCreditsExists,
    CASE WHEN OBJECT_ID('dbo.PtoRequests', 'U') IS NOT NULL THEN 1 ELSE 0 END AS PtoRequestsExists,
    CASE WHEN OBJECT_ID('dbo.AttendanceNotifications', 'U') IS NOT NULL THEN 1 ELSE 0 END AS AttendanceNotificationsExists,
    CASE WHEN OBJECT_ID('dbo.AttendanceAbsences', 'U') IS NOT NULL THEN 1 ELSE 0 END AS AttendanceAbsencesExists;

PRINT '=== AttendanceRecords Required Columns ===';
WITH required AS (
    SELECT 'Id' AS ColName UNION ALL
    SELECT 'LocalRecordId' UNION ALL
    SELECT 'UserId' UNION ALL
    SELECT 'Username' UNION ALL
    SELECT 'DisplayName' UNION ALL
    SELECT 'WorkDate' UNION ALL
    SELECT 'ScheduledStart' UNION ALL
    SELECT 'ScheduledEnd' UNION ALL
    SELECT 'ClockIn' UNION ALL
    SELECT 'ClockOut' UNION ALL
    SELECT 'MinutesWorked' UNION ALL
    SELECT 'FlagsJson' UNION ALL
    SELECT 'CreatedDate' UNION ALL
    SELECT 'ModifiedDate'
)
SELECT
    r.ColName,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.IS_NULLABLE,
    CASE WHEN c.COLUMN_NAME IS NULL THEN 0 ELSE 1 END AS ExistsInTable
FROM required r
LEFT JOIN INFORMATION_SCHEMA.COLUMNS c
    ON c.TABLE_SCHEMA = 'dbo'
   AND c.TABLE_NAME = 'AttendanceRecords'
   AND c.COLUMN_NAME = r.ColName
ORDER BY r.ColName;

PRINT '=== AttendanceRecords Indexes ===';
SELECT
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    i.is_unique_constraint AS IsUniqueConstraint,
    i.filter_definition AS FilterDefinition,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS KeyColumns
FROM sys.indexes i
JOIN sys.index_columns ic
    ON i.object_id = ic.object_id
   AND i.index_id = ic.index_id
JOIN sys.columns c
    ON ic.object_id = c.object_id
   AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.AttendanceRecords')
  AND ic.key_ordinal > 0
GROUP BY i.name, i.is_unique, i.is_unique_constraint, i.filter_definition
ORDER BY i.name;

PRINT '=== Legacy Constraint Risk Checks ===';
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM sys.indexes i
            JOIN sys.index_columns ic1 ON i.object_id = ic1.object_id AND i.index_id = ic1.index_id AND ic1.key_ordinal = 1
            JOIN sys.index_columns ic2 ON i.object_id = ic2.object_id AND i.index_id = ic2.index_id AND ic2.key_ordinal = 2
            JOIN sys.columns c1 ON ic1.object_id = c1.object_id AND ic1.column_id = c1.column_id
            JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
            WHERE i.object_id = OBJECT_ID('dbo.AttendanceRecords')
              AND i.is_unique = 1
              AND c1.name = 'Username'
              AND c2.name = 'WorkDate'
        ) THEN 1 ELSE 0 END AS HasUniqueUsernameWorkDateIndex,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.AttendanceRecords')
              AND i.name = 'UX_AttendanceRecords_LocalRecordId'
              AND i.is_unique = 1
        ) THEN 1 ELSE 0 END AS HasUniqueLocalRecordIdIndex,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.AttendanceRecords')
              AND i.name = 'IX_AttendanceRecords_Username_WorkDate'
              AND i.is_unique = 0
        ) THEN 1 ELSE 0 END AS HasNonUniqueUsernameWorkDateIndex;

PRINT '=== Data Quality Checks ===';
SELECT TOP 20
    LocalRecordId,
    COUNT(*) AS DuplicateCount
FROM dbo.AttendanceRecords
WHERE LocalRecordId IS NOT NULL
GROUP BY LocalRecordId
HAVING COUNT(*) > 1
ORDER BY DuplicateCount DESC, LocalRecordId;

SELECT TOP 20
    Username,
    WorkDate,
    COUNT(*) AS SegmentsPerDay
FROM dbo.AttendanceRecords
GROUP BY Username, WorkDate
HAVING COUNT(*) > 1
ORDER BY SegmentsPerDay DESC, Username, WorkDate;

PRINT '=== Recommended Status Summary ===';
SELECT
    CASE WHEN OBJECT_ID('dbo.AttendanceRecords', 'U') IS NULL
        THEN 'FAIL: AttendanceRecords table missing'
        WHEN EXISTS (
            SELECT 1
            FROM sys.indexes i
            JOIN sys.index_columns ic1 ON i.object_id = ic1.object_id AND i.index_id = ic1.index_id AND ic1.key_ordinal = 1
            JOIN sys.index_columns ic2 ON i.object_id = ic2.object_id AND i.index_id = ic2.index_id AND ic2.key_ordinal = 2
            JOIN sys.columns c1 ON ic1.object_id = c1.object_id AND ic1.column_id = c1.column_id
            JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
            WHERE i.object_id = OBJECT_ID('dbo.AttendanceRecords')
              AND i.is_unique = 1
              AND c1.name = 'Username'
              AND c2.name = 'WorkDate'
        ) THEN 'FAIL: Legacy unique (Username, WorkDate) still active'
        WHEN NOT EXISTS (
            SELECT 1
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.AttendanceRecords')
              AND i.name = 'UX_AttendanceRecords_LocalRecordId'
              AND i.is_unique = 1
        ) THEN 'WARN: LocalRecordId unique index missing'
        ELSE 'PASS: Index model compatible with current attendance APIs'
    END AS AuditResult;
