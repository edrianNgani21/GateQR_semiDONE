import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'osa') {
        throw redirect(303, '/login');
    }

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    try {
        // OSA-specific statistics with safer queries
        const totalApplicationsResult = await supabase.from('registration').select('*', { count: 'exact', head: true });
        const pendingValidationResult = await supabase.from('registration').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const pendingDistributionResult = await supabase.from('registration').select('*', { count: 'exact', head: true }).eq('status', 'dept_val');
        const completedTodayResult = await supabase.from('registration').select('*', { count: 'exact', head: true })
            .eq('status', 'distributed')
            .gte('osa_dist_at', today)
            .lt('osa_dist_at', tomorrow);
        const rejectedTodayResult = await supabase.from('registration').select('*', { count: 'exact', head: true })
            .eq('status', 'rejected')
            .gte('rejected_at', today)
            .lt('rejected_at', tomorrow);
        const totalDepartmentsResult = await supabase.from('department').select('*', { count: 'exact', head: true });

        const totalApplications = totalApplicationsResult?.count || 0;
        const pendingValidation = pendingValidationResult?.count || 0;
        const pendingDistribution = pendingDistributionResult?.count || 0;
        const completedToday = completedTodayResult?.count || 0;
        const rejectedToday = rejectedTodayResult?.count || 0;
        const totalDepartments = totalDepartmentsResult?.count || 0;

        // Application breakdown by status
        const { data: statusBreakdown } = await supabase
            .from('registration')
            .select('status')
            .order('created_at', { ascending: false });

        const statusCounts: Record<string, number> = {
            pending: 0,
            dept_val: 0,
            osa_val: 0,
            distributed: 0,
            completed: 0,
            rejected: 0,
            revoked: 0
        };

        statusBreakdown?.forEach((app: any) => {
            if (statusCounts[app.status] !== undefined) {
                statusCounts[app.status]++;
            }
        });

        // Recent applications with safer query
        const { data: recentApplications } = await supabase
            .from('registration')
            .select(`
                *,
                user:user_id(email),
                department:department_id(department)
            `)
            .order('created_at', { ascending: false })
            .limit(5);

        return {
            stats: {
                totalApplications,
                pendingValidation,
                pendingDistribution,
                completedToday,
                rejectedToday,
                totalDepartments
            },
            statusBreakdown: statusCounts,
            recentApplications: recentApplications || []
        };
    } catch (e) {
        console.error('Failed to load OSA dashboard data:', e);
        return {
            stats: {
                totalApplications: 0,
                pendingValidation: 0,
                pendingDistribution: 0,
                completedToday: 0,
                rejectedToday: 0,
                totalDepartments: 0
            },
            statusBreakdown: {
                pending: 0,
                dept_val: 0,
                osa_val: 0,
                distributed: 0,
                completed: 0,
                rejected: 0,
                revoked: 0
            },
            recentApplications: []
        };
    }
};