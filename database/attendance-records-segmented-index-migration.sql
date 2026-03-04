-- AttendanceRecords segmented-day migration
-- Purpose: allow multiple attendance records per user per WorkDate
-- while keeping each local client segment uniquely addressable.

IF OBJECT_ID('dbo.AttendanceRecords', 'U') IS NULL
BEGIN
    PRINT 'AttendanceRecords table does not exist. No changes applied.';
    RETURN;
END;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AttendanceRecords')
      AND name = 'UX_AttendanceRecords_Username_WorkDate'
)
BEGIN
    DROP INDEX UX_AttendanceRecords_Username_WorkDate ON dbo.AttendanceRecords;
    PRINT 'Dropped UX_AttendanceRecords_Username_WorkDate.';
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AttendanceRecords')
      AND name = 'IX_AttendanceRecords_Username_WorkDate'
)
BEGIN
    CREATE INDEX IX_AttendanceRecords_Username_WorkDate
        ON dbo.AttendanceRecords (Username, WorkDate DESC, Id DESC);
    PRINT 'Created IX_AttendanceRecords_Username_WorkDate.';
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AttendanceRecords')
      AND name = 'UX_AttendanceRecords_LocalRecordId'
)
BEGIN
    CREATE UNIQUE INDEX UX_AttendanceRecords_LocalRecordId
        ON dbo.AttendanceRecords (LocalRecordId)
        WHERE LocalRecordId IS NOT NULL;
    PRINT 'Created UX_AttendanceRecords_LocalRecordId.';
END;

PRINT 'Attendance segmented index migration complete.';
