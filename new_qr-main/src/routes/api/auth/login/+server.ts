import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { email } = await request.json();

        if (!email) {
            return json({ error: 'Email is required' }, { status: 400 });
        }

        // Generate OTP first (fast operation)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Get or create user using Supabase with optimized query
        let { data: users, error: userError } = await supabase
            .from('user')
            .select('user_id, user_type')
            .eq('email', email)
            .maybeSingle();

        let userId = users?.user_id;
        let userType = users?.user_type || 'Applicants';

        if (!userId || userError) {
            // Only create user if doesn't exist (not on other errors)
            if (userError && userError.code !== 'PGRST116') {
                throw userError;
            }

            // Create user if doesn't exist
            const { data: newUser, error: createError } = await supabase
                .from('user')
                .insert({
                    email,
                    user_type: 'Applicants',
                    identification: 'Visitor'
                })
                .select('user_id')
                .single();

            if (createError) throw createError;
            userId = newUser.user_id;
        }

        // Clean up old OTPs for this email (faster than waiting for expiration)
        const { error: cleanupError } = await supabase
            .from('otp_codes')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .eq('email', email);
        
        if (cleanupError) {
            console.error('[OTP] Cleanup error:', cleanupError);
        }

        // Store OTP in Supabase database
        console.log('[OTP] Attempting to store OTP for user:', userId, 'email:', email);
        const { error: otpError, data: otpData } = await supabase
            .from('otp_codes')
            .insert({
                user_id: userId,
                email,
                otp,
                expires_at: expiresAt.toISOString()
            })
            .select();

        if (otpError) {
            console.error('[OTP] Database insertion error:', otpError);
            throw otpError;
        }
        
        console.log('[OTP] Successfully stored OTP in database:', otpData);

        // Send email with OSA sender
        sendEmail(
            email,
            'Your GateQR Login OTP Code',
            `Your login code is: ${otp}. It will expire in 10 minutes.`,
            `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #7f1d1d; margin: 0; font-size: 22px;">Liceo GateQR</h2>
                    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Office of Student Affairs (OSA)</p>
                </div>
                <div style="background: #f8fafc; border-radius: 10px; padding: 20px; text-align: center; border: 1px dashed #cbd5e1; margin-bottom: 20px;">
                    <p style="font-size: 14px; color: #475569; margin: 0 0 10px 0;">Your One-Time Password (OTP) is:</p>
                    <div style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #7f1d1d; font-family: monospace;">${otp}</div>
                    <p style="font-size: 12px; color: #94a3b8; margin: 12px 0 0 0;">This code is valid for 10 minutes. Do not share it with anyone.</p>
                </div>
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.4;">
                    Liceo de Cagayan University &bull; Office of Student Affairs<br>
                    <a href="mailto:aluban98304@liceo.edu.ph" style="color: #7f1d1d; text-decoration: none;">aluban98304@liceo.edu.ph</a>
                </p>
            </div>`,
            `"Liceo OSA - GateQR" <aluban98304@liceo.edu.ph>`
        ).catch(err => console.error('Email send error:', err));

        // For testing/development, log the OTP immediately
        console.log(`[OTP] Generated for ${email}: ${otp}`);

        // Return success immediately without waiting for email
        return json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Login error:', error);
        return json({ error: 'Failed to process login request' }, { status: 500 });
    }
};
