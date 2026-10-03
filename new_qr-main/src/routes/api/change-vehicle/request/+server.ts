import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

export async function POST({ request, locals }: RequestEvent) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { vehicle_id } = await request.json();

        if (!vehicle_id) {
            return json({ error: 'Vehicle ID is required' }, { status: 400 });
        }

        // Check if user has a registration
        const { data: userData, error: userError } = await supabaseAdmin
            .from('user')
            .select('User_ID')
            .eq('email', locals.user.email)
            .single();

        if (userError || !userData) {
            return json({ error: 'User not found' }, { status: 404 });
        }

        const { data: registrations, error: regError } = await supabaseAdmin
            .from('registration')
            .select('*')
            .eq('User_ID', userData.User_ID)
            .eq('vehicle_id', vehicle_id)
            .single();

        if (regError || !registrations) {
            return json({ error: 'No record to be changed' }, { status: 400 });
        }

        const registration = registrations;

        // Check if there's already a pending change request
        const { data: existingRequests, error: checkError } = await supabaseAdmin
            .from('change_vehicle_requests')
            .select('*')
            .eq('user_id', registration.User_ID)
            .eq('original_vehicle_id', vehicle_id)
            .eq('status', 'pending');

        if (checkError) throw checkError;

        if (existingRequests && existingRequests.length > 0) {
            return json({ error: 'You already have a pending change vehicle request' }, { status: 400 });
        }

        // Create a change vehicle request
        const { error: insertError } = await supabaseAdmin
            .from('change_vehicle_requests')
            .insert([{
                user_id: registration.User_ID,
                original_vehicle_id: vehicle_id,
                new_vehicle_make: registration.vehicle_make,
                new_vehicle_plate: registration.vehicle_plate,
                new_vehicle_type: registration.vehicle_type,
                new_is_owner: registration.is_owner,
                status: 'pending'
            }]);

        if (insertError) throw insertError;

        return json({ message: 'Change vehicle request submitted successfully' });
    } catch (error) {
        console.error('Change vehicle request error:', error);
        return json({ error: 'Failed to submit change vehicle request' }, { status: 500 });
    }
};