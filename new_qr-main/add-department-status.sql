-- Add is_active status column to department table for soft deletion
ALTER TABLE department 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN 
NOT NULL 
DEFAULT TRUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_department_is_active 
ON department(is_active);

-- Update existing departments to be active by default
UPDATE department 
SET is_active = TRUE 
WHERE is_active IS NULL;