<script lang="ts">
  let {
    tabs,
    active,
    onchange
  }: {
    tabs: string[];
    active: string;
    onchange: (tab: string) => void;
  } = $props();
</script>

<div class="tab-bar" role="tablist">
  {#each tabs as tab}
    <button
      role="tab"
      aria-selected={active === tab}
      class="tab-btn"
      class:tab-active={active === tab}
      onclick={() => onchange(tab)}
    >
      {tab}
    </button>
  {/each}
</div>

<style>
  .tab-bar {
    display: flex;
    gap: 0.375rem;
    background: var(--maroon-tint);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.3rem;
    flex-wrap: wrap;
  }

  .tab-btn {
    flex: 1;
    min-width: 80px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    text-transform: capitalize;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .tab-btn:hover:not(.tab-active) {
    background: rgba(107,26,42,0.07);
    color: var(--maroon);
  }

  .tab-active {
    background: var(--maroon) !important;
    color: #fff !important;
    box-shadow: 0 2px 8px rgba(107,26,42,0.3);
  }
</style>
