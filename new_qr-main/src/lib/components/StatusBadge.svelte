<script lang="ts">
  let { code, date, variant = 'default' }: {
    code: string;
    date: string | null;
    variant?: 'default' | 'success' | 'warning' | 'danger';
  } = $props();
</script>

{#if date}
<div class="status-badge badge-{variant}">
  <span class="badge-code">{code}</span>
  <span class="badge-date">{date}</span>
</div>
{/if}

<style>
  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 5px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    white-space: nowrap;
  }

  .badge-code {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--maroon);
  }

  .badge-date {
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .badge-success {
    border-color: #86efac;
    background: #f0fdf4;
  }
  .badge-success .badge-code { color: #15803d; }

  .badge-warning {
    border-color: #fde68a;
    background: #fffbeb;
  }
  .badge-warning .badge-code { color: #b45309; }

  .badge-danger {
    border-color: #fca5a5;
    background: #fef2f2;
  }
  .badge-danger .badge-code { color: #b91c1c; }
</style>
