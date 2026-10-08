-- Migration: Update change_vehicle_requests table to use new_vehicle_id
-- and remove redundant vehicle info columns

ALTER TABLE change_vehicle_requests 
ADD COLUMN IF NOT EXISTS new_vehicle_id INTEGER REFERENCES vehicle_information(vehicle_information_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_change_vehicle_new 
ON change_vehicle_requests(new_vehicle_id);

-- Make reason NOT NULL if desired
-- ALTER TABLE change_vehicle_requests ALTER COLUMN reason SET NOT NULL;
