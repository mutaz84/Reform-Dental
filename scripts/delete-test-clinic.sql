-- Delete the test clinic "Reform Dentistry" that was mistakenly created
-- This is a soft delete (sets IsActive = 0)

UPDATE Clinics 
SET IsActive = 0, ModifiedDate = GETUTCDATE() 
WHERE Id = 1 AND Name = 'Reform Dentistry';

-- Verify it's deleted
SELECT Id, Name, IsActive FROM Clinics;
