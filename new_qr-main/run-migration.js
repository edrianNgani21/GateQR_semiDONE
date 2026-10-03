// Script to add is_active column to user table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.PRIVATE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please check your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('Starting migration to add is_active column...');
        
        // Execute the SQL using Supabase's rpc function for raw SQL
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: `
                -- Add is_active column to user table
                ALTER TABLE "user" 
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN 
                NOT NULL 
                DEFAULT TRUE;
                
                -- Create index for performance
                CREATE INDEX IF NOT EXISTS idx_user_is_active 
                ON "user"(is_active);
            `
        });

        if (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }

        console.log('Migration completed successfully!');
        console.log('The is_active column has been added to the user table.');
        
    } catch (error) {
        console.error('Error running migration:', error);
        process.exit(1);
    }
}

runMigration();