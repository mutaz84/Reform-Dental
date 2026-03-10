-- Seed employee benefits into dbo.Categories for API-backed HR benefits management.
-- Safe to re-run: existing records are reactivated and sort order is updated.

BEGIN TRAN;

;WITH src AS (
    SELECT v.Name, v.SortOrder
    FROM (VALUES
        (N'Health Insurance', 1),
        (N'Dental Insurance', 2),
        (N'Vision Insurance', 3),
        (N'401(k) Retirement', 4),
        (N'Paid Time Off', 5),
        (N'Life Insurance', 6)
    ) v(Name, SortOrder)
)
MERGE dbo.Categories AS tgt
USING src
  ON LOWER(LTRIM(RTRIM(tgt.Name))) = LOWER(LTRIM(RTRIM(src.Name)))
 AND LOWER(LTRIM(RTRIM(tgt.CategoryType))) = N'employee-benefit'
WHEN MATCHED THEN
  UPDATE SET
    tgt.SortOrder = src.SortOrder,
    tgt.IsActive = 1,
    tgt.ModifiedDate = GETUTCDATE()
WHEN NOT MATCHED BY TARGET THEN
  INSERT (Name, CategoryType, Description, SortOrder, IsActive, CreatedDate, ModifiedDate)
  VALUES (src.Name, N'employee-benefit', NULL, src.SortOrder, 1, GETUTCDATE(), GETUTCDATE());

COMMIT TRAN;

-- Verify
SELECT Id, Name, CategoryType, SortOrder, IsActive
FROM dbo.Categories
WHERE CategoryType = N'employee-benefit'
ORDER BY SortOrder, Name;
