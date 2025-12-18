-- Create ChatMessages table for team messaging
-- Run this in Azure Portal Query Editor

CREATE TABLE ChatMessages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SenderId INT NOT NULL,
    ReceiverId INT NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    SentAt DATETIME DEFAULT GETDATE(),
    IsRead BIT DEFAULT 0,
    ReadAt DATETIME NULL,
    FOREIGN KEY (SenderId) REFERENCES Users(Id),
    FOREIGN KEY (ReceiverId) REFERENCES Users(Id)
);

-- Add indexes for better query performance
CREATE INDEX IX_ChatMessages_SenderId ON ChatMessages(SenderId);
CREATE INDEX IX_ChatMessages_ReceiverId ON ChatMessages(ReceiverId);
CREATE INDEX IX_ChatMessages_SentAt ON ChatMessages(SentAt DESC);
CREATE INDEX IX_ChatMessages_Unread ON ChatMessages(ReceiverId, IsRead) WHERE IsRead = 0;

PRINT 'ChatMessages table created successfully!';
