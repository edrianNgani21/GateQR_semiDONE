import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/login');
    }

    if (locals.user.role === 'osa') {
        throw redirect(303, '/osa');
    } else if (locals.user.role === 'security') {
        throw redirect(303, '/security');
    } else if (locals.user.role === 'dean') {
        throw redirect(303, '/dean');
    }

    // Pass the user's email to display in the greeting
    const userEmail = locals.user.email;

    try {
        // Fetch only active departments for the select dropdown from Supabase
        const { data: rows } = await supabase
            .from('department')
            .select('department')
            .eq('is_active', true)
            .order('department', { ascending: true });
        
        return {
            userEmail,
            departments: (rows || []).map(r => r.department)
        };
    } catch (e) {
        return { userEmail, departments: [] };
    }
};
