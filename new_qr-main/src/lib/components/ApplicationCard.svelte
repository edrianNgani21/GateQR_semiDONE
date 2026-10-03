<script lang="ts">
  import StatusBadge from "./StatusBadge.svelte";
  import DocumentGrid from "./DocumentGrid.svelte";

  let {
    tab = "validation",
    showQR = false,
    showDocs = true,
    data = {},
    children,
    selectable = false,
    selected = false,
    onselect,
  }: {
    tab?: string;
    showQR?: boolean;
    showDocs?: boolean;
    data?: Record<string, any>;
    children?: any;
    selectable?: boolean;
    selected?: boolean;
    onselect?: (selected: boolean) => void;
  } = $props();

  let expanded = $state(false);

  let showDocPopup = $state<string | null>(null);

  let defaults = $derived(data as Record<string, any>);

  let role = $derived(data.role?.toLowerCase() ?? "student");
  let ownerVal = $derived(data.owner?.toLowerCase() === "yes" ? "yes" : "no");
  let rejectionReason = $derived(data.rejection_reason ?? null);
  let appStatus = $derived(data.status ?? null);
  let reasonLabel = $derived(
    appStatus === "revoked" ? "Revoked:" : "Rejected:",
  );

  function formatDate(d: string | null | undefined): string | null {
    if (!d || d === '-' || d === 'N/A') return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  let statusLabel = $derived(
    appStatus?.replace("_", " ")?.toUpperCase() || "UNKNOWN",
  );
  let statusVariant = $derived<'default' | 'success' | 'warning' | 'danger'>(
    appStatus && ["distributed", "osa_val", "dept_val"].includes(appStatus)
      ? "success"
      : appStatus && ["rejected", "revoked", "expired"].includes(appStatus)
        ? "danger"
        : "warning",
  );

  // Status pill color
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    success: { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
    danger:  { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" },
    warning: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
    default: { bg: "var(--surface)", text: "var(--text-secondary)", border: "var(--border)" },
  };
  let pill = $derived(statusColors[statusVariant] ?? statusColors.default);

  // Role badge colors
  const roleColors: Record<string, string> = {
    student: "#3b82f6",
    employee: "#8b5cf6",
    visitor: "#f59e0b",
    concessionaire: "#10b981",
    guest: "#6b7280",
  };
  let roleColor = $derived(roleColors[role] ?? "#6b7280");

  const excludedKeys = ["documents", "owner", "rejection_reason", "status", "crd", "dpt", "osa", "sch", "hdc", "sec", "rel", "ins", "exp"];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="app-card" class:expanded class:selected class:selectable>

  <!-- ── Compact Summary Row (always visible) ── -->
  <div
    class="card-summary"
    onclick={(e) => {
      if ((e.target as HTMLElement).closest('.checkbox-wrap')) return;
      expanded = !expanded;
    }}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') expanded = !expanded; }}
    aria-expanded={expanded}
  >
    {#if selectable}
      <div class="checkbox-wrap" onclick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          class="sel-checkbox"
          checked={selected}
          onchange={(e) => onselect?.((e.target as HTMLInputElement).checked)}
        />
      </div>
    {/if}

    <!-- Avatar -->
    <div class="avatar" style="background: {roleColor}22; color: {roleColor}; border-color: {roleColor}44;">
      {(data.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
    </div>

    <!-- Name + meta -->
    <div class="summary-main">
      <span class="summary-name">{data.name || '—'}</span>
      <div class="summary-meta">
        {#if data.department && data.department !== '-'}
          <span class="meta-chip">{data.department}</span>
        {/if}
        {#if data.campus}
          <span class="meta-chip campus-chip">{data.campus}</span>
        {/if}
      </div>
    </div>

    <!-- Right pills -->
    <div class="summary-right">
      {#if rejectionReason === 'OVERDUE' || (data.sch && (!data.hdc || data.hdc === '-') && new Date(data.sch) < new Date())}
        <span class="status-pill" style="background: #fef2f2; color: #b91c1c; border-color: #fca5a5;">OVERDUE</span>
      {:else if rejectionReason === 'RESCHEDULED'}
        <span class="status-pill" style="background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;">RESCHEDULED</span>
      {/if}
      <span class="role-badge" style="background: {roleColor}18; color: {roleColor}; border-color: {roleColor}33;">
        {role}
      </span>
      {#if data.plate}
        <span class="plate-chip">{data.plate}</span>
      {/if}
      <span class="status-pill" style="background: {pill.bg}; color: {pill.text}; border-color: {pill.border};">
        {statusLabel}
      </span>
      <svg class="chevron" class:open={expanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  </div>

  <!-- ── Expandable Detail Panel ── -->
  {#if expanded}
    <div class="card-detail">
      <div class="detail-inner">

        <!-- Info grid -->
        <div class="info-grid">
          {#each Object.entries(defaults) as [key, val]}
            {#if val !== undefined && val !== null && val !== '-' && !excludedKeys.includes(key)}
              <div class="info-item">
                <span class="info-label">{key}</span>
                <span class="info-value">{val}</span>
              </div>
            {/if}
          {/each}
          {#if rejectionReason && rejectionReason !== 'OVERDUE' && rejectionReason !== 'RESCHEDULED'}
            <div class="info-item info-item-full reason-item">
              <span class="info-label reason-label">{reasonLabel}</span>
              <span class="info-value reason-value">{rejectionReason}</span>
            </div>
          {/if}
        </div>

        <!-- Timeline badges -->
        <div class="timeline-badges">
          {#if appStatus}
            <StatusBadge code="STS" date={statusLabel} variant={statusVariant} />
          {/if}
          {#if data.crd}
            <StatusBadge code="CRD" date={formatDate(data.crd)} />
          {/if}
          {#if data.dpt}
            <StatusBadge code="DPT" date={formatDate(data.dpt)} variant="success" />
          {/if}
          {#if data.osa}
            <StatusBadge code="OSA" date={formatDate(data.osa)} variant="success" />
          {/if}
          {#if data.sch}
            <StatusBadge code="SCH" date={formatDate(data.sch)} variant="warning" />
          {/if}
          {#if data.hdc}
            <StatusBadge code="HDC" date={formatDate(data.hdc)} variant="success" />
          {/if}
          {#if data.sec}
            <StatusBadge code="SEC" date={formatDate(data.sec)} variant="success" />
          {/if}
          {#if data.rel}
            <StatusBadge code="REL" date={formatDate(data.rel)} variant="success" />
          {/if}
          {#if data.ins}
            <StatusBadge code="INS" date={formatDate(data.ins)} variant="success" />
          {/if}
          {#if data.exp}
            <StatusBadge code="EXP" date={formatDate(data.exp)} variant="warning" />
          {/if}
        </div>

        <!-- Documents -->
        {#if showDocs}
          <div class="detail-section">
            <span class="section-label">Documents</span>
            <DocumentGrid
              {role}
              owner={ownerVal}
              documents={defaults.documents || {}}
              onopen={(url) => (showDocPopup = url)}
            />
          </div>
        {/if}

        <!-- QR Code -->
        {#if showQR && data.qr_code}
          <div class="detail-section">
            <span class="section-label">QR Code</span>
            <div class="qr-body">
              <img src={data.qr_code} alt="QR" width="96" height="96" class="qr-img" />
              <div class="qr-meta">
                {#if data.qr_unique_code}
                  <span class="qr-code-text">Code: {data.qr_unique_code}</span>
                {/if}
                <a href={data.qr_code} download class="qr-download-btn">Download QR</a>
              </div>
            </div>
          </div>
        {/if}

        <!-- Action Bar -->
        {#if children}
          <div class="detail-section action-section">
            {@render children()}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if showDocPopup}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="doc-modal-overlay" onclick={() => (showDocPopup = null)} role="dialog" aria-modal="true" tabindex="-1">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="doc-modal-content" onclick={(e) => e.stopPropagation()}>
      <button class="close-modal" aria-label="Close document viewer" onclick={() => (showDocPopup = null)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          ><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
      <div class="doc-image-wrap">
        {#if showDocPopup.toLowerCase().includes('.pdf')}
          <iframe src={showDocPopup} title="Document Preview" class="doc-preview-frame"></iframe>
        {:else}
          <img src={showDocPopup} alt="Document Preview" class="doc-preview-img" />
        {/if}
        <a href={showDocPopup} target="_blank" rel="noopener noreferrer" class="doc-open-link">
          Open original document in new tab ↗
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ─── Card Shell ─────────────────────────────────────────────────────── */
  .app-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md, 10px);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .app-card.selected {
    border-color: var(--maroon);
    box-shadow: 0 0 0 2px rgba(107,26,42,0.12), var(--shadow-sm);
  }
  .app-card.expanded {
    border-color: var(--maroon, #6b1a2a);
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
  }

  /* ─── Summary Row ─────────────────────────────────────────────────────── */
  .card-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    cursor: pointer;
    user-select: none;
    min-height: 54px;
    transition: background 0.15s;
    flex-wrap: wrap;
  }
  .card-summary:hover {
    background: var(--maroon-muted, rgba(107,26,42,0.04));
  }
  .app-card.expanded .card-summary {
    border-bottom: 1.5px solid var(--border-light, #f0e8ea);
    background: var(--maroon-muted, rgba(107,26,42,0.04));
  }

  @media (max-width: 480px) {
    .card-summary {
      flex-wrap: wrap;
    }
    .summary-right {
      width: 100%;
      justify-content: flex-start;
      border-top: 1px solid var(--border-light, #f0e8ea);
      padding-top: 0.4rem;
      margin-top: -0.2rem;
    }
  }

  /* ─── Checkbox ───────────────────────────────────────────────────────── */
  .checkbox-wrap { flex-shrink: 0; }
  .sel-checkbox {
    width: 17px;
    height: 17px;
    cursor: pointer;
    accent-color: var(--maroon);
  }

  /* ─── Avatar ─────────────────────────────────────────────────────────── */
  .avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  /* ─── Name / meta ────────────────────────────────────────────────────── */
  .summary-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .summary-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .summary-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .meta-chip {
    font-size: 0.68rem;
    color: var(--text-secondary);
    background: var(--border-light, #f0f0f0);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 500;
  }
  .campus-chip {
    background: rgba(107,26,42,0.08);
    color: var(--maroon, #6b1a2a);
  }

  /* ─── Right Pills ────────────────────────────────────────────────────── */
  .summary-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .role-badge {
    font-size: 0.67rem;
    font-weight: 600;
    padding: 0.18rem 0.5rem;
    border-radius: 99px;
    border: 1px solid;
    text-transform: capitalize;
    letter-spacing: 0.02em;
  }
  .plate-chip {
    font-size: 0.72rem;
    font-weight: 700;
    font-family: monospace;
    color: var(--text-primary);
    background: var(--border-light, #f4f4f4);
    border: 1px solid var(--border);
    padding: 0.18rem 0.55rem;
    border-radius: 5px;
    letter-spacing: 0.06em;
  }
  .status-pill {
    font-size: 0.67rem;
    font-weight: 700;
    padding: 0.18rem 0.55rem;
    border-radius: 99px;
    border: 1px solid;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ─── Chevron ────────────────────────────────────────────────────────── */
  .chevron {
    color: var(--text-secondary);
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    margin-left: 0.15rem;
  }
  .chevron.open {
    transform: rotate(180deg);
    color: var(--maroon);
  }

  /* ─── Detail Panel ───────────────────────────────────────────────────── */
  .card-detail {
    animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .detail-inner {
    padding: 1rem 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  /* ─── Info Grid ──────────────────────────────────────────────────────── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.4rem 1rem;
  }
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .info-item-full { grid-column: 1 / -1; }
  .info-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .info-value {
    font-size: 0.8rem;
    color: var(--text-primary);
    font-weight: 500;
    word-break: break-word;
  }
  .reason-item {
    padding: 0.5rem 0.625rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
  }
  .reason-label { color: #b91c1c; }
  .reason-value { color: #b91c1c; }

  /* ─── Timeline Badges ────────────────────────────────────────────────── */
  .timeline-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  /* ─── Section divider ────────────────────────────────────────────────── */
  .detail-section {
    border-top: 1px solid var(--border-light, #f0e8ea);
    padding-top: 0.75rem;
  }
  .section-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-secondary);
    margin-bottom: 0.45rem;
  }

  /* ─── QR ─────────────────────────────────────────────────────────────── */
  .qr-body {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }
  .qr-img {
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .qr-meta {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .qr-code-text {
    font-family: monospace;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--maroon);
  }
  .qr-download-btn {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--maroon);
    text-decoration: none;
    padding: 0.25rem 0.625rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 5px;
    transition: background 0.15s, color 0.15s;
  }
  .qr-download-btn:hover {
    background: var(--maroon);
    color: white;
  }

  /* ─── Document Modal ─────────────────────────────────────────────────── */
  .doc-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .doc-modal-content {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    position: relative;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    max-width: 92vw;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  .close-modal {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--maroon-muted);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    transition: background 0.15s, color 0.15s;
  }
  .close-modal:hover {
    background: var(--maroon);
    color: #fff;
    border-color: var(--maroon);
  }
  .doc-image-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .doc-preview-img {
    max-width: 90vw;
    max-height: 75vh;
    object-fit: contain;
    border-radius: var(--radius-sm);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .doc-preview-frame {
    width: 80vw;
    height: 75vh;
    border: none;
    border-radius: var(--radius-sm);
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .doc-open-link {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--maroon);
    text-decoration: underline;
    margin-top: 0.25rem;
    transition: color 0.15s;
  }
  .doc-open-link:hover {
    color: #800000;
  }
</style>

