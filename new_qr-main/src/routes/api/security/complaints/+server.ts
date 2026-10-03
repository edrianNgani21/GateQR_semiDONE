import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let query = supabase
            .from('complaint')
            .select(`
                *,
                user:user_id(
                    email
                )
            `)
            .order('created_at', { ascending: false });

        // Security users see all complaints, regular users see only their own
        if (locals.user.role !== 'security') {
            // Get user_id from email for regular users
            const { data: userData, error: userError } = await supabase
                .from('user')
                .select('user_id')
                .eq('email', locals.user.email)
                .single();

            if (userError || !userData) {
                return json({ error: 'User not found' }, { status: 404 });
            }

            query = query.eq('user_id', userData.user_id);
        }

        const { data, error } = await query.limit(100);

        if (error) throw error;

        // Map user_email for frontend compatibility
        const complaints = data?.map(c => ({
            ...c,
            user_email: c.user?.email
        })) || [];

        return json({ complaints });
    } catch (error) {
        console.error('Error fetching complaints:', error);
        return json({ error: 'Failed to fetch complaints' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { message } = await request.json();

        if (!message || message.trim() === '') {
            return json({ error: 'Message is required' }, { status: 400 });
        }

        // Get user_id from email
        const { data: userData, error: userError } = await supabase
            .from('user')
            .select('user_id')
            .eq('email', locals.user.email)
            .single();

        if (userError || !userData) {
            return json({ error: 'User not found' }, { status: 404 });
        }

        const { error: insertError } = await supabase
            .from('complaint')
            .insert([{
                user_id: userData.user_id,
                message: message.trim()
            }]);

        if (insertError) throw insertError;

        // Notify Security
        await sendEmail(
            env.SECURITY_EMAIL as string,
            'New Complaint Received',
            `A new complaint has been submitted by ${locals.user.email}.\n\nMessage: ${message.trim()}`,
            `<p>A new complaint has been submitted by <strong>${locals.user.email}</strong>.</p>
             <p><strong>Message:</strong><br/>${message.trim().replace(/\\n/g, '<br>')}</p>
             <p>Please log in to the security dashboard to review.</p>`
        );

        return json({ message: 'Complaint submitted successfully' });
    } catch (error) {
        console.error('Error creating complaint:', error);
        return json({ error: 'Failed to submit complaint' }, { status: 500 });
    }
};