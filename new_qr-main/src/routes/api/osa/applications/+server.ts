import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import QRCode from 'qrcode';
import { join } from 'path';
import fs from 'fs';
import { sendEmail } from '$lib/server/email';
import { generateStyledQR } from '$lib/server/qr';

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
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}

function generateUniqueCode(length: number = 8): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'osa') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

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
                )
            `)
            .order('created_at', { ascending: false });

        const applications = rows?.map(row => ({
            ...row,
            department_name: row.department?.department,
            department_email: row.department?.email,
            user_email: row.user?.email
        })) || [];

        return json({ applications });
    } catch (error) {
        console.error('Failed to fetch osa applications:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'osa' && locals.user.role !== 'security')) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { registration_id, action, reason, schedule } = await request.json();

        const { data: rows } = await supabase
            .from('registration')
            .select(`
                *,
                user:user_id(
                    email,
                    user_id
                )
            `)
            .eq('registration_id', registration_id)
            .single();

        if (!rows) {
            return json({ error: 'Application not found' }, { status: 404 });
        }

        const reg = rows;

        if (action === 'accept' && (reg.status === 'osa_val' || reg.status === 'dept_val')) {
            if (!schedule) {
                return json({ error: 'Schedule is required to accept application' }, { status: 400 });
            }
            // Generate QR code with unique alphanumeric string
            const uniqueCode = generateUniqueCode(8);
            const qrData = uniqueCode;
            const filename = `qr-${registration_id}-${Date.now()}.png`;
            const filepath = join(process.cwd(), 'static', 'uploads', filename);

            await generateStyledQR(qrData, reg.role, filepath);
            const qrUrl = `/uploads/${filename}`;

            const expiryMonths = parseInt(process.env.QR_EXPIRY_MONTHS || '6', 10);
            const expiresAt = new Date(new Date(reg.created_at).getTime() + expiryMonths * 30 * 24 * 60 * 60 * 1000);

            const { error: updateError } = await supabase
                .from('registration')
                .update({
                    status: 'distributed',
                    osa_val_at: new Date().toISOString(),
                    qr_code: qrUrl,
                    qr_unique_code: uniqueCode,
                    dist_sched: new Date(schedule).toISOString(),
                    expires_at: expiresAt.toISOString()
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Approved & Scheduled - Liceo GateQR',
                `Congrats your registration has been accepted. You are scheduled to visit OSA to pass the notarized filled up hardcopied agreements and notarized requirements, and receive your QR sticker code. Schedule: ${new Date(schedule).toLocaleString()}.`,
                `<p>Congrats your registration has been accepted. You are scheduled to visit OSA to pass the notarized filled up hardcopied agreements and notarized requirements, and receive your QR sticker code.</p><p>Schedule: <strong>${new Date(schedule).toLocaleString()}</strong>.</p>`
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'application_approved',
                    `Your vehicle registration application has been accepted by OSA! Scheduled visit: ${new Date(schedule).toLocaleString()}`,
                    actorId,
                    'approve_application',
                    'registration',
                    registration_id,
                    registration_id,
                    { schedule: new Date(schedule).toISOString() }
                );
            }
        } 
        else if (action === 'reject' && reg.status === 'osa_val') {
            if (!reason) return json({ error: 'Reason required' }, { status: 400 });
            
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    status: 'rejected', 
                    rejected_at: new Date().toISOString(), 
                    invalid_reason: reason 
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Rejected by OSA - Liceo GateQR',
                `Your vehicle sticker application was rejected by OSA. Reason: ${reason}`,
                `<p>Your vehicle sticker application was <strong>rejected by OSA</strong>.</p><p>Reason: <em>${reason}</em></p>`
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'application_rejected',
                    `Your vehicle registration application was rejected by OSA. Reason: ${reason}`,
                    actorId,
                    'reject_application',
                    'registration',
                    registration_id,
                    registration_id,
                    { reason }
                );
            }
        }
        else if (action === 'check_hardcopy' && reg.status === 'distributed') {
            const { error: updateError } = await supabase
                .from('registration')
                .update({ osa_dist_at: new Date().toISOString() })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Hardcopy Documents Received - Liceo GateQR',
                'Your hardcopy documents have been received by OSA and are now under review by Safety and Security.',
                '<p>Your hardcopy documents have been <strong>received by OSA</strong> and are now under review by Safety and Security.</p>'
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'hardcopy_received',
                    'Your hardcopy documents have been received and verified by OSA.',
                    actorId,
                    'check_hardcopy',
                    'registration',
                    registration_id,
                    registration_id
                );
            }
        }
        else if (action === 'release_sticker' && reg.status === 'distributed') {
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    sticker_released_at: new Date().toISOString(),
                    status: 'completed'
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Sticker Released - Liceo GateQR',
                'Your vehicle sticker has been released by OSA. Please proceed to Safety and Security for sticker installation.',
                '<p>Your vehicle sticker has been <strong>released by OSA</strong>. Please proceed to Safety and Security for sticker installation.</p>'
            );

            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'sticker_released',
                    'Your vehicle sticker has been released by OSA. Proceed to Safety and Security for installation.',
                    actorId,
                    'release_sticker',
                    'registration',
                    registration_id,
                    registration_id
                );
            }
        }
        else if (action === 'reschedule' && reg.status === 'distributed') {
            if (!schedule) {
                return json({ error: 'A new schedule date is required to reschedule' }, { status: 400 });
            }

            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    dist_sched: new Date(schedule).toISOString(),
                    invalid_reason: 'RESCHEDULED'
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'OSA Visit Rescheduled — Liceo GateQR',
                `Your OSA visit for hardcopy submission has been rescheduled. New schedule: ${new Date(schedule).toLocaleString()}. Please make sure to visit OSA on this date to submit your hardcopy documents.`,
                `<p>Your OSA visit for hardcopy submission has been <strong>rescheduled</strong>.</p><p>New schedule: <strong>${new Date(schedule).toLocaleString()}</strong>.</p><p>Please make sure to visit OSA on this date to submit your hardcopy documents.</p>`
            );

            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'schedule_updated',
                    `Your OSA visit has been rescheduled to ${new Date(schedule).toLocaleString()}`,
                    actorId,
                    'reschedule_visit',
                    'registration',
                    registration_id,
                    registration_id,
                    { schedule: new Date(schedule).toISOString() }
                );
                
                // Notify the OSA Admin
                if (actorId) {
                    await createNotification(
                        actorId,
                        'osa_action_success',
                        `Successfully rescheduled the application for ${reg.user.email}.`,
                        actorId,
                        'reschedule_visit_success',
                        'registration',
                        registration_id,
                        registration_id
                    );
                }
            }
        }
        else if (action === 'proceed_overdue' && reg.status === 'distributed') {
            const newSchedule = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    dist_sched: newSchedule,
                    invalid_reason: 'OVERDUE'
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'schedule_updated',
                    `Your OSA visit has been marked as OVERDUE and proceeded to Hardcopies Compliance.`,
                    actorId,
                    'proceed_overdue',
                    'registration',
                    registration_id,
                    registration_id
                );
                
                // Notify the OSA Admin
                if (actorId) {
                    await createNotification(
                        actorId,
                        'osa_action_success',
                        `Successfully proceeded the overdue application for ${reg.user.email} directly to Hardcopies Compliance.`,
                        actorId,
                        'proceed_overdue_success',
                        'registration',
                        registration_id,
                        registration_id
                    );
                }
            }
        }
        else if (action === 'revoke' && (reg.status === 'distributed' || reg.status === 'completed')) {
            if (!reason) return json({ error: 'Reason required' }, { status: 400 });
            
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    status: 'revoked', 
                    revoked_at: new Date().toISOString(), 
                    invalid_reason: reason 
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Revoked - Liceo GateQR',
                `Your parking access has been revoked by OSA. Reason: ${reason}`,
                `<p>Your parking access has been <strong>revoked</strong> by OSA.</p><p>Reason: <em>${reason}</em></p>`
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'access_revoked',
                    `Your vehicle registration access was revoked by OSA. Reason: ${reason}`,
                    actorId,
                    'revoke_access',
                    'registration',
                    registration_id,
                    registration_id,
                    { reason }
                );
            }
        }
        else if (action === 'retract') {
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    status: 'osa_val', 
                    osa_val_at: null, 
                    osa_dist_at: null, 
                    revoked_at: null, 
                    rejected_at: null, 
                    invalid_reason: null, 
                    qr_code: null,
                    qr_unique_code: null
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Approval Retracted - Liceo GateQR',
                'Your application approval has been retracted by OSA and is back under review.',
                '<p>Your application approval has been <strong>retracted</strong> by OSA and is back under review.</p>'
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'approval_retracted',
                    'Your vehicle registration approval was retracted by OSA and is back under review.',
                    actorId,
                    'retract_approval',
                    'registration',
                    registration_id,
                    registration_id
                );
            }
        }
        else if (action === 'unrevoke' && reg.status === 'revoked') {
            if (reg.expires_at && new Date(reg.expires_at) < new Date()) {
                return json({ error: 'Cannot unrevoke an expired registration' }, { status: 400 });
            }
            
            const restoredStatus = reg.sticker_released_at ? 'completed' : 'distributed';
            const { error: updateError } = await supabase
                .from('registration')
                .update({
                    status: restoredStatus,
                    revoked_at: null,
                    invalid_reason: null
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Unrevoked - Liceo GateQR',
                'Your parking access has been restored by OSA.',
                '<p>Your parking access has been <strong>restored</strong> by OSA.</p>'
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'access_restored',
                    'Your vehicle registration access has been restored by OSA.',
                    actorId,
                    'restore_access',
                    'registration',
                    registration_id,
                    registration_id
                );
            }
        }
        else if (action === 'delete') {
            const files = [reg.doc_id, reg.doc_load, reg.doc_or, reg.doc_cr, reg.doc_license, reg.doc_letter, reg.qr_code].filter(Boolean);
            for (const file of files) {
                const filepath = join(process.cwd(), 'static', file);
                try {
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                    }
                } catch (e) {
                    console.error('Failed to delete file', filepath, e);
                }
            }
            
            const { error: deleteError } = await supabase
                .from('registration')
                .delete()
                .eq('registration_id', registration_id);

            if (deleteError) throw deleteError;

            await sendEmail(
                reg.user.email,
                'Application Deleted - Liceo GateQR',
                'Your vehicle sticker application has been permanently deleted by OSA.',
                '<p>Your vehicle sticker application has been <strong>permanently deleted</strong> by OSA.</p>'
            );

            // Create notification for the applicant
            if (reg.user?.user_id) {
                const actorId = locals.user?.user_id;
                await createNotification(
                    reg.user.user_id,
                    'application_deleted',
                    'Your vehicle registration application has been deleted by OSA.',
                    actorId,
                    'delete_application',
                    'registration',
                    registration_id,
                    registration_id
                );
            }
        }
        else {
            return json({ error: 'Invalid action for current status' }, { status: 400 });
        }

        return json({ message: 'Application updated' });
    } catch (error) {
        console.error('Failed to update osa application:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
