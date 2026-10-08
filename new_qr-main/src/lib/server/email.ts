import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

const smtpHost = env.PRIVATE_SMTP_HOST || env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(env.PRIVATE_SMTP_PORT || env.SMTP_PORT || 587);
const smtpUser = env.PRIVATE_SMTP_USER || env.SMTP_USER;
const smtpPass = env.PRIVATE_SMTP_PASS || env.SMTP_PASS;
export const osaEmail = env.OSA_EMAIL || 'aluban98304@liceo.edu.ph';

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.error('[Email] Missing SMTP configuration. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your .env file');
}

// High-speed pooled transporter with keep-alive connections
const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
        user: smtpUser,
        pass: smtpPass
    },
    tls: {
        rejectUnauthorized: false
    }
});

export async function sendEmail(to: string, subject: string, text: string, html?: string, from?: string) {
    try {
        const sender = from || `"GateQR - Office of Student Affairs" <${osaEmail}>`;
        await transporter.sendMail({
            from: sender,
            replyTo: osaEmail,
            to,
            subject,
            text,
            html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`
        });
        console.log(`[Email] Fast sent to ${to}: ${subject} (From: ${sender})`);
    } catch (error) {
        console.error(`[Email Error] Failed to send to ${to}:`, error);
    }
}
