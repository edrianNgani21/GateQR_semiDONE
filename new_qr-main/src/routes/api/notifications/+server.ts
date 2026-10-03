import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ locals }) => {
    try {
        // Check if user is authenticated
        if (!locals.user) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = locals.user.user_id;
        console.log('Fetching notifications for user_id:', userId);

        // Fetch notifications for the current user with actor email
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select(`
                *,
                user:user_id(email),
                actor:actor_id(email)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        console.log('Notifications query result:', { error, count: notifications?.length });

        if (error) {
            console.error('Error fetching notifications:', error);
            return json({ error: 'Failed to fetch notifications' }, { status: 500 });
        }

        return json({ notifications: notifications || [] });
    } catch (error) {
        console.error('Notifications API error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};