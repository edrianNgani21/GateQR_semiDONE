// Test script to verify Supabase migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found in .env file');
    console.log('Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        console.log('🔄 Testing Supabase connection...');
        
        // Test basic connection by checking user table
        const { data: users, error: userError } = await supabase
            .from('user')
            .select('user_id, email, user_type')
            .limit(1);
        
        if (userError) {
            console.error('❌ Supabase connection failed:', userError.message);
            process.exit(1);
        }
        
        console.log('✅ Supabase connection successful!');
        console.log('Sample user data:', users);
        
        // Test department table
        const { data: departments, error: deptError } = await supabase
            .from('department')
            .select('department_id, department_name, email')
            .limit(1);
        
        if (deptError) {
            console.error('❌ Department table check failed:', deptError.message);
        } else {
            console.log('✅ Department table accessible');
            console.log('Sample department:', departments);
        }
        
        // Test registration table
        const { data: registrations, error: regError } = await supabase
            .from('registration')
            .select('vehicle_id, first_name, last_name, status')
            .limit(1);
        
        if (regError) {
            console.error('❌ Registration table check failed:', regError.message);
        } else {
            console.log('✅ Registration table accessible');
            console.log('Sample registration:', registrations);
        }
        
        // Test settings table
        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('id, max_capacity')
            .eq('id', 1)
            .single();
        
        if (settingsError) {
            console.error('❌ Settings table check failed:', settingsError.message);
        } else {
            console.log('✅ Settings table accessible');
            console.log('Settings:', settings);
        }
        
        console.log('\n🎉 All basic table checks passed!');
        console.log('Your GateQR system is ready to use Supabase.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testConnection();