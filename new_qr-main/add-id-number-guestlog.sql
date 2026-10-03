-- ============================================
-- Add id_number field to guestlog table
-- ============================================
-- This migration adds the id_number field to store
-- driver's license ID number for guest entries

ALTER TABLE guestlog 
ADD COLUMN IF NOT EXISTS id_number VARCHAR(50);

-- Add index for faster lookups by id_number
CREATE INDEX IF NOT EXISTS idx_guestlog_id_number ON guestlog(id_number);

-- ============================================
-- Verification Query
-- ============================================
-- Check the table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'guestlog'
-- ORDER BY ordinal_position;
