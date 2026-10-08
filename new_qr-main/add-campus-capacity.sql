-- Add campus and event_name to parking_availability table
ALTER TABLE parking_availability
ADD COLUMN campus TEXT DEFAULT 'Main Campus',
ADD COLUMN event_name TEXT;

-- Update existing records to have 'Main Campus' if needed (already handled by DEFAULT)
