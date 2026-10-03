-- ============================================
-- Add System Settings Columns to Parking_availability Table
-- ============================================
-- This adds the necessary columns to parking_availability table
-- to support system settings while keeping its original parking tracking functionality

-- Add missing columns for system settings to parking_availability table
ALTER TABLE parking_availability 
ADD COLUMN IF NOT EXISTS id INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT -1,
ADD COLUMN IF NOT EXISTS registration_open BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gate_access_filter TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS gate_access_filter_reason TEXT;

-- Add unique constraint on id column for settings record
ALTER TABLE parking_availability 
ADD CONSTRAINT parking_availability_id_unique UNIQUE (id);

-- Create a default settings record if it doesn't exist
INSERT INTO parking_availability (id, max_capacity, registration_open, gate_access_filter)
VALUES (1, -1, true, 'all')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verification Queries
-- ============================================

-- Check the updated table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'parking_availability'
-- ORDER BY ordinal_position;

-- Verify the settings record exists
-- SELECT * FROM parking_availability WHERE id = 1;