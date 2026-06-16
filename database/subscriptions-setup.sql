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

PRINT '=============================================';
PRINT 'Subscription tables setup complete.';
PRINT '=============================================';
