<script lang="ts">
    import AppShell from '$lib/components/AppShell.svelte';
    import NavBar from '$lib/components/NavBar.svelte';

    let { data } = $props();
    let userRole = $derived(data.userRole || 'security');

    const navLinks = $derived([
        { label: 'Dashboard', href: '/security/dashboard' },
        { label: 'Monitor', href: '/monitor' },
        { label: 'Complaints', href: '/security/complaints', badge: data.unreadComplaints }
    ]);

    // ── Security Stats ────────────────────────────────────────────────────────────
    let statsData = $derived((data.stats as any) || { 
        totalEntriesToday: 0, 
        currentlyInCampus: 0, 
        flaggedEntries: 0, 
        vehicleCount: 0, 
        totalComplaints: 0 
    });
    let roleBreakdown = $derived((data.roleBreakdown as Record<string, number>) || { 
        student: 0, employee: 0, visitor: 0, concessionaire: 0, guest: 0, vip: 0 
    });
    let hourlyChart = $derived((data.hourlyChart as number[]) || Array(24).fill(0));
    let recentAlerts = $derived((data.recentAlerts as any[]) || []);

    const statCards = $derived([
        {
            label: 'TOTAL ENTRIES',
            value: statsData.totalEntriesToday,
            desc: 'All vehicle entries today',
            icon: `<path d="M12 2v20M2 12h20M12 2l4 4m-4-4l-4 4"/>`,
            color: '#6b1a2a',
            bg: 'rgba(107,26,42,0.08)'
        },
        {
            label: 'CAMPUS PRESENCE',
            value: statsData.currentlyInCampus,
            desc: 'Vehicles inside campus right now',
            icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
            color: '#059669',
            bg: 'rgba(5,150,105,0.08)'
        },
        {
            label: 'FLAGGED ALERTS',
            value: statsData.flaggedEntries,
            desc: 'Anomalies detected today',
            icon: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
            color: '#dc2626',
            bg: 'rgba(220,38,38,0.08)'
        },
        {
            label: 'COMPLAINTS',
            value: statsData.totalComplaints,
            desc: 'Total complaints reported',
            icon: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
            color: '#d97706',
            bg: 'rgba(217,119,6,0.08)'
        }
    ]);

    const chartHeight = 180;
    const maxChartValue = $derived(Math.max(...hourlyChart, 1));
</script>

<AppShell showSidebar={true} userEmail={data.userEmail} userRole={userRole}>
    <NavBar title="Security Dashboard" links={navLinks} />
    
    <div class="dashboard-container">
        <h1>Security Dashboard</h1>
        <p class="dashboard-subtitle">Real-time monitoring and analytics for campus security</p>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
            {#each statCards as card}
                <div class="stat-card" style="--card-bg: {card.bg}; --card-color: {card.color}">
                    <div class="stat-icon" style="color: {card.color}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            {@html card.icon}
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">{card.value}</div>
                        <div class="stat-label">{card.label}</div>
                        <div class="stat-desc">{card.desc}</div>
                    </div>
                </div>
            {/each}
        </div>

        <!-- Hourly Traffic Chart -->
        <div class="chart-section">
            <h2>Hourly Entry Traffic Today</h2>
            <div class="chart-container">
                <div class="chart-bars">
                    {#each hourlyChart as value, i}
                        <div class="chart-bar-wrapper">
                            <div 
                                class="chart-bar" 
                                style="height: {(value / maxChartValue) * 100}%"
                                title="{i}:00 - {value} entries"
                            ></div>
                            <span class="chart-label">{i}</span>
                        </div>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Role Breakdown -->
        <div class="breakdown-section">
            <h2>Entry Breakdown by Role</h2>
            <div class="breakdown-grid">
                {#each Object.entries(roleBreakdown) as [role, count]}
                    <div class="breakdown-item">
                        <div class="breakdown-label">{role.charAt(0).toUpperCase() + role.slice(1)}</div>
                        <div class="breakdown-bar">
                            <div class="breakdown-fill" style="width: {((count as number) / Math.max(...(Object.values(roleBreakdown) as number[]), 1)) * 100}%"></div>
                        </div>
                        <div class="breakdown-value">{count}</div>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Recent Security Alerts -->
        <div class="alerts-section">
            <h2>Recent Security Alerts</h2>
            {#if recentAlerts.length > 0}
                <div class="alerts-list">
                    {#each recentAlerts as alert}
                        <div class="alert-item">
                            <div class="alert-info">
                                <div class="alert-time">{new Date(alert.in).toLocaleTimeString()}</div>
                                <div class="alert-status">{alert.logged_status}</div>
                            </div>
                            <div class="alert-details">
                                <div class="alert-plate">{alert.vehicle_plate || 'Unknown Plate'}</div>
                                <div class="alert-role">{alert.role || 'Unknown Role'}</div>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="no-data">No security alerts today</div>
            {/if}
        </div>

        <!-- Vehicle Monitoring Section -->
        <div class="monitoring-section">
            <h2>Vehicle Monitoring</h2>
            <div class="monitoring-filters">
                <div class="search-wrap">
                    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search vehicles..."
                        class="search-input"
                    />
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn active">All Vehicles</button>
                    <button class="filter-btn">2-Wheelers</button>
                    <button class="filter-btn">4-Wheelers</button>
                </div>
            </div>
            <div class="monitoring-grid">
                <div class="no-data">Vehicle monitoring will be displayed here</div>
            </div>
        </div>
    </div>
</AppShell>

<style>
    .dashboard-container {
        padding: 1.5rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
        color: var(--text-primary);
    }

    .dashboard-subtitle {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-bottom: 1.5rem;
        font-weight: 400;
    }

    h2 {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    h2::before {
        content: '';
        width: 3px;
        height: 18px;
        background: var(--maroon);
        border-radius: 2px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .stat-card {
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 12px;
        padding: 1.25rem;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        transition: all 0.2s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--card-bg);
        color: var(--card-color);
        font-size: 1.25rem;
    }

    .stat-content {
        flex: 1;
    }

    .stat-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--card-color);
        line-height: 1;
        margin-bottom: 0.25rem;
    }

    .stat-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .stat-desc {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: 400;
    }

    .chart-section,
    .breakdown-section,
    .alerts-section {
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .chart-container {
        height: var(--chart-height);
        position: relative;
        background: #f8fafc;
        border-radius: 12px;
        padding: 1rem;
    }

    .chart-bars {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        height: 100%;
        gap: 6px;
    }

    .chart-bar-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
    }

    .chart-bar {
        width: 100%;
        background: var(--maroon);
        border-radius: 4px 4px 0 0;
        transition: height 0.3s ease;
        min-height: 4px;
    }

    .chart-bar:hover {
        background: var(--maroon-light);
    }

    .chart-label {
        font-size: 0.65rem;
        color: var(--text-secondary);
        margin-top: 6px;
        font-weight: 500;
    }

    .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
    }

    .breakdown-item {
        background: #f8fafc;
        border: 1px solid rgba(0,0,0,0.06);
        border-radius: 10px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        transition: all 0.2s;
    }

    .breakdown-item:hover {
        border-color: var(--maroon);
    }

    .breakdown-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-primary);
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .breakdown-bar {
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
    }

    .breakdown-fill {
        height: 100%;
        background: var(--maroon);
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    .breakdown-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-top: 0.25rem;
    }

    .alerts-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .alert-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        transition: all 0.2s;
    }

    .alert-item:hover {
        background: #fee2e2;
        border-color: #fca5a5;
    }

    .alert-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .alert-time {
        font-size: 0.8rem;
        font-weight: 600;
        color: #b91c1c;
    }

    .alert-status {
        font-size: 0.7rem;
        color: #dc2626;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.03em;
    }

    .alert-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        text-align: right;
    }

    .alert-plate {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .alert-role {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: 400;
    }

    .no-data {
        text-align: center;
        padding: 2rem;
        color: var(--text-secondary);
        font-style: italic;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px dashed #e2e8f0;
    }

    .monitoring-section {
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .monitoring-filters {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }

    .search-wrap {
        flex: 1;
        min-width: 200px;
        position: relative;
    }

    .search-icon {
        position: absolute;
        left: 0.875rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-secondary);
        pointer-events: none;
    }

    .search-input {
        width: 100%;
        padding: 0.625rem 0.875rem 0.625rem 2.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.875rem;
        background: #ffffff;
        transition: all 0.2s;
    }

    .search-input:focus {
        outline: none;
        border-color: var(--maroon);
        box-shadow: 0 0 0 2px rgba(107,26,42,0.1);
    }

    .filter-buttons {
        display: flex;
        gap: 0.5rem;
    }

    .filter-btn {
        padding: 0.5rem 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #ffffff;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .filter-btn:hover {
        border-color: var(--maroon);
        color: var(--maroon);
    }

    .filter-btn.active {
        background: var(--maroon);
        border-color: var(--maroon);
        color: white;
    }

    .monitoring-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
    }

    @media (max-width: 768px) {
        .stats-grid {
            grid-template-columns: 1fr;
        }

        .breakdown-grid {
            grid-template-columns: 1fr;
        }

        h1 {
            font-size: 1.25rem;
        }
    }
</style>