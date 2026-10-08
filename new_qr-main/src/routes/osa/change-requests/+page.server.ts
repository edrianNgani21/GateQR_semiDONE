import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'osa') {
        throw redirect(303, '/login');
    }

    try {
        const { data: rows, error } = await supabase
            .from('change_vehicle_requests')
            .select(`
                *,
                user:user_id(
                    user_id,
                    email
                ),
                registration:registration_id(
                    registration_id,
                    first_name,
                    last_name,
                    mobile,
                    role,
                    campus,
                    year_level,
                    status,
                    dist_sched,
                    department:department_id(
                        department,
                        email
                    )
                ),
                original_vehicle:original_vehicle_id(
                    vehicle_information_id,
                    brand,
                    color,
                    plate_number,
                    type,
                    or_document,
                    cr_document,
                    drivers_license,
                    authorization_letter
                )
            `)
            .order('requested_at', { ascending: false });

        if (error) {
            console.error('Error fetching change vehicle requests:', error);
        }

        // Fetch new vehicles if new_vehicle_id is present
        const newVehicleIds = (rows || [])
            .map((r: any) => r.new_vehicle_id)
            .filter(Boolean);

        let newVehiclesMap = new Map<number, any>();
        if (newVehicleIds.length > 0) {
            const { data: newVehicles } = await supabase
                .from('vehicle_information')
                .select('*')
                .in('vehicle_information_id', newVehicleIds);

            (newVehicles || []).forEach((v: any) => {
                newVehiclesMap.set(v.vehicle_information_id, v);
            });
        }

        const requests = (rows || []).map((req: any) => {
            const reg = req.registration || {};
            const orig = req.original_vehicle || {};
            const newVeh = req.new_vehicle_id ? newVehiclesMap.get(req.new_vehicle_id) : null;

            return {
                request_id: req.request_id,
                user_id: req.user_id,
                registration_id: req.registration_id,
                reason: req.reason || 'No reason provided',
                status: req.status || 'Pending',
                requested_at: req.requested_at,
                processed_at: req.processed_at,
                applicant: {
                    name: `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || 'Unknown Applicant',
                    email: req.user?.email || '-',
                    mobile: reg.mobile || '-',
                    role: reg.role || 'student',
                    campus: reg.campus || '-',
                    department: reg.department?.department || '-',
                    department_email: reg.department?.email || '-',
                    year_level: reg.year_level || null,
                    registration_status: reg.status || '-',
                    dist_sched: reg.dist_sched || null
                },
                current_vehicle: {
                    brand: orig.brand || 'Unknown',
                    color: orig.color || '-',
                    plate_number: orig.plate_number || '-',
                    type: orig.type || '-'
                },
                new_vehicle: {
                    brand: newVeh?.brand || 'Unknown',
                    color: newVeh?.color || 'Not Specified',
                    plate_number: newVeh?.plate_number || 'Not Specified',
                    type: newVeh?.type || '-',
                    is_owner: true,
                    doc_or: newVeh?.or_document || null,
                    doc_cr: newVeh?.cr_document || null,
                    doc_license: newVeh?.drivers_license || null,
                    doc_letter: newVeh?.authorization_letter || null
                }
            };
        });

        return {
            requests,
            userEmail: locals.user.email
        };
    } catch (err) {
        console.error('Error loading change requests:', err);
        return {
            requests: [],
            userEmail: locals.user.email
        };
    }
};
