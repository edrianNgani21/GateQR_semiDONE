import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // RBAC: Only OSA
    if (!locals.user || locals.user.role !== 'osa') {
        throw redirect(303, '/login');
    }

    try {
        const res = await fetch('http://localhost:5173/api/osa/admin');
        if (res.ok) {
            const data = await res.json();
            return {
                users: data.users || [],
                userEmail: locals.user.email
            };
        }
        return {
            users: [],
            userEmail: locals.user.email
        };
    } catch (error) {
        console.error('Error loading admin users:', error);
        return {
            users: [],
            userEmail: locals.user.email
        };
    }
};