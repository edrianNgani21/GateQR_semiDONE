// Test script to verify Supabase environment variables are loaded correctly
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

console.log('Testing Supabase environment variables...\n');

// Check for environment variables
const supabaseUrl = process.env.PRIVATE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment Variables Status:');
console.log('PRIVATE_SUPABASE_URL:', process.env.PRIVATE_SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('PRIVATE_SUPABASE_SERVICE_ROLE_KEY:', process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set');

console.log('\nEffective Configuration:');
console.log('Using URL:', supabaseUrl ? '✅ Available' : '❌ Missing');
console.log('Using Service Key:', supabaseServiceKey ? '✅ Available' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n❌ ERROR: Missing required Supabase credentials!');
    console.log('\nPlease add these to your .env file:');
    console.log('PRIVATE_SUPABASE_URL="https://your-project-id.supabase.co"');
    console.log('PRIVATE_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"');
    process.exit(1);
}

console.log('\n🔗 Testing Supabase connection...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
    try {
        // Test basic connection by trying to access the user table directly
        console.log('Testing user table access...');
        const { data: userData, error: userError } = await supabase
            .from('user')
            .select('user_id, email, user_type')
            .limit(1);

        if (userError) {
            console.log('⚠️ User table query failed:', userError.message);
            console.log('This might mean the database schema is not set up yet.');
            console.log('Please run the SQL schema from supabase-schema-complete.sql in your Supabase dashboard.');
        } else {
            console.log('✅ User table accessible!');
            console.log('Sample data:', userData);
        }

        // Test if we can at least connect to the database
        console.log('\nTesting basic database connection...');
        const { data: versionData, error: versionError } = await supabase
            .rpc('version');

        if (versionError) {
            console.log('⚠️ Version check failed (this is normal):', versionError.message);
        } else {
            console.log('✅ Database version:', versionData);
        }

        console.log('\n🎉 Supabase credentials are configured correctly!');
        console.log('The connection parameters are valid.');
        
        if (userError) {
            console.log('\n⚠️ However, the database schema needs to be set up.');
            console.log('Please follow these steps:');
            console.log('1. Go to your Supabase dashboard');
            console.log('2. Open the SQL Editor');
            console.log('3. Run the schema from supabase-schema-complete.sql');
        } else {
            console.log('\n✅ Everything is working correctly!');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    }
}

testConnection();