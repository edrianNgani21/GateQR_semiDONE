<script lang="ts">
  import { page } from '$app/stores';

  type Link = { label: string; href: string; badge?: number };
  let { title, links = [] }: { title: string; links?: Link[] } = $props();
</script>

<div class="navbar">
  <h1 class="navbar-title">{title}</h1>
  {#if links.length > 0}
    <nav class="navbar-links">
      {#each links as link}
        <a href={link.href} class="nav-link" class:active={$page.url.pathname === link.href}>
          {link.label}
          {#if link.badge}
            <span class="badge">{link.badge > 99 ? '99+' : link.badge}</span>
          {/if}
        </a>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
    padding: var(--space-sm) 0;
  }

  .navbar-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--maroon);
    letter-spacing: -0.02em;
    margin: 0;
    background: var(--gradient-maroon);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .navbar-links {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .nav-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface);
    border: 2px solid var(--border-light);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .nav-link::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--gradient-gold);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(-50%);
  }

  .nav-link:hover {
    background: var(--maroon-muted);
    color: var(--maroon);
    border-color: var(--maroon-tint);
    transform: translateY(-2px);
    box-shadow: var(--shadow-gold-sm);
  }

  .nav-link:hover::before {
    width: 80%;
  }

  .nav-link.active {
    background: var(--gradient-maroon);
    color: white;
    border-color: var(--maroon);
    box-shadow: var(--shadow-gold-sm);
  }

  .nav-link.active::before {
    width: 80%;
    background: var(--gold);
  }

  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 50%;
    background: var(--gradient-gold);
    color: var(--text-primary);
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 0 0 2px var(--surface);
    border: 1px solid var(--gold);
  }

  @media (max-width: 768px) {
    .navbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .navbar-links {
      width: 100%;
      overflow-x: auto;
      padding-bottom: var(--space-xs);
    }

    .nav-link {
      flex-shrink: 0;
    }
  }
</style>
