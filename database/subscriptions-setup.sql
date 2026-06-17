-- =============================================
-- Reform Dental - Subscriptions Setup Script
-- Run this in Azure Portal Query Editor (idempotent — safe to re-run)
-- Creates: SubscriptionPlans, Subscriptions, SubscriptionClinics, SubscriptionEvents
-- =============================================

-- =============================================
-- 1. SUBSCRIPTION PLANS TABLE (admin-defined plans)
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SubscriptionPlans' AND xtype='U')
BEGIN
    CREATE TABLE SubscriptionPlans (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Price DECIMAL(10,2) NOT NULL DEFAULT 0,
        BillingCycle NVARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly'
        MaxClinics INT NOT NULL DEFAULT 1,
        MaxUsers INT NULL,                                    -- NULL = unlimited
        Features NVARCHAR(MAX),                               -- JSON array of feature strings
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME NOT NULL DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME NULL
    );
    PRINT 'Created SubscriptionPlans table';
END
ELSE
    PRINT 'SubscriptionPlans table already exists';
GO

-- =============================================
-- 2. SUBSCRIPTIONS TABLE (one row per subscriber)
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Subscriptions' AND xtype='U')
BEGIN
    CREATE TABLE Subscriptions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OwnerUserId INT NOT NULL,                             -- the person paying (FK to Users.Id)
        PlanId INT NOT NULL,                                  -- FK to SubscriptionPlans.Id
        Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
            -- 'pending' | 'active' | 'cancellation_requested' | 'cancelled' | 'rejected' | 'paused'
        RequestedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        ApprovedAt DATETIME NULL,
        CancelledAt DATETIME NULL,
        NextRenewalDate DATE NULL,
        LastPaidOn DATE NULL,
        Notes NVARCHAR(MAX),
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME NOT NULL DEFAULT GETUTCDATE(),
        ModifiedDate DATETIME NULL,
        CONSTRAINT FK_Subscriptions_Plan FOREIGN KEY (PlanId) REFERENCES SubscriptionPlans(Id)
    );
    PRINT 'Created Subscriptions table';
END
ELSE
    PRINT 'Subscriptions table already exists';
GO

-- =============================================
-- 3. SUBSCRIPTION CLINICS TABLE (which clinics each subscription covers)
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SubscriptionClinics' AND xtype='U')
BEGIN
    CREATE TABLE SubscriptionClinics (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SubscriptionId INT NOT NULL,
        ClinicId INT NOT NULL,
        AddedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_SubscriptionClinics_Sub FOREIGN KEY (SubscriptionId) REFERENCES Subscriptions(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_SubscriptionClinics_Pair UNIQUE (SubscriptionId, ClinicId)
    );
    PRINT 'Created SubscriptionClinics table';
END
ELSE
    PRINT 'SubscriptionClinics table already exists';
GO

-- =============================================
-- 4. SUBSCRIPTION EVENTS TABLE (audit log)
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SubscriptionEvents' AND xtype='U')
BEGIN
    CREATE TABLE SubscriptionEvents (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SubscriptionId INT NOT NULL,
        EventType NVARCHAR(50) NOT NULL,
            -- 'requested' | 'approved' | 'rejected' | 'cancelled' | 'plan_changed'
            -- | 'clinic_added' | 'clinic_removed' | 'paid' | 'note'
        ActorUserId INT NULL,
        Payload NVARCHAR(MAX),                                -- JSON details
        CreatedDate DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_SubscriptionEvents_Sub FOREIGN KEY (SubscriptionId) REFERENCES Subscriptions(Id) ON DELETE CASCADE
    );
    PRINT 'Created SubscriptionEvents table';
END
ELSE
    PRINT 'SubscriptionEvents table already exists';
GO

-- =============================================
-- 4b. ADD TRIAL COLUMN (idempotent)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Subscriptions' AND COLUMN_NAME='TrialEndsAt')
BEGIN
    ALTER TABLE Subscriptions ADD TrialEndsAt DATETIME NULL;
    PRINT 'Added TrialEndsAt column to Subscriptions';
END
ELSE
    PRINT 'TrialEndsAt column already exists';
GO

-- =============================================
-- 4c. SUBSCRIPTION REQUESTS TABLE (subscriber change/cancel/support requests)
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SubscriptionRequests' AND xtype='U')
BEGIN
    CREATE TABLE SubscriptionRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SubscriptionId INT NOT NULL,
        RequestedByUserId INT NOT NULL,
        RequestType NVARCHAR(40) NOT NULL,
            -- 'cancellation' | 'plan_change' | 'add_clinic' | 'billing' | 'pause' | 'contact_change' | 'other'
        CurrentPlanId INT NULL,
        TargetPlanId INT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'open',
            -- 'open' | 'in_review' | 'approved' | 'denied' | 'completed' | 'cancelled'
        Reason NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        AdminResponse NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        ResolvedAt DATETIME NULL,
        ResolvedByUserId INT NULL,
        CONSTRAINT FK_SubscriptionRequests_Sub FOREIGN KEY (SubscriptionId) REFERENCES Subscriptions(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_SubscriptionRequests_SubscriptionId ON SubscriptionRequests (SubscriptionId, CreatedAt DESC);
    CREATE INDEX IX_SubscriptionRequests_Status ON SubscriptionRequests (Status, CreatedAt DESC);
    PRINT 'Created SubscriptionRequests table';
END
ELSE
    PRINT 'SubscriptionRequests table already exists';
GO

-- =============================================
-- 5. SEED DEFAULT PLANS (only if SubscriptionPlans is empty)
-- =============================================
IF NOT EXISTS (SELECT TOP 1 1 FROM SubscriptionPlans)
BEGIN
    INSERT INTO SubscriptionPlans (Name, Description, Price, BillingCycle, MaxClinics, MaxUsers, Features, SortOrder)
    VALUES
        ('Starter',  'Single clinic, up to 10 employees.',                49.00, 'monthly', 1, 10,    '["Up to 10 users","1 clinic","Email support"]',                                  1),
        ('Pro',      'Single clinic, unlimited employees.',               99.00, 'monthly', 1, NULL,  '["Unlimited users","1 clinic","Priority support","Advanced reports"]',           2),
        ('Practice', 'Up to 3 clinics, unlimited employees.',            199.00, 'monthly', 3, NULL,  '["Unlimited users","Up to 3 clinics","Priority support","Advanced reports","Multi-clinic dashboard"]', 3),
        ('Enterprise','Unlimited clinics and employees.',                399.00, 'monthly', 99, NULL, '["Unlimited users","Unlimited clinics","Dedicated support","Advanced reports","Custom integrations"]', 4);
    PRINT 'Seeded 4 default subscription plans';
END
ELSE
    PRINT 'SubscriptionPlans already has rows; skipping seed';
GO

-- =============================================
-- 6. HOUSE SUBSCRIPTION + TENANT BACKFILL (idempotent)
--    Goal: every existing clinic + every legacy data row becomes owned by ONE
--    "house" subscription so the original organization keeps seeing all of its
--    data after we turn on per-tenant filtering. Brand-new self-signup
--    subscribers (with their own Subscription + ClinicId) will see only their
--    own data.
--
--    What this section does:
--      a) Picks the user with the lowest Id as the house owner.
--      b) Picks the highest-tier active plan (or the lowest-Id one) for the house.
--      c) Creates a single 'house' subscription if none yet exists for that user.
--      d) Links EVERY existing clinic to the house subscription via SubscriptionClinics
--         (skipping clinics that are already linked to ANY subscription).
--      e) Backfills NULL ClinicId on tenant-scoped tables to MIN(Clinics.Id).
-- =============================================
DECLARE @houseOwnerId INT, @housePlanId INT, @houseSubId INT, @houseClinicId INT;

SELECT TOP 1 @houseOwnerId = Id FROM Users ORDER BY Id ASC;
IF @houseOwnerId IS NULL
BEGIN
    PRINT '[Backfill] No users found - skipping house subscription setup.';
END
ELSE
BEGIN
    -- Highest-priced active plan (tie broken by lowest Id) so the house gets the most generous limits.
    SELECT TOP 1 @housePlanId = Id FROM SubscriptionPlans
        WHERE IsActive = 1 ORDER BY Price DESC, Id ASC;
    IF @housePlanId IS NULL
        SELECT TOP 1 @housePlanId = Id FROM SubscriptionPlans ORDER BY Id ASC;

    IF @housePlanId IS NULL
    BEGIN
        PRINT '[Backfill] No subscription plans found - run section 5 seed first. Skipping.';
    END
    ELSE
    BEGIN
        -- Find or create the house subscription owned by the lowest-Id user.
        SELECT TOP 1 @houseSubId = Id FROM Subscriptions
            WHERE OwnerUserId = @houseOwnerId
            ORDER BY Id ASC;

        IF @houseSubId IS NULL
        BEGIN
            INSERT INTO Subscriptions (OwnerUserId, PlanId, Status, RequestedAt, ApprovedAt, Notes, IsActive)
            VALUES (@houseOwnerId, @housePlanId, 'active', GETUTCDATE(), GETUTCDATE(),
                    'House subscription - owns all pre-existing data (auto-created by backfill).', 1);
            SET @houseSubId = SCOPE_IDENTITY();
            PRINT '[Backfill] Created house Subscription Id=' + CAST(@houseSubId AS NVARCHAR) +
                  ' for owner UserId=' + CAST(@houseOwnerId AS NVARCHAR) +
                  ' on PlanId=' + CAST(@housePlanId AS NVARCHAR);
        END
        ELSE
            PRINT '[Backfill] Reusing existing house Subscription Id=' + CAST(@houseSubId AS NVARCHAR);

        -- Link EVERY existing clinic to the house subscription IF it isn't already linked to ANY subscription.
        DECLARE @linked INT;
        INSERT INTO SubscriptionClinics (SubscriptionId, ClinicId)
        SELECT @houseSubId, c.Id
            FROM Clinics c
            WHERE NOT EXISTS (SELECT 1 FROM SubscriptionClinics sc WHERE sc.ClinicId = c.Id);
        SET @linked = @@ROWCOUNT;
        PRINT '[Backfill] Linked ' + CAST(@linked AS NVARCHAR) + ' existing clinic(s) to the house subscription.';

        -- Pick the lowest-Id clinic as the default owner for legacy NULL-ClinicId rows.
        SELECT TOP 1 @houseClinicId = Id FROM Clinics ORDER BY Id ASC;
        IF @houseClinicId IS NULL
        BEGIN
            PRINT '[Backfill] No clinics exist yet - cannot backfill ClinicId. Create at least one clinic and re-run.';
        END
        ELSE
        BEGIN
            PRINT '[Backfill] Backfilling NULL ClinicId rows to ClinicId=' + CAST(@houseClinicId AS NVARCHAR);

            -- Helper: walk every tenant-scoped table that has a ClinicId column and set NULLs to @houseClinicId.
            DECLARE @tbl NVARCHAR(128);
            DECLARE @sqlText NVARCHAR(MAX);
            DECLARE @rowCnt INT;

            DECLARE tenant_cur CURSOR LOCAL FAST_FORWARD FOR
                SELECT t.TABLE_NAME
                  FROM INFORMATION_SCHEMA.COLUMNS t
                 WHERE t.COLUMN_NAME = 'ClinicId'
                   AND t.IS_NULLABLE = 'YES'
                   -- skip the membership table itself; it's the source of truth.
                   AND t.TABLE_NAME NOT IN ('SubscriptionClinics', 'UserClinics', 'Clinics')
                 ORDER BY t.TABLE_NAME;

            OPEN tenant_cur;
            FETCH NEXT FROM tenant_cur INTO @tbl;
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @sqlText = N'UPDATE [' + @tbl + N'] SET ClinicId = @cid WHERE ClinicId IS NULL';
                EXEC sp_executesql @sqlText, N'@cid INT', @cid = @houseClinicId;
                SET @rowCnt = @@ROWCOUNT;
                IF @rowCnt > 0
                    PRINT '  [' + @tbl + '] backfilled ' + CAST(@rowCnt AS NVARCHAR) + ' row(s).';
                FETCH NEXT FROM tenant_cur INTO @tbl;
            END;
            CLOSE tenant_cur;
            DEALLOCATE tenant_cur;
        END
    END
END
GO

PRINT '=============================================';
PRINT 'Subscription tables setup complete.';
PRINT '=============================================';
