import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals, cookies }) => {
    if (!locals.user || locals.user.role !== 'osa') {
        throw redirect(303, '/login');
    }

    const userEmail = locals.user.email;

    try {
        const { data: rows } = await supabase
            .from('registration')
            .select(`
                *,
                department:department_id(
                    department,
                    email
                ),
                user:user_id(
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
            .order('created_at', { ascending: false });

        console.log('Raw registration rows:', rows?.length || 0);
        console.log('Sample row:', rows?.[0]);
        console.log('Sample department data:', rows?.[0]?.department);
        console.log('All application statuses:', rows?.map(r => ({ id: r.registration_id, status: r.status, department_id: r.department_id })));

        const activeTab = cookies.get('osa_active_tab') || 'validation';

        const applications = (rows || []).map(app => ({
            ...app,
            id: app.registration_id, // Map registration_id to id
            department_name: app.department?.department || 'Unknown Department',
            department_email: app.department?.email || '-',
            user_email: app.user?.email,
            // Map vehicle information fields to match frontend expectations
            doc_id: app.vehicle_information?.school_id || null,
            doc_load: app.enrollment_form || null,
            doc_or: app.vehicle_information?.or_document || null,
            doc_cr: app.vehicle_information?.cr_document || null,
            doc_license: app.vehicle_information?.drivers_license || null,
            doc_letter: app.vehicle_information?.authorization_letter || null,
            // Map vehicle details
            vehicle_make: app.vehicle_information?.brand || 'Unknown',
            vehicle_color: app.vehicle_information?.color || '-',
            vehicle_plate: app.vehicle_information?.plate_number || '-',
            vehicle_type: app.vehicle_information?.type || '-',
            qr_code: app.qr_code || null,
            created_at: typeof app.created_at === 'string' ? app.created_at : app.created_at?.toISOString(),
            dept_val_at: typeof app.dept_val_at === 'string' ? app.dept_val_at : app.dept_val_at?.toISOString(),
            osa_val_at: typeof app.osa_val_at === 'string' ? app.osa_val_at : app.osa_val_at?.toISOString(),
            osa_dist_at: typeof app.osa_dist_at === 'string' ? app.osa_dist_at : app.osa_dist_at?.toISOString(),
            dist_sched: typeof app.dist_sched === 'string' ? app.dist_sched : app.dist_sched?.toISOString(),
            expires_at: typeof app.expires_at === 'string' ? app.expires_at : app.expires_at?.toISOString(),
            revoked_at: typeof app.revoked_at === 'string' ? app.revoked_at : app.revoked_at?.toISOString(),
            rejected_at: typeof app.rejected_at === 'string' ? app.rejected_at : app.rejected_at?.toISOString(),
        }));

        console.log('OSA applications fetched:', applications.length);
        console.log('Application statuses:', applications.map(a => ({ id: a.id, status: a.status, role: a.role, department: a.department_name })));

        return {
            activeTab,
            applications,
            userEmail
        };
    } catch (error) {
        console.error('Error loading osa applications:', error);
        return { applications: [], userEmail };
    }
};
