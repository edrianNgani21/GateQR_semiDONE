<script lang="ts">
  let { title = 'GateQR', userEmail = '', children, showSidebar = false, userRole = 'osa' } = $props();

  // Notification state
  let notifications = $state<any[]>([]);
  let unreadCount = $state(0);
  let notificationDropdownOpen = $state(false);
  let loadingNotifications = $state(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // Notification functions
  async function fetchNotifications() {
    loadingNotifications = true;
    try {
      const res = await fetch('/api/notifications');
      console.log('Notifications API response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Notifications data received:', data);
        notifications = data.notifications || [];
        unreadCount = notifications.filter((n: any) => !n.is_read).length;
        console.log('Notification count:', notifications.length, 'Unread count:', unreadCount);
      } else {
        const errorData = await res.json();
        console.error('Notifications API error:', errorData);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      loadingNotifications = false;
    }
  }

  async function markAsRead(notificationId: number) {
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
      if (res.ok) {
        notifications = notifications.map(n => 
          n.notification_id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        );
        unreadCount = notifications.filter((n: any) => !n.is_read).length;
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  function formatNotificationTime(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function formatNotificationType(type: string) {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function clickOutside(node: HTMLElement, callback: () => void) {
    const handleClick = (e: MouseEvent) => {
      if (node && !node.contains(e.target as Node) && !e.defaultPrevented) {
        callback();
      }
    };
    document.addEventListener('click', handleClick, true);
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }

  // Fetch notifications on component mount
  $effect(() => {
    fetchNotifications();
  });

  // Notification creation helper
  async function createNotification(notificationData: {
    user_id: number;
    notification_type: string;
    message: string;
    actor_id?: number;
    action_type?: string;
    target_entity_type?: string;
    target_entity_id?: number;
    reference_id?: number;
    metadata?: any;
  }) {
    try {
      const res = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationData)
      });
      if (res.ok) {
        // Refresh notifications to show the new one
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  const osaActions = [
    {
      label: 'OSA Dashboard',
      href: '/osa/dashboard',
      icon: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><line x1="10" y1="17" x2="10" y2="17"/>`,
      description: 'View dashboard and statistics'
    },
    {
      label: 'Manage Applications',
      href: '/osa',
      icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
      description: 'Review and process vehicle registrations'
    },
    {
      label: 'Add Admin',
      href: '/osa/admin',
      icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
      description: 'Create new admin accounts'
    },
    {
      label: 'Departments',
      href: '/osa/departments',
      icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      description: 'Manage college departments'
    },
    {
      label: 'Dean Management',
      href: '/osa/deans',
      icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
      description: 'Manage dean accounts and assignments'
    }
  ];

  const securityActions = [
    {
      label: 'Dashboard',
      href: '/security/dashboard',
      icon: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><line x1="10" y1="17" x2="10" y2="17"/>`,
      description: 'View security dashboard and stats'
    },
    {
      label: 'Vehicle Operations',
      href: '/security',
      icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
      description: 'Manage registered vehicles'
    },
    {
      label: 'Complaints',
      href: '/security/complaints',
      icon: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
      description: 'View and manage complaints'
    }
  ];

  const quickActions = userRole === 'security' ? securityActions : osaActions;
</script>

<!-- Page shell -->
<main class="app-shell">
  {#if showSidebar}
    <aside class="sidebar">
      <!-- Brand Section -->
      <div class="sidebar-brand">
        <div class="brand-logo">
          <img src="/liceo-logo.png" alt="LICEO DE CAGAYAN UNIVERSITY" />
        </div>
        <div class="brand-info">
          <span class="brand-name">GateQR</span>
          <span class="brand-sub">Liceo de Cagayan University</span>
        </div>
      </div>

      <!-- User Section -->
      <div class="sidebar-user">
        <div class="user-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="user-info">
          <span class="user-email">{userEmail}</span>
          <span class="user-role">{userRole === 'security' ? 'Security Officer' : 'OSA Admin'}</span>
        </div>
        <button class="logout-btn" onclick={handleLogout} title="Logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>

      <!-- Divider -->
      <div class="sidebar-divider"></div>

      <!-- Quick Actions -->
      <div class="sidebar-header">
        <h3>Quick Actions</h3>
      </div>
      <nav class="sidebar-nav">
        {#each quickActions as action}
          <a href={action.href} class="sidebar-link">
            <div class="sidebar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                {@html action.icon}
              </svg>
            </div>
            <div class="sidebar-content">
              <div class="sidebar-label">{action.label}</div>
              <div class="sidebar-desc">{action.description}</div>
            </div>
          </a>
        {/each}
      </nav>
    </aside>
  {/if}
  <div class="shell-content">
    <div class="content-header">
      <div class="notification-wrapper" use:clickOutside={() => notificationDropdownOpen = false}>
        <button class="notification-btn" onclick={() => notificationDropdownOpen = !notificationDropdownOpen}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {#if unreadCount > 0}
            <span class="notification-badge">{unreadCount}</span>
          {/if}
        </button>
        {#if notificationDropdownOpen}
          <div class="notification-dropdown">
            <div class="notification-header">
              <span class="notification-title">Notifications</span>
              {#if unreadCount > 0}
                <button class="mark-all-read-btn" onclick={() => {
                  notifications.forEach(n => markAsRead(n.notification_id));
                  notificationDropdownOpen = false;
                }}>
                  Mark all as read
                </button>
              {/if}
            </div>
            <div class="notification-list">
              {#if loadingNotifications}
                <div class="notification-loading">Loading...</div>
              {:else if notifications.length === 0}
                <div class="notification-empty">No notifications</div>
              {:else}
                {#each notifications as notification}
                  <div class="notification-item" class:unread={!notification.is_read} onclick={() => markAsRead(notification.notification_id)}>
                    <div class="notification-content">
                      <p class="notification-message">{notification.message}</p>
                      <div class="notification-details">
                        <span class="notification-type">{formatNotificationType(notification.notification_type)}</span>
                        <span class="notification-email">{notification.actor?.email || notification.user?.email || 'Unknown'}</span>
                      </div>
                      <span class="notification-time">{formatNotificationTime(notification.created_at)}</span>
                    </div>
                    {#if !notification.is_read}
                      <div class="notification-dot"></div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
    {@render children()}
  </div>
</main>

<style>
  .app-shell {
    min-height: 100vh;
    padding: var(--space-xl);
    display: flex;
    gap: var(--space-xl);
    background: var(--bg-gradient);
  }

  .sidebar {
    width: 360px;
    flex-shrink: 0;
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    height: fit-content;
    position: sticky;
    top: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-light);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--gradient-maroon);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-gold-md);
    position: relative;
    overflow: hidden;
  }

  .sidebar-brand::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    animation: shimmer 3s infinite;
  }

  .brand-logo {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: relative;
    z-index: 1;
    overflow: hidden;
  }

  .brand-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 4px;
  }

  .brand-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    position: relative;
    z-index: 1;
  }

  .brand-name {
    font-size: 1.5rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .brand-sub {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .sidebar-user {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--maroon-muted);
    border: 1px solid var(--maroon-tint);
    border-radius: var(--radius-lg);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-user:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .user-avatar {
    width: 48px;
    height: 48px;
    background: var(--gradient-maroon);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: var(--shadow-gold-sm);
    border: 3px solid white;
    font-weight: 700;
    font-size: 1.125rem;
  }

  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
  }

  .user-email {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-role {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .logout-btn {
    width: 40px;
    height: 40px;
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--maroon);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .logout-btn:hover {
    background: var(--maroon);
    color: #fff;
    border-color: var(--maroon);
    transform: translateY(-2px) rotate(180deg);
    box-shadow: var(--shadow-gold-md);
  }

  .sidebar-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, var(--border) 50%, transparent 100%);
    margin: var(--space-sm) 0;
  }

  .sidebar-header {
    margin-bottom: var(--space-sm);
  }

  .sidebar-header h3 {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--maroon);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .sidebar-link {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--surface);
    border: 2px solid var(--border-light);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 64px;
    position: relative;
    overflow: hidden;
  }

  .sidebar-link::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--gradient-gold);
    transform: scaleY(0);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-link:hover {
    border-color: var(--gold);
    transform: translateX(4px);
    box-shadow: var(--shadow-gold-sm);
  }

  .sidebar-link:hover::before {
    transform: scaleY(1);
  }

  .sidebar-icon {
    width: 44px;
    height: 44px;
    background: var(--maroon-muted);
    border: 1px solid var(--maroon-tint);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--maroon);
    flex-shrink: 0;
    transition: all 0.3s;
  }

  .sidebar-link:hover .sidebar-icon {
    background: var(--gradient-gold);
    color: var(--text-primary);
    border-color: var(--gold);
    transform: scale(1.05);
  }

  .sidebar-content {
    flex: 1;
    min-width: 0;
  }

  .sidebar-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-xs);
    transition: color 0.3s;
  }

  .sidebar-link:hover .sidebar-label {
    color: var(--maroon);
  }

  .sidebar-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .shell-content {
    flex: 1;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .content-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: var(--space-sm) 0;
  }

  @media (max-width: 1024px) {
    .app-shell {
      flex-direction: column;
      padding: var(--space-lg);
    }

    .sidebar {
      width: 100%;
      position: static;
    }
  }

  @media (max-width: 640px) {
    .app-shell {
      padding: var(--space-md);
      gap: var(--space-md);
    }
  }

  @media (max-width: 768px) {
    .sidebar-brand {
      padding: var(--space-sm);
    }

    .brand-logo {
      width: 44px;
      height: 44px;
    }

    .brand-name {
      font-size: 1.25rem;
    }

    .sidebar-user {
      padding: var(--space-sm);
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      font-size: 0.9rem;
    }

    .sidebar-link {
      padding: var(--space-sm);
      min-height: 56px;
    }

    .sidebar-icon {
      width: 36px;
      height: 36px;
    }

    .notification-dropdown {
      width: min(340px, calc(100vw - 2rem));
      right: 0;
    }
  }

  @media (max-width: 480px) {
    .notification-dropdown {
      width: calc(100vw - 2rem);
      right: 50%;
      transform: translateX(50%);
      position: fixed;
      top: auto;
    }
  }

  /* Notification styles */
  .notification-wrapper {
    position: relative;
  }

  .notification-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-sm);
    background: var(--gradient-maroon);
    border: 2px solid var(--maroon-tint);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: #fff;
    box-shadow: var(--shadow-gold-sm);
  }

  .notification-btn:hover {
    background: var(--gradient-gold);
    border-color: var(--gold);
    color: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-gold-md);
  }

  .notification-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--gradient-gold);
    color: var(--text-primary);
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    box-shadow: var(--shadow-sm);
  }

  .notification-dropdown {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    width: 380px;
    max-height: 480px;
    background: var(--surface);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2xl);
    z-index: 1000;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-light);
    background: var(--maroon-muted);
  }

  .notification-title {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--maroon);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .mark-all-read-btn {
    background: var(--surface);
    border: 1px solid var(--maroon-tint);
    color: var(--maroon);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .mark-all-read-btn:hover {
    background: var(--maroon);
    color: white;
    border-color: var(--maroon);
  }

  .notification-list {
    max-height: 420px;
    overflow-y: auto;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-light);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .notification-item:hover {
    background: var(--maroon-muted);
    transform: translateX(-2px);
  }

  .notification-item.unread {
    background: var(--gold-muted);
    border-left: 3px solid var(--gold);
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-message {
    font-size: 0.85rem;
    color: var(--text-primary);
    margin: 0 0 var(--space-xs) 0;
    line-height: 1.5;
    font-weight: 500;
  }

  .notification-details {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-xs);
    flex-wrap: wrap;
  }

  .notification-type {
    font-size: 0.7rem;
    color: var(--maroon);
    background: var(--maroon-muted);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-xs);
    font-weight: 600;
    border: 1px solid var(--maroon-tint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .notification-email {
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .notification-time {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .notification-dot {
    width: 8px;
    height: 8px;
    background: var(--gradient-gold);
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: var(--space-sm);
    box-shadow: 0 0 0 2px var(--gold-muted);
  }

  .notification-loading,
  .notification-empty {
    padding: var(--space-2xl) var(--space-lg);
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
  }
</style>
