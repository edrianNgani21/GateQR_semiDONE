<script lang="ts">
    import AppShell from '$lib/components/AppShell.svelte';
    import NavBar from '$lib/components/NavBar.svelte';

    let { data } = $props();

    const navLinks = [
        { label: 'Add Admin', href: '/osa/admin' },
        { label: 'Departments', href: '/osa/departments' }
    ];

    // ── OSA Stats ────────────────────────────────────────────────────────────────
    let statsData = $derived((data.stats as any) || { 
        totalApplications: 0, 
        pendingValidation: 0, 
        pendingDistribution: 0, 
        completedToday: 0, 
        rejectedToday: 0, 
        totalDepartments: 0 
    });
    let statusBreakdown = $derived((data.statusBreakdown as Record<string, number>) || {
        pending: 0, dept_val: 0, osa_val: 0, distributed: 0, completed: 0, rejected: 0, revoked: 0
    });
    let recentApplications = $derived(data.recentApplications || []);

    const statCards = $derived([
        {
            label: 'Total Applications',
            value: statsData.totalApplications,
            desc: 'All vehicle registration applications',
            icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
            color: 'var(--maroon)',
            bg: 'var(--maroon-muted)',
            border: 'var(--maroon-tint)'
        },
        {
            label: 'Pending Validation',
            value: statsData.pendingValidation,
            desc: 'Applications awaiting department validation',
            icon: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
            color: 'var(--gold)',
            bg: 'var(--gold-muted)',
            border: 'var(--gold-shimmer)'
        },
        {
            label: 'Pending Distribution',
            value: statsData.pendingDistribution,
            desc: 'Applications ready for sticker distribution',
            icon: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
            color: '#059669',
            bg: '#ECFDF5',
            border: '#A7F3D0'
        },
        {
            label: 'Completed Today',
            value: statsData.completedToday,
            desc: 'Applications processed today',
            icon: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
            color: '#2563eb',
            bg: '#EFF6FF',
            border: '#BFDBFE'
        }
    ]);

    const statusLabels: Record<string, string> = {
        pending: 'Pending',
        dept_val: 'Dept Validated',
        osa_val: 'OSA Validated',
        distributed: 'Distributed',
        completed: 'Completed',
        rejected: 'Rejected',
        revoked: 'Revoked'
    };

    const maxStatusCount = $derived(Math.max(...Object.values(statusBreakdown), 1));
</script>

<AppShell showSidebar={true}>
    <NavBar title="OSA Dashboard" links={navLinks} />
    
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-content">
                <h1>OSA Dashboard</h1>
                <p class="header-subtitle">Overview of vehicle registration applications and system status</p>
            </div>
            <div class="header-actions">
                <a href="/osa" class="action-btn primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    View Applications
                </a>
            </div>
        </div>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
            {#each statCards as card}
                <div class="stat-card">
                    <div class="stat-icon" style="color: {card.color}; background: rgba(255,255,255,0.5);">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            {@html card.icon}
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value" style="color: {card.color}">{card.value}</div>
                        <div class="stat-label">{card.label}</div>
                        <div class="stat-desc">{card.desc}</div>
                    </div>
                </div>
            {/each}
        </div>

        <div class="dashboard-grid">
            <!-- Application Status Breakdown -->
            <div class="breakdown-section">
                <div class="section-header">
                    <h2>Application Status</h2>
                    <span class="section-badge">Overview</span>
                </div>
                <div class="breakdown-grid">
                    {#each Object.entries(statusBreakdown) as [status, count]}
                        <div class="breakdown-item">
                            <div class="breakdown-label">{statusLabels[status] || status}</div>
                            <div class="breakdown-bar">
                                <div class="breakdown-fill" style="width: {((count as number) / (maxStatusCount as number)) * 100}%"></div>
                            </div>
                            <div class="breakdown-value">{count}</div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Recent Applications -->
            <div class="recent-section">
                <div class="section-header">
                    <h2>Recent Activity</h2>
                    <span class="section-badge">Latest</span>
                </div>
                {#if recentApplications.length > 0}
                    <div class="recent-list">
                        {#each recentApplications as app}
                            <div class="recent-item">
                                <div class="recent-info">
                                    <div class="recent-email">{app.user?.email || 'Unknown'}</div>
                                    <div class="recent-dept">{app.department?.department || app.department?.department_name || 'No Department'}</div>
                                </div>
                                <div class="recent-status" class:status-pending={app.status === 'pending'} class:status-dept_val={app.status === 'dept_val'} class:status-osa_val={app.status === 'osa_val'} class:status-distributed={app.status === 'distributed'} class:status-completed={app.status === 'completed'} class:status-rejected={app.status === 'rejected'} class:status-revoked={app.status === 'revoked'}>
                                    {statusLabels[app.status] || app.status}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="no-data">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/>
                            <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        <p>No recent applications</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</AppShell>

<style>
    .dashboard-container {
        padding: var(--space-xl);
        max-width: 1400px;
        margin: 0 auto;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--space-2xl);
        gap: var(--space-lg);
    }

    .header-content h1 {
        font-size: 2.5rem;
        font-weight: 800;
        margin: 0 0 var(--space-sm) 0;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        background: var(--gradient-maroon);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .header-subtitle {
        font-size: 1rem;
        color: var(--text-secondary);
        margin: 0;
        font-weight: 500;
    }

    .header-actions {
        display: flex;
        gap: var(--space-md);
    }

    .action-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-lg);
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 2px solid transparent;
    }

    .action-btn.primary {
        background: var(--gradient-maroon);
        color: white;
        box-shadow: var(--shadow-gold-sm);
    }

    .action-btn.primary:hover {
        background: var(--gradient-gold);
        color: var(--text-primary);
        transform: translateY(-2px);
        box-shadow: var(--shadow-gold-md);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-lg);
        margin-bottom: var(--space-2xl);
    }

    .stat-card {
        background: var(--surface);
        border: 2px solid var(--border-light);
        border-radius: var(--radius-xl);
        padding: var(--space-lg);
        display: flex;
        align-items: flex-start;
        gap: var(--space-md);
        box-shadow: var(--shadow-md);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
    }

    .stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: var(--maroon);
        opacity: 0;
        transition: opacity 0.3s;
    }

    .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-xl);
    }

    .stat-card:hover::before {
        opacity: 1;
    }

    .stat-icon {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 2px solid var(--border-light);
        box-shadow: var(--shadow-sm);
    }

    .stat-content {
        flex: 1;
    }

    .stat-value {
        font-size: 2.5rem;
        font-weight: 800;
        line-height: 1;
        margin-bottom: var(--space-xs);
        letter-spacing: -0.02em;
    }

    .stat-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--space-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .stat-desc {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-lg);
    }

    .breakdown-section,
    .recent-section {
        background: var(--surface);
        border: 2px solid var(--border-light);
        border-radius: var(--radius-xl);
        padding: var(--space-lg);
        box-shadow: var(--shadow-md);
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-md);
        border-bottom: 2px solid var(--border-light);
    }

    .section-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--maroon);
        margin: 0;
        letter-spacing: -0.01em;
    }

    .section-badge {
        background: var(--maroon-muted);
        color: var(--maroon);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border: 1px solid var(--maroon-tint);
    }

    .breakdown-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
    }

    .breakdown-item {
        display: flex;
        align-items: center;
        gap: var(--space-md);
    }

    .breakdown-label {
        min-width: 120px;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-secondary);
    }

    .breakdown-bar {
        flex: 1;
        height: 8px;
        background: var(--maroon-muted);
        border-radius: var(--radius-xl);
        overflow: hidden;
        position: relative;
    }

    .breakdown-fill {
        height: 100%;
        background: var(--gradient-maroon);
        border-radius: var(--radius-xl);
        transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
    }

    .breakdown-fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    }

    .breakdown-value {
        min-width: 30px;
        text-align: right;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--maroon);
    }

    .recent-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
    }

    .recent-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-md);
        background: var(--surface-2);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-md);
        transition: all 0.2s;
    }

    .recent-item:hover {
        background: var(--maroon-muted);
        transform: translateX(-2px);
        border-color: var(--maroon-tint);
    }

    .recent-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .recent-email {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .recent-dept {
        font-size: 0.75rem;
        color: var(--text-muted);
    }

    .recent-status {
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .recent-status.status-pending {
        background: #FFFBEB;
        color: #B45309;
        border: 1px solid #FDE68A;
    }

    .recent-status.status-dept_val {
        background: #EFF6FF;
        color: #3B82F6;
        border: 1px solid #BFDBFE;
    }

    .recent-status.status-osa_val {
        background: #F3E8FF;
        color: #7C3AED;
        border: 1px solid #DDD6FE;
    }

    .recent-status.status-distributed {
        background: #ECFDF5;
        color: #047857;
        border: 1px solid #A7F3D0;
    }

    .recent-status.status-completed {
        background: #D1FAE5;
        color: #047857;
        border: 1px solid #6EE7B7;
    }

    .recent-status.status-rejected {
        background: #FEF2F2;
        color: #B91C1C;
        border: 1px solid #FCA5A5;
    }

    .recent-status.status-revoked {
        background: #FFF7ED;
        color: #C2410C;
        border: 1px solid #FED7AA;
    }

    .no-data {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-2xl);
        color: var(--text-muted);
        gap: var(--space-md);
    }

    .no-data svg {
        color: var(--border);
    }

    .no-data p {
        font-size: 0.9rem;
        font-weight: 500;
        margin: 0;
    }

    @media (max-width: 1024px) {
        .dashboard-grid {
            grid-template-columns: 1fr;
        }

        .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
    }

    @media (max-width: 768px) {
        .dashboard-header {
            flex-direction: column;
        }

        .header-content h1 {
            font-size: 2rem;
        }

        .stats-grid {
            grid-template-columns: 1fr;
        }
}
</style>