-- ============================================
-- Database Migration: settings -> parking_availability
-- ============================================

-- Step 1: Create the parking_availability table
CREATE TABLE IF NOT EXISTS parking_availability (
    id INTEGER PRIMARY KEY DEFAULT 1,
    max_capacity INTEGER DEFAULT -1,
    registration_open BOOLEAN DEFAULT true,
    gate_access_filter TEXT DEFAULT 'all',
    gate_access_filter_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Migrate data from settings to parking_availability
-- This will only insert if the parking_availability table is empty
INSERT INTO parking_availability (id, max_capacity, registration_open, gate_access_filter, gate_access_filter_reason)
SELECT 
    id,
    max_capacity,
    registration_open,
    gate_access_filter,
    gate_access_filter_reason
FROM settings
WHERE id = 1
ON CONFLICT (id) DO UPDATE SET
    max_capacity = EXCLUDED.max_capacity,
    registration_open = EXCLUDED.registration_open,
    gate_access_filter = EXCLUDED.gate_access_filter,
    gate_access_filter_reason = EXCLUDED.gate_access_filter_reason,
    updated_at = NOW();

-- Step 3: Add default record if parking_availability is empty and settings doesn't exist
INSERT INTO parking_availability (id, max_capacity, registration_open, gate_access_filter)
VALUES (1, -1, true, 'all')
ON CONFLICT (id) DO NOTHING;

-- Step 4: (Optional) Drop the settings table after successful migration
-- Uncomment the line below ONLY after verifying that the migration was successful
-- DROP TABLE IF EXISTS settings;

-- ============================================
-- Verification Queries
-- ============================================

-- Check parking_availability table structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'parking_availability';

-- Verify data in parking_availability
-- SELECT * FROM parking_availability WHERE id = 1;

-- Check if settings table still exists (for verification)
-- SELECT COUNT(*) FROM settings WHERE id = 1;