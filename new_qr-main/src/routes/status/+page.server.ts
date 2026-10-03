import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/login');
    }

    try {
        // First get the user_id from the user table
        const { data: users } = await supabase
            .from('user')
            .select('user_id')
            .eq('email', locals.user.email)
            .single();

        if (!users) {
            console.error('Error fetching user');
            return {
                userEmail: locals.user.email,
                scheduledCount: 0,
                application: null
            };
        }

        const userId = users.user_id;

        // Fetch the most recent application for this user with vehicle information
        const { data: applications } = await supabase
            .from('registration')
            .select(`
                *,
                department:department_id(
                    department,
                    email
                ),
                vehicle_information:vehicle_information_id(
                    or_document,
                    cr_document,
                    drivers_license,
                    school_id,
                    authorization_letter,
                    plate_number,
                    brand,
                    color,
                    type
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Count complaints with a schedule (new alert for the user)
        const { count: scheduledCount } = await supabase
            .from('complaint')
            .select('*', { count: 'exact', head: true })
            .eq('user_email', locals.user.email)
            .not('schedule', 'is', null)
            .neq('status', 'resolved');

        const application = applications ? {
            ...applications,
            // Map Supabase column names to match frontend expectations
            id: applications.registration_id, // Map registration_id to id
            department_name: applications.department?.department || '-',
            department_email: applications.department?.email || '-',
            user: { email: locals.user.email },
            // Map vehicle information fields to match frontend document expectations
            doc_id: applications.vehicle_information?.school_id || null,
            doc_load: applications.enrollment_form || null,
            doc_or: applications.vehicle_information?.or_document || null,
            doc_cr: applications.vehicle_information?.cr_document || null,
            doc_license: applications.vehicle_information?.drivers_license || null,
            doc_letter: applications.vehicle_information?.authorization_letter || null,
            // Map vehicle details
            vehicle_make: applications.vehicle_information?.brand || 'Unknown',
            vehicle_color: applications.vehicle_information?.color || '-',
            vehicle_plate: applications.vehicle_information?.plate_number || '-',
            vehicle_type: applications.vehicle_information?.type || '-'
        } : null;

        return {
            userEmail: locals.user.email,
            scheduledCount: scheduledCount || 0,
            application
        };
    } catch (error) {
        console.error('Error loading status:', error);
        return {
            userEmail: locals.user.email,
            scheduledCount: 0,
            application: null
        };
    }
};
