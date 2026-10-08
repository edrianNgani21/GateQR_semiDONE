-- Run this once in the Supabase SQL editor.
-- Stores settings for the vehicle sticker application form with foreign key reference to "user" table.
CREATE TABLE IF NOT EXISTS application_form_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL,
    updated_by_email VARCHAR(255) REFERENCES "user"(email) ON DELETE SET NULL
);

-- In case the table already exists, safely add the new foreign key columns:
ALTER TABLE application_form_settings ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL;
ALTER TABLE application_form_settings ADD COLUMN IF NOT EXISTS updated_by_email VARCHAR(255) REFERENCES "user"(email) ON DELETE SET NULL;

-- The form is open by default.
INSERT INTO application_form_settings (key, value)
VALUES ('application_form_open', 'true')
ON CONFLICT (key) DO NOTHING;
