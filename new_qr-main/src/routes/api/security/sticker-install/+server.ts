import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== 'security') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { registration_id } = await request.json();

        if (!registration_id) {
            return json({ error: 'Registration ID is required' }, { status: 400 });
        }

        // Verify the registration exists and OSA has already released the sticker
        const { data: reg, error: fetchError } = await supabase
            .from('registration')
            .select('registration_id, status, sticker_released_at, sticker_installed_at')
            .eq('registration_id', registration_id)
            .single();

        if (fetchError || !reg) {
            console.error('Registration not found. Fetch error:', fetchError, 'registration_id:', registration_id);
            return json({ error: 'Registration not found' }, { status: 404 });
        }

        if (!reg.sticker_released_at) {
            return json({ error: 'Sticker has not been released by OSA yet' }, { status: 400 });
        }

        if (reg.sticker_installed_at) {
            return json({ error: 'Sticker has already been marked as installed' }, { status: 400 });
        }

        // Mark sticker as installed and update status to completed
        const { error: updateError } = await supabase
            .from('registration')
            .update({
                sticker_installed_at: new Date().toISOString(),
                status: 'completed'
            })
            .eq('registration_id', registration_id);

        if (updateError) {
            console.error('Failed to update sticker installation:', updateError);
            return json({ error: 'Failed to mark sticker as installed' }, { status: 500 });
        }

        return json({ message: 'Sticker marked as installed. Registration completed.' });
    } catch (error) {
        console.error('Sticker install API error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
