-- Find exactly what still references a Users.Id value before delete.
-- Usage: set @UserId and run entire script.

DECLARE @UserId INT = 15;

IF OBJECT_ID('tempdb..#UserDeleteBlockers') IS NOT NULL
    DROP TABLE #UserDeleteBlockers;

CREATE TABLE #UserDeleteBlockers (
    ConstraintName SYSNAME NOT NULL,
    SchemaName SYSNAME NOT NULL,
    TableName SYSNAME NOT NULL,
    ColumnName SYSNAME NOT NULL,
    BlockingRows INT NOT NULL
);

DECLARE @sql NVARCHAR(MAX) = N'';

;WITH fk_refs AS (
    SELECT
        fk.name AS ConstraintName,
        sch.name AS SchemaName,
        tab.name AS TableName,
        col.name AS ColumnName
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
        ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.tables tab
        ON tab.object_id = fkc.parent_object_id
    INNER JOIN sys.schemas sch
        ON sch.schema_id = tab.schema_id
    INNER JOIN sys.columns col
        ON col.object_id = fkc.parent_object_id
       AND col.column_id = fkc.parent_column_id
    INNER JOIN sys.tables ref_tab
        ON ref_tab.object_id = fkc.referenced_object_id
    INNER JOIN sys.schemas ref_sch
        ON ref_sch.schema_id = ref_tab.schema_id
    WHERE ref_sch.name = 'dbo'
      AND ref_tab.name = 'Users'
)
SELECT @sql = STRING_AGG(
N'INSERT INTO #UserDeleteBlockers (ConstraintName, SchemaName, TableName, ColumnName, BlockingRows)
SELECT ' + QUOTENAME(ConstraintName,'''') + N', ' + QUOTENAME(SchemaName,'''') + N', ' + QUOTENAME(TableName,'''') + N', ' + QUOTENAME(ColumnName,'''') + N', COUNT(1)
FROM ' + QUOTENAME(SchemaName) + N'.' + QUOTENAME(TableName) + N'
WHERE ' + QUOTENAME(ColumnName) + N' = @UserId;',
NCHAR(10) + NCHAR(10)
)
FROM fk_refs;

EXEC sp_executesql @sql, N'@UserId INT', @UserId = @UserId;

SELECT *
FROM #UserDeleteBlockers
WHERE BlockingRows > 0
ORDER BY BlockingRows DESC, SchemaName, TableName, ColumnName;

-- Expanded details for common blockers:
SELECT TOP (200) * FROM dbo.Schedules WHERE UserId = @UserId OR AssistantId = @UserId ORDER BY Id DESC;
SELECT TOP (200) * FROM dbo.Tasks WHERE AssignedToId = @UserId OR AssignedById = @UserId OR CompletedById = @UserId ORDER BY Id DESC;
SELECT TOP (200) * FROM dbo.Events WHERE UserId = @UserId OR CreatedBy = @UserId ORDER BY Id DESC;
SELECT TOP (200) * FROM dbo.Compliances WHERE UserId = @UserId OR CreatedById = @UserId OR ModifiedById = @UserId ORDER BY Id DESC;
SELECT TOP (200) * FROM dbo.ChatMessages WHERE SenderId = @UserId OR ReceiverId = @UserId ORDER BY Id DESC;
SELECT TOP (200) * FROM dbo.StickyNotes WHERE UserId = @UserId ORDER BY Id DESC;
SELECT TOP (200) * FROM dbo.AttendanceRecords WHERE UserId = @UserId ORDER BY Id DESC;

-- Safe path for production: deactivate instead of hard delete.
-- UPDATE dbo.Users
-- SET IsActive = 0,
--     IsOnline = 0,
--     ModifiedDate = GETUTCDATE()
-- WHERE Id = @UserId;

-- Hard delete path (only after blocker rows are fully removed):
-- DELETE FROM dbo.Users WHERE Id = @UserId;
