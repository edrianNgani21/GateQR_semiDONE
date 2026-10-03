-- ============================================
-- Create guestlog Table
-- ============================================
-- This creates the guestlog table for manual visitor entry
-- with all required fields for the manual entry system

CREATE TABLE IF NOT EXISTS guestlog (
    guest_id SERIAL PRIMARY KEY,
    ticket_no VARCHAR(20) UNIQUE,
    name VARCHAR(150),
    mobile VARCHAR(20),
    make_model VARCHAR(100),
    plate VARCHAR(20),
    id_number VARCHAR(50),
    purpose VARCHAR(200),
    reason TEXT,
    in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    out TIMESTAMPTZ,
    pic_in VARCHAR(255),
    pic_out VARCHAR(255),
    logged_status VARCHAR(30),
    logged_status_out VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index on ticket_no for faster lookups
CREATE INDEX IF NOT EXISTS idx_guestlog_ticket_no ON guestlog(ticket_no);
CREATE INDEX IF NOT EXISTS idx_guestlog_plate ON guestlog(plate);
CREATE INDEX IF NOT EXISTS idx_guestlog_id_number ON guestlog(id_number);
CREATE INDEX IF NOT EXISTS idx_guestlog_in_out ON guestlog(in, out);

-- ============================================
-- Verification Queries
-- ============================================

-- Check the table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'guestlog'
-- ORDER BY ordinal_position;