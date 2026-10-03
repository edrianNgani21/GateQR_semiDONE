import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// Server-side admin client with full access
const supabaseUrl = env.PRIVATE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Please set PRIVATE_SUPABASE_URL and PRIVATE_SUPABASE_SERVICE_ROLE_KEY in your .env file');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// For server-side use (alias for consistency)
export const supabase = supabaseAdmin;
