<script lang="ts">
  let {
    tabs,
    active,
    counts = [],
    onchange
  }: {
    tabs: string[];
    active: string;
    counts?: number[];
    onchange: (tab: string) => void;
  } = $props();
</script>

<div class="tab-bar" role="tablist">
  {#each tabs as tab, i}
    <button
      role="tab"
      aria-selected={active === tab}
      class="tab-btn"
      class:tab-active={active === tab}
      onclick={() => onchange(tab)}
    >
      {tab}
      {#if counts[i] > 0}
        <span class="tab-count">{counts[i]}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tab-count {
    display: inline-block;
    min-width: 1.25rem;
    margin-left: 0.35rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: var(--maroon);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
  }

  .tab-active .tab-count {
    background: #fff;
    color: var(--maroon);
  }
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
    flex: 1 1 auto;
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
    white-space: normal;
    text-align: center;
    line-height: 1.25;
    overflow-wrap: anywhere;
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
