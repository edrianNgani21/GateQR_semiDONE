-- Run this in your Supabase SQL Editor to create the events table
CREATE TABLE IF NOT EXISTS campus_events (
    event_id SERIAL PRIMARY KEY,
    campus VARCHAR(255) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
