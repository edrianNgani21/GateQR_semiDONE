import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
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
        await supabaseAdmin.from('notifications').insert({
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
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}

export async function POST({ request, locals }: RequestEvent) {
    if (!locals.user || locals.user.role !== 'osa') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { request_id, action, schedule, rejection_reason } = await request.json();

        if (!request_id || !action) {
            return json({ error: 'Request ID and action are required' }, { status: 400 });
        }

        // Get the change request details
        const { data: changeRequest, error: queryError } = await supabaseAdmin
            .from('change_vehicle_requests')
            .select(`
                *,
                registration:registration_id(
                    *,
                    user:user_id(user_id, email),
                    vehicle_information:vehicle_information_id(*)
                ),
                new_vehicle:new_vehicle_id(brand, plate_number)
            `)
            .eq('request_id', request_id)
            .single();

        if (queryError || !changeRequest) {
            return json({ error: 'Change vehicle request not found' }, { status: 404 });
        }

        const registration = changeRequest.registration;
        const targetUserId = changeRequest.user_id || registration?.user_id;

        // Get actor user_id
        const { data: actorUser } = await supabaseAdmin
            .from('user')
            .select('user_id')
            .eq('email', locals.user.email)
            .single();
        const actorId = actorUser?.user_id || null;

        if (action === 'approve' || action === 'accept') {
            if (!schedule) {
                return json({ error: 'A schedule date and time is required to proceed with hardcopies compliance' }, { status: 400 });
            }

            const scheduleDate = new Date(schedule).toISOString();

            // 1. Update change request status to approved
            const { error: updateReqError } = await supabaseAdmin
                .from('change_vehicle_requests')
                .update({ 
                    status: 'approved',
                    processed_at: new Date().toISOString(),
                    processed_by: actorId
                })
                .eq('request_id', request_id);

            if (updateReqError) throw updateReqError;

            // 2. Move registration into the system application flow at Manage Applications:
            // Status -> 'distributed', dist_sched -> schedule, reset compliance timestamps for the new vehicle
            const { error: updateRegError } = await supabaseAdmin
                .from('registration')
                .update({ 
                    status: 'distributed',
                    dist_sched: scheduleDate,
                    vehicle_information_id: changeRequest.new_vehicle_id,
                    osa_dist_at: null,
                    security_checked_at: null,
                    sticker_released_at: null,
                    sticker_installed_at: null,
                    invalid_reason: null
                })
                .eq('registration_id', changeRequest.registration_id);

            if (updateRegError) throw updateRegError;

            // 3. Notify user via email
            const applicantEmail = registration?.user?.email;
            const newPlate = changeRequest.new_vehicle?.plate_number || 'your new vehicle';
            const newMake = changeRequest.new_vehicle?.brand || '';
            const schedStr = new Date(schedule).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

            if (applicantEmail) {
                await sendEmail(
                    applicantEmail,
                    'Request to Change Registration Details Accepted — Schedule for Hardcopy Compliance',
                    `Your request to change registration details for ${newMake} (${newPlate}) has been accepted by OSA. You are scheduled to visit OSA on ${schedStr} to submit hardcopies of your vehicle requirements for compliance.`,
                    `<h3>Request to Change Registration Details Accepted</h3>
                    <p>Good news! Your request to change registration details has been accepted by the Office of Student Affairs (OSA).</p>
                    <p><strong>New Vehicle:</strong> ${newMake} (${newPlate})</p>
                    <p><strong>Scheduled Visit for Hardcopy Compliance:</strong> ${schedStr}</p>
                    <p>Please visit the OSA office at the scheduled time to submit the notarized hardcopies of your requirements (OR, CR, Driver's License, and Authorization Letter if applicable) to proceed with sticker issuance.</p>`
                );
            }

            // 4. Create in-app notification
            if (targetUserId) {
                await createNotification(
                    targetUserId,
                    'registration_change_approved',
                    `Your request to change registration details was accepted! Scheduled for hardcopy compliance on: ${schedStr}`,
                    actorId,
                    'approve_registration_change',
                    'change_vehicle_request',
                    request_id,
                    changeRequest.registration_id,
                    { schedule: scheduleDate }
                );
            }

            return json({ 
                success: true, 
                message: 'Registration change request accepted. Application has moved to Hardcopy Compliance Schedules.' 
            });
        } 
        else if (action === 'reject') {
            const reason = (rejection_reason || 'Request did not meet requirements').trim();

            const { error: updateReqError } = await supabaseAdmin
                .from('change_vehicle_requests')
                .update({ 
                    status: 'rejected',
                    processed_at: new Date().toISOString(),
                    processed_by: actorId
                })
                .eq('request_id', request_id);

            if (updateReqError) throw updateReqError;

            const applicantEmail = registration?.user?.email;
            if (applicantEmail) {
                await sendEmail(
                    applicantEmail,
                    'Request to Change Registration Details Rejected — Liceo GateQR',
                    `Your request to change registration details has been rejected by OSA. Reason: ${reason}`,
                    `<h3>Request to Change Registration Details Rejected</h3>
                    <p>Your request to change registration details was reviewed and has been rejected by OSA.</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p>Please contact the Office of Student Affairs for inquiries.</p>`
                );
            }

            if (targetUserId) {
                await createNotification(
                    targetUserId,
                    'registration_change_rejected',
                    `Your request to change registration details was rejected by OSA. Reason: ${reason}`,
                    actorId,
                    'reject_registration_change',
                    'change_vehicle_request',
                    request_id,
                    changeRequest.registration_id,
                    { reason }
                );
            }

            return json({ success: true, message: 'Registration change request rejected successfully.' });
        } else {
            return json({ error: 'Invalid action specified' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Change vehicle approval error:', error);
        return json({ error: error.message || 'Failed to process change vehicle request' }, { status: 500 });
    }
}