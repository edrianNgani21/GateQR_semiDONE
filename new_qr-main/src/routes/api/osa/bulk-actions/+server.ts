import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== 'osa') {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { registration_ids, action, schedule, reason } = await request.json();

        if (!registration_ids || !Array.isArray(registration_ids) || registration_ids.length === 0) {
            return json({ error: 'Invalid registration IDs' }, { status: 400 });
        }

        if (!action || !['accept', 'reject'].includes(action)) {
            return json({ error: 'Invalid action' }, { status: 400 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const registration_id of registration_ids) {
            try {
                // Fetch user_id for notification
                const { data: reg } = await supabase
                    .from('registration')
                    .select('user_id')
                    .eq('registration_id', registration_id)
                    .single();

                if (action === 'accept') {
                    // Bulk accept with schedule
                    const updateData: any = {
                        status: 'distributed',
                        dist_sched: schedule || null,
                        osa_val_at: new Date().toISOString()
                    };

                    const { error } = await supabase
                        .from('registration')
                        .update(updateData)
                        .eq('registration_id', registration_id);

                    if (error) throw error;
                    results.success++;

                    if (reg?.user_id) {
                        await supabase.from('notifications').insert({
                            user_id: reg.user_id,
                            notification_type: 'application_approved',
                            message: `Your vehicle registration application has been accepted by OSA!${schedule ? ' Scheduled visit: ' + new Date(schedule).toLocaleString() : ''}`,
                            actor_id: locals.user.user_id,
                            action_type: 'approve_application',
                            target_entity_type: 'registration',
                            target_entity_id: registration_id,
                            reference_id: registration_id,
                            is_read: false
                        });
                    }

                } else if (action === 'reject') {
                    // Bulk reject with reason
                    const updateData: any = {
                        status: 'rejected',
                        invalid_reason: reason || 'Bulk rejection',
                        rejected_at: new Date().toISOString()
                    };

                    const { error } = await supabase
                        .from('registration')
                        .update(updateData)
                        .eq('registration_id', registration_id);

                    if (error) throw error;
                    results.success++;

                    if (reg?.user_id) {
                        await supabase.from('notifications').insert({
                            user_id: reg.user_id,
                            notification_type: 'application_rejected',
                            message: `Your vehicle registration application was rejected by OSA. Reason: ${reason || 'Bulk rejection'}`,
                            actor_id: locals.user.user_id,
                            action_type: 'reject_application',
                            target_entity_type: 'registration',
                            target_entity_id: registration_id,
                            reference_id: registration_id,
                            is_read: false
                        });
                    }
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Registration ID ${registration_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return json({
            message: `Bulk ${action} completed`,
            results
        });

    } catch (error) {
        console.error('Bulk action error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};