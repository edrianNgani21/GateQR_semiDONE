import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

export async function GET({}: RequestEvent) {
    try {
        // Simple connection test first
        console.log('Testing Supabase connection...');

        // Try to list all tables using a simple query
        const { data: tablesData, error: tablesError } = await supabaseAdmin
            .from('pg_tables')
            .select('tablename')
            .eq('schemaname', 'public')
            .order('tablename');

        console.log('Tables query result:', { error: tablesError, data: tablesData });

        const availableTables = tablesData?.map(t => t.tablename) || [];

        // Try to query user table with different variations
        let result;
        let tableName = 'user';

        // Try lowercase 'user' first
        result = await supabaseAdmin
            .from('user')
            .select('user_id, email, user_type, created_at')
            .eq('user_type', 'Osa')
            .order('created_at', { ascending: false });

        // If that fails, try uppercase 'USER'
        if (result.error) {
            console.log('Trying uppercase USER table...');
            result = await supabaseAdmin
                .from('USER')
                .select('user_id, email, user_type, created_at')
                .eq('user_type', 'Osa')
                .order('created_at', { ascending: false });
            tableName = 'USER';
        }

        // If that still fails, try quoted "user"
        if (result.error) {
            console.log('Trying quoted "user" table...');
            result = await supabaseAdmin
                .from('"user"')
                .select('user_id, email, user_type, created_at')
                .eq('user_type', 'Osa')
                .order('created_at', { ascending: false });
            tableName = '"user"';
        }

        console.log('Admin query test result:', { 
            error: result.error, 
            data: result.data,
            tableNameUsed: tableName 
        });

        if (result.error) {
            return json({ 
                success: false, 
                error: result.error.message,
                details: 'Admin query failed',
                availableTables: availableTables,
                tableNameAttempted: tableName,
                connectionTest: tablesError ? 'Failed' : 'Success'
            }, { status: 500 });
        }

        return json({ 
            success: true, 
            message: 'Admin query successful',
            adminCount: result.data?.length || 0,
            adminUsers: result.data,
            tableNameUsed: tableName,
            availableTables: availableTables
        });
    } catch (error: any) {
        return json({ 
            success: false, 
            error: error.message,
            details: 'Unexpected error during admin query test'
        }, { status: 500 });
    }
}
