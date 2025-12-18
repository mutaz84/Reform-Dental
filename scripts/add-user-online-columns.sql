-- Add IsOnline and LastSeen columns to Users table
-- Run this AFTER create-chat-tables.sql

-- Step 1: Add the IsOnline column
ALTER TABLE Users ADD IsOnline BIT DEFAULT 0;

-- Step 2: Add the LastSeen column  
ALTER TABLE Users ADD LastSeen DATETIME NULL;

PRINT 'User online columns added successfully!';
