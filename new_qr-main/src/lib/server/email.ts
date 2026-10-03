import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

const smtpHost = env.PRIVATE_SMTP_HOST || env.SMTP_HOST;
const smtpPort = env.PRIVATE_SMTP_PORT || env.SMTP_PORT;
const smtpUser = env.PRIVATE_SMTP_USER || env.SMTP_USER;
const smtpPass = env.PRIVATE_SMTP_PASS || env.SMTP_PASS;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.error('[Email] Missing SMTP configuration. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your .env file');
}

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    auth: {
        user: smtpUser,
        pass: smtpPass
    }
});

export async function sendEmail(to: string, subject: string, text: string, html?: string, from?: string) {
    try {
        await transporter.sendMail({
            from: from || `"GateQR" <${smtpUser}>`,
            to,
            subject,
            text,
            html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`
        });
        console.log(`[Email] Sent to ${to}: ${subject}`);
    } catch (error) {
        console.error(`[Email Error] Failed to send to ${to}:`, error);
    }
}
