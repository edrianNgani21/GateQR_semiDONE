-- ============================================
-- Add guest_type Column to guestlog Table
-- ============================================
-- This adds a guest_type column for guest entries
-- Uses "Guest" as the type

-- Add guest_type column to guestlog table
ALTER TABLE guestlog
ADD COLUMN IF NOT EXISTS guest_type VARCHAR(30) DEFAULT 'Guest';

-- ============================================
-- Verification Queries
-- ============================================

-- Check the updated table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'guestlog'
-- ORDER BY ordinal_position;

-- Verify the column was added
-- SELECT * FROM guestlog LIMIT 1;
