import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/login');
    }

    if (locals.user.role !== 'security') {
        if (locals.user.role === 'osa') {
            throw redirect(303, '/osa/dashboard');
        } else if (locals.user.role === 'dean') {
            throw redirect(303, '/dean');
        } else {
            throw redirect(303, '/login');
        }
    }

    return {
        userEmail: locals.user.email,
        userRole: locals.user.role
    };
};
