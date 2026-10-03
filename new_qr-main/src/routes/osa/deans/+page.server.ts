import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    // RBAC: Only OSA
    if (!locals.user || locals.user.role !== 'osa') {
        throw redirect(303, '/login');
    }

    try {
        // Fetch all deans
        const { data: deanRows } = await supabase
            .from('user')
            .select('*')
            .eq('user_type', 'dean')
            .order('created_at', { ascending: false });

        const deans = (deanRows || []).map(dean => ({
            user_id: dean.user_id,
            email: dean.email,
            department_id: dean.department_id,
            created_at: dean.created_at
        }));

        // Fetch all departments for assignment dropdown
        const { data: deptRows } = await supabase
            .from('department')
            .select('*')
            .order('department', { ascending: true });

        const departments = (deptRows || []).map(dept => ({
            department_id: dept.department_id,
            department: dept.department,
            is_active: dept.is_active ?? true
        }));

        return {
            deans,
            departments,
            userEmail: locals.user.email
        };
    } catch (error) {
        console.error('Error loading deans:', error);
        return {
            deans: [],
            departments: [],
            userEmail: locals.user.email
        };
    }
};