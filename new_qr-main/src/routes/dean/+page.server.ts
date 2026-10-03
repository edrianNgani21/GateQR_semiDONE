import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'dean') {
        throw redirect(303, '/login');
    }

    const userEmail = locals.user.email;

    try {
        // Fetch department name for the logged-in dean
        let departmentName = '';
        
        if (locals.user.department_id) {
            const { data: departmentData } = await supabase
                .from('department')
                .select('department')
                .eq('department_id', locals.user.department_id)
                .maybeSingle();

            if (departmentData) {
                departmentName = departmentData.department;
            }
        } else {
            // Try to find department by email as fallback
            const { data: deptByEmail } = await supabase
                .from('department')
                .select('department')
                .eq('email', userEmail)
                .maybeSingle();
            
            if (deptByEmail) {
                departmentName = deptByEmail.department;
            }
        }

        // Get the department_id to use for fetching applications
        let departmentIdForQuery = locals.user.department_id;
        
        if (!departmentIdForQuery) {
            // Fallback: get department_id from department table by email
            const { data: deptByEmail } = await supabase
                .from('department')
                .select('department_id')
                .eq('email', userEmail)
                .maybeSingle();
            
            if (deptByEmail) {
                departmentIdForQuery = deptByEmail.department_id;
            }
        }

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
            .eq('department_id', departmentIdForQuery)
            .order('created_at', { ascending: false });

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
            dist_checked: typeof app.dist_checked === 'string' ? app.dist_checked : app.dist_checked?.toISOString(),
            expires_at: typeof app.expires_at === 'string' ? app.expires_at : app.expires_at?.toISOString(),
            revoked_at: typeof app.revoked_at === 'string' ? app.revoked_at : app.revoked_at?.toISOString(),
            rejected_at: typeof app.rejected_at === 'string' ? app.rejected_at : app.rejected_at?.toISOString(),
        }));

        console.log('Dean applications fetched:', applications.length);
        console.log('Department ID used:', departmentIdForQuery);
        console.log('User email:', userEmail);
        console.log('Sample application department:', applications[0]?.department_name);

        return {
            applications,
            userEmail,
            departmentName
        };
    } catch (error) {
        console.error('Error loading dean applications:', error);
        return { applications: [], userEmail, departmentName: '' };
    }
};
