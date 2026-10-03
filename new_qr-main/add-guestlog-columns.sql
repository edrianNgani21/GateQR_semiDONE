-- ============================================
-- Add Missing Columns to guestlog Table
-- ============================================
-- This adds the necessary columns to guestlog table
-- to support manual visitor/concessionaire entry system

-- Add missing columns for manual visitor entry
ALTER TABLE guestlog
ADD COLUMN IF NOT EXISTS name VARCHAR(150),
ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS purpose VARCHAR(200);

-- ============================================
-- Verification Queries
-- ============================================

-- Check the updated table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'guestlog'
-- ORDER BY ordinal_position;

-- Verify the columns were added
-- SELECT * FROM guestlog LIMIT 1;