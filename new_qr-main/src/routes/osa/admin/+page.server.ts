import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // RBAC: Only OSA
    if (!locals.user || locals.user.role !== 'osa') {
        throw redirect(303, '/login');
    }

    try {
        console.log('Loading OSA-assigned admin users for:', locals.user.email);

        // For now, return empty array as admin management uses different system
        let allAdmins: any[] = [];

        console.log('Processed OSA-assigned admin users:', allAdmins);

        return {
            users: allAdmins,
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