import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';

async function createNotification(
    userId: number,
    notificationType: string,
    message: string,
    actorId?: number,
    actionType?: string,
    targetEntityType?: string,
    targetEntityId?: number,
    referenceId?: number,
    metadata?: any
) {
    try {
        await supabase.from('notifications').insert({
            user_id: userId,
            notification_type: notificationType,
            message: message,
            actor_id: actorId || null,
            action_type: actionType || null,
            target_entity_type: targetEntityType || null,
            target_entity_id: targetEntityId || null,
            reference_id: referenceId || null,
            metadata: metadata || null,
            is_read: false
        });
    } catch (e) {
        console.error('Failed to create notification:', e);
    }
}

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'security' && locals.user.role !== 'osa')) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { vehicle_id, action } = await request.json();

        if (!vehicle_id || !action) {
            return json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Fetch user id & user email from registration to send notification
        const { data: reg, error: fetchError } = await supabase
            .from('registration')
            .select('user_id, users:user_id(email)')
            .eq('registration_id', vehicle_id)
            .single();

        if (fetchError || !reg) {
            return json({ error: 'Registration not found' }, { status: 404 });
        }

        let updateData: any = {};
        let notifType = '';
        let notifMessage = '';
        let emailSubject = '';

        if (action === 'security_check') {
            updateData = { security_checked_at: new Date().toISOString() };
            notifType = 'security_checked';
            notifMessage = 'Your application has been reviewed by Safety and Security. Proceed to OSA for sticker release.';
            emailSubject = 'Application Update: Security Check Approved';
        } else if (action === 'install_sticker') {
            updateData = { sticker_installed_at: new Date().toISOString() };
            notifType = 'sticker_installed';
            notifMessage = 'Your sticker has been successfully installed. Registration is now fully complete.';
            emailSubject = 'Application Update: Sticker Installed & Registration Complete';
        } else {
            return json({ error: 'Invalid action' }, { status: 400 });
        }

        const { error: updateError } = await supabase
            .from('registration')
            .update(updateData)
            .eq('registration_id', vehicle_id);

        if (updateError) {
            console.error('Update error:', updateError);
            return json({ error: 'Database update failed' }, { status: 500 });
        }

        if (reg.user_id) {
            await createNotification(
                reg.user_id,
                notifType,
                notifMessage,
                locals.user.user_id,
                action,
                'registration',
                vehicle_id,
                vehicle_id
            );

            // Send email
            const targetEmail = (reg.users as any)?.email;
            if (targetEmail) {
                await sendEmail(targetEmail, emailSubject, notifMessage);
            }
        }

        return json({ success: true });
    } catch (error) {
        console.error('Error in monitor action:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
