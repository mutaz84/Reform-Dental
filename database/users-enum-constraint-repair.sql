/*
  Repairs legacy Users rows that violate current check constraints used by API updates.
  Safe to run multiple times.
*/

SET NOCOUNT ON;

UPDATE u
SET
    StaffType = CASE
        WHEN u.StaffType IN ('clinical', 'non-clinical') THEN u.StaffType
        ELSE 'non-clinical'
    END,
    EmployeeType = CASE
        WHEN u.EmployeeType IN ('provider', 'assistant') THEN u.EmployeeType
        WHEN LOWER(ISNULL(u.JobTitle, '')) LIKE '%dentist%' OR LOWER(ISNULL(u.JobTitle, '')) LIKE '%doctor%' THEN 'provider'
        WHEN LOWER(ISNULL(u.StaffType, '')) = 'clinical' THEN 'provider'
        ELSE 'assistant'
    END,
    EmployeeStatus = CASE
        WHEN u.EmployeeStatus IN ('Active', 'Inactive', 'On Leave', 'Terminated') THEN u.EmployeeStatus
        ELSE 'Active'
    END,
    Role = CASE
        WHEN u.Role IN ('user', 'manager', 'admin') THEN u.Role
        ELSE 'user'
    END,
    ModifiedDate = GETUTCDATE()
FROM dbo.Users u
WHERE
    u.StaffType NOT IN ('clinical', 'non-clinical')
    OR u.StaffType IS NULL
    OR u.EmployeeType NOT IN ('provider', 'assistant')
    OR u.EmployeeType IS NULL
    OR u.EmployeeStatus NOT IN ('Active', 'Inactive', 'On Leave', 'Terminated')
    OR u.EmployeeStatus IS NULL
    OR u.Role NOT IN ('user', 'manager', 'admin')
    OR u.Role IS NULL;

SELECT
    Id,
    Username,
    StaffType,
    EmployeeType,
    EmployeeStatus,
    Role
FROM dbo.Users
WHERE
    StaffType NOT IN ('clinical', 'non-clinical')
    OR EmployeeType NOT IN ('provider', 'assistant')
    OR EmployeeStatus NOT IN ('Active', 'Inactive', 'On Leave', 'Terminated')
    OR Role NOT IN ('user', 'manager', 'admin');
