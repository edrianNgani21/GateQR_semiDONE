import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';

function checkAuth(request: Request): boolean {
    return request.headers.get('X-Gate-Key') === env.PRIVATE_GATE_API_KEY;
}

export const GET: RequestHandler = async ({ request, url }) => {
    if (!checkAuth(request)) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    const qr = url.searchParams.get('qr');
    if (!qr) {
        return json({ error: 'Missing qr parameter' }, { status: 400 });
    }

    try {
        let reg = null;

        // First try to lookup by unique alphanumeric code (new format)
        const { data: uniqueCodeRows } = await supabase
            .from('registration')
            .select(`
                *,
                user:user_id(email),
                department:department_id(department, email),
                vehicle_information:vehicle_information_id(
                    plate_number,
                    brand,
                    color,
                    type
                )
            `)
            .eq('qr_unique_code', qr)
            .maybeSingle();

        if (uniqueCodeRows) {
            reg = {
                ...uniqueCodeRows,
                user_email: uniqueCodeRows.user?.email,
                department_name: uniqueCodeRows.department?.department
            };
        } else {
            // Fallback to old REG-{number} format for backward compatibility
            const regIdMatch = qr.match(/^REG-(\d+)$/i);
            if (regIdMatch) {
                const autoId = parseInt(regIdMatch[1]);
                const { data: rows } = await supabase
                    .from('registration')
                    .select(`
                        *,
                        user:user_id(email),
                        department:department_id(department, email),
                        vehicle_information:vehicle_information_id(
                            plate_number,
                            brand,
                            color,
                            type
                        )
                    `)
                    .eq('registration_id', autoId)
                    .single();

                if (rows) {
                    reg = {
                        ...rows,
                        user_email: rows.user?.email,
                        department_name: rows.department?.department
                    };
                }
            } else {
                // Direct registration_id lookup
                const { data: rows } = await supabase
                    .from('registration')
                    .select(`
                        *,
                        user:user_id(email),
                        department:department_id(department, email),
                        vehicle_information:vehicle_information_id(
                            plate_number,
                            brand,
                            color,
                            type
                        )
                    `)
                    .eq('registration_id', qr)
                    .single();

                if (rows) {
                    reg = {
                        ...rows,
                        user_email: rows.user?.email,
                        department_name: rows.department?.department
                    };
                }
            }
        }

        if (!reg) {
            return json({ registered: false }, { status: 404 });
        }

        const { data: logRows } = await supabase
            .from('vehicle_log')
            .select('log_id, in, out')
            .eq('registration_id', reg.registration_id)
            .order('in', { ascending: false })
            .limit(1)
            .single();

        let lastLog = null;
        let logged_status = 'Outside'; // Default to outside

        if (logRows) {
            const log = logRows;
            lastLog = {
                log_id: log.log_id,
                type: log.out ? 'out' : 'in',
                date: new Date(log.in).toISOString().slice(0, 10), // YYYY-MM-DD
                time: new Intl.DateTimeFormat('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: false
                }).format(new Date(log.in)),
            };

            // Determine if vehicle is currently inside based on last log
            logged_status = log.out ? 'Outside' : 'Inside';
        }

        return json({ registered: true, registration: reg, lastLog, logged_status });
    } catch (error) {
        console.error('[Gate] Lookup error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
