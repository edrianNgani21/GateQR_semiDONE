-- Add is_active column to user table
ALTER TABLE "user" 
ADD COLUMN is_active BOOLEAN 
NOT NULL 
DEFAULT TRUE;

-- Create index for performance
CREATE INDEX idx_user_is_active 
ON "user"(is_active);