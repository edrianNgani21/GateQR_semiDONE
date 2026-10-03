import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, url, locals }) => {
    const isGate = request.headers.get('X-Gate-Key') === env.GATE_API_KEY;
    const isOsa = locals.user && (locals.user.role === 'osa' || locals.user.role === 'security');
    
    if (!isGate && !isOsa) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    const dateParam  = url.searchParams.get('date') || '';
    const search     = (url.searchParams.get('search') || '').trim().toLowerCase();
    const boundFilter= url.searchParams.get('bound') || 'all';   // all | in | out
    const page       = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit      = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));

    try {
        let dateFilter = new Date().toISOString().split('T')[0];
        const dateParams: string[] = [];
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            dateFilter = dateParam;
            dateParams.push(dateParam);
        }

        const tomorrow = new Date(new Date(dateFilter).getTime() + 86400000).toISOString().split('T')[0];

        // ── Registered entries ──────────────────────────────────────────────
        let regRows: any[] = [];
        let query = supabase
            .from('vehicle_log')
            .select(`
                vehicle_log_id,
                vehicle_information_id,
                registration_id,
                check_in,
                check_out,
                logged_status,
                created_at
            `)
            .gte('check_in', dateFilter)
            .lt('check_in', tomorrow);

        const { data } = await query;
        if (data) {
            regRows = data.map(row => ({
                ...row,
                log_type: 'registered'
            }));
        }

        // ── Guest entries ────────────────────────────────────────────────────
        let guestRows: any[] = [];
        let vipRows: any[] = [];

        // ── Process logs ─────────────────────────────────────────────────────
        const logs: any[] = [];

        regRows.forEach(row => {
            const inDate = new Date(row.check_in);
            const hasCheckout = row.check_out !== null;
            
            // Apply bound filter
            if (boundFilter === 'all' || 
                (boundFilter === 'in' && !hasCheckout) || 
                (boundFilter === 'out' && hasCheckout)) {
                logs.push({
                    vehicle_log_id: row.vehicle_log_id,
                    vehicle_information_id: row.vehicle_information_id,
                    registration_id: row.registration_id,
                    check_in: row.check_in,
                    check_out: row.check_out,
                    logged_status: row.logged_status,
                    created_at: row.created_at,
                    timestamp: inDate.getTime()
                });
            }
        });



        // ── Sort descending ──────────────────────────────────────────────────
        logs.sort((a, b) => b.timestamp - a.timestamp);

        // ── Search filter (after merge & sort) ──────────────────────────────
        let filtered = logs;
        if (search) {
            const terms = search.split(/\s+/).filter(Boolean);
            filtered = logs.filter(l => {
                const searchableFields = [
                    String(l.vehicle_log_id),
                    String(l.registration_id),
                    String(l.vehicle_information_id),
                    String(l.logged_status)
                ].join(' ').toLowerCase();
                return terms.every(term => searchableFields.includes(term));
            });
        }

        // ── Paginate ─────────────────────────────────────────────────────────
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const sliced = filtered.slice((safePage - 1) * limit, safePage * limit);

        return json({ logs: sliced, total, page: safePage, totalPages, limit });
    } catch (error) {
        console.error('[Gate] Logs error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
