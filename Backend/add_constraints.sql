-- Additional constraints to improve database integrity
-- Run these commands in your PostgreSQL database

-- Note: No unique constraint on (user_id, community_id) to allow 
-- users to join the same community multiple times if needed

-- Add index for better query performance on status filtering
CREATE INDEX idx_memberships_status ON memberships(status);

-- Optional: Add check constraint to ensure role is valid
ALTER TABLE memberships 
ADD CONSTRAINT check_role CHECK (role IN ('HEAD', 'ADMIN', 'MEMBER'));

-- Optional: Add check constraint for status values
ALTER TABLE memberships 
ADD CONSTRAINT check_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'BANNED', 'LEFT'));

