/*
  UserComplianceAssignments migration
  - Creates junction table if missing
  - Backfills from Compliances.UserId (legacy)
  - Adds uniqueness and performance indexes
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.UserComplianceAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserComplianceAssignments (
        UserId INT NOT NULL,
        ComplianceId INT NOT NULL,
        AssignedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserComplianceAssignments_AssignedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_UserComplianceAssignments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_UserComplianceAssignments_Compliances FOREIGN KEY (ComplianceId) REFERENCES dbo.Compliances(Id)
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE [type] = 'PK'
      AND [name] = 'PK_UserComplianceAssignments'
)
BEGIN
    ALTER TABLE dbo.UserComplianceAssignments
    ADD CONSTRAINT PK_UserComplianceAssignments PRIMARY KEY CLUSTERED (UserId, ComplianceId);
END;

-- Legacy backfill from Compliances.UserId
IF COL_LENGTH('dbo.Compliances', 'UserId') IS NOT NULL
BEGIN
    INSERT INTO dbo.UserComplianceAssignments (UserId, ComplianceId)
    SELECT c.UserId, c.Id
    FROM dbo.Compliances c
    WHERE c.UserId IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.UserComplianceAssignments uca
          WHERE uca.UserId = c.UserId
            AND uca.ComplianceId = c.Id
      );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.UserComplianceAssignments')
      AND [name] = 'IX_UserComplianceAssignments_ComplianceId'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserComplianceAssignments_ComplianceId
        ON dbo.UserComplianceAssignments (ComplianceId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.UserComplianceAssignments')
      AND [name] = 'IX_UserComplianceAssignments_UserId'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserComplianceAssignments_UserId
        ON dbo.UserComplianceAssignments (UserId);
END;

PRINT 'UserComplianceAssignments migration completed.';
