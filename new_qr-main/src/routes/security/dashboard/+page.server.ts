import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'security') {
        throw redirect(303, '/login');
    }

    const userEmail = locals.user.email;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    try {
        // Security-specific statistics
        const [
            { count: totalEntriesToday },
            { count: currentlyInCampus },
            { count: flaggedEntries },
            { count: vehicleCount },
            { count: totalComplaints },
            { count: unreadComplaints }
        ] = await Promise.all([
            supabase.from('vehicle_log')
                .select('*', { count: 'exact', head: true })
                .gte('in', today)
                .lt('in', tomorrow),
            supabase.from('vehicle_log')
                .select('*', { count: 'exact', head: true })
                .eq('logged_status', 'In')
                .gte('in', today)
                .lt('in', tomorrow),
            supabase.from('vehicle_log')
                .select('*', { count: 'exact', head: true })
                .neq('logged_status', 'OK')
                .gte('in', today)
                .lt('in', tomorrow),
            supabase.from('registration')
                .select('*', { count: 'exact', head: true })
                .in('status', ['distributed', 'completed']),
            supabase.from('complaint')
                .select('*', { count: 'exact', head: true }),
            supabase.from('complaint')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
        ]);

        // Hourly entry chart for security monitoring
        const { data: hourlyLogs } = await supabase
            .from('vehicle_log')
            .select('in')
            .gte('in', today)
            .lt('in', tomorrow);

        const hourlyChart = Array(24).fill(0);
        hourlyLogs?.forEach((log: any) => {
            const hour = new Date(log.in).getHours();
            hourlyChart[hour]++;
        });

        // Role breakdown for security monitoring
        const { data: roleLogs } = await supabase
            .from('vehicle_log')
            .select('role')
            .gte('in', today)
            .lt('in', tomorrow);

        const roleBreakdown: Record<string, number> = {
            student: 0,
            employee: 0,
            visitor: 0,
            concessionaire: 0,
            guest: 0,
            vip: 0
        };

        roleLogs?.forEach((log: any) => {
            if (roleBreakdown[log.role] !== undefined) {
                roleBreakdown[log.role]++;
            }
        });

        // Recent security alerts/flagged entries
        const { data: recentAlerts } = await supabase
            .from('vehicle_log')
            .select('*')
            .neq('logged_status', 'OK')
            .order('in', { ascending: false })
            .limit(5);

        return {
            userEmail,
            userRole: locals.user.role,
            stats: {
                totalEntriesToday: totalEntriesToday || 0,
                currentlyInCampus: currentlyInCampus || 0,
                flaggedEntries: flaggedEntries || 0,
                vehicleCount: vehicleCount || 0,
                totalComplaints: totalComplaints || 0
            },
            roleBreakdown: roleBreakdown as any,
            hourlyChart,
            unreadComplaints: unreadComplaints || 0,
            recentAlerts: recentAlerts || []
        };
    } catch (e) {
        console.error('Error loading security dashboard data:', e);
        return {
            userEmail,
            userRole: locals.user.role,
            stats: {
                totalEntriesToday: 0,
                currentlyInCampus: 0,
                flaggedEntries: 0,
                vehicleCount: 0,
                totalComplaints: 0
            },
            roleBreakdown: {
                student: 0,
                employee: 0,
                visitor: 0,
                concessionaire: 0,
                guest: 0,
                vip: 0
            } as any,
            hourlyChart: Array(24).fill(0),
            unreadComplaints: 0,
            recentAlerts: []
        };
    }
};