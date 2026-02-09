-- =============================================
-- UserClinics (many-to-many Users <-> Clinics)
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserClinics' AND xtype='U')
BEGIN
    CREATE TABLE UserClinics (
        UserId INT NOT NULL,
        ClinicId INT NOT NULL,
        CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
        PRIMARY KEY (UserId, ClinicId),
        CONSTRAINT FK_UserClinics_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_UserClinics_Clinics FOREIGN KEY (ClinicId) REFERENCES Clinics(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_UserClinics_UserId ON UserClinics(UserId);
    CREATE INDEX IX_UserClinics_ClinicId ON UserClinics(ClinicId);

    PRINT 'Created UserClinics table';
END
ELSE
    PRINT 'UserClinics table already exists';
GO
