/*
  UserDutyAssignments migration
  - Creates junction table if missing
  - Backfills from Duties.AssignedToUserId (legacy)
  - Adds uniqueness and performance indexes
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.UserDutyAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserDutyAssignments (
        UserId INT NOT NULL,
        DutyId INT NOT NULL,
        AssignedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserDutyAssignments_AssignedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_UserDutyAssignments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_UserDutyAssignments_Duties FOREIGN KEY (DutyId) REFERENCES dbo.Duties(Id)
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE [type] = 'PK'
      AND [name] = 'PK_UserDutyAssignments'
)
BEGIN
    ALTER TABLE dbo.UserDutyAssignments
    ADD CONSTRAINT PK_UserDutyAssignments PRIMARY KEY CLUSTERED (UserId, DutyId);
END;

-- Legacy backfill from Duties.AssignedToUserId
IF COL_LENGTH('dbo.Duties', 'AssignedToUserId') IS NOT NULL
BEGIN
    INSERT INTO dbo.UserDutyAssignments (UserId, DutyId)
    SELECT d.AssignedToUserId, d.Id
    FROM dbo.Duties d
    WHERE d.AssignedToUserId IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.UserDutyAssignments uda
          WHERE uda.UserId = d.AssignedToUserId
            AND uda.DutyId = d.Id
      );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.UserDutyAssignments')
      AND [name] = 'IX_UserDutyAssignments_DutyId'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserDutyAssignments_DutyId
        ON dbo.UserDutyAssignments (DutyId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.UserDutyAssignments')
      AND [name] = 'IX_UserDutyAssignments_UserId'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserDutyAssignments_UserId
        ON dbo.UserDutyAssignments (UserId);
END;

PRINT 'UserDutyAssignments migration completed.';
