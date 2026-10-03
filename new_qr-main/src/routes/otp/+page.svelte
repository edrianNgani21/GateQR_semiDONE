<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let email = $state('');
  let otp = $state('');
  let loading = $state(false);
  let error = $state('');

  onMount(() => {
    email = $page.url.searchParams.get('email') || '';
    if (!email) {
      goto('/login'); // Email is required
    }
  });

  async function handleVerify(e: Event) {
    e.preventDefault();
    if (!email || !otp) return;

    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      if (res.ok) {
        const data = await res.json();
        // Use the redirectUrl from the API response
        goto(data.redirectUrl || '/status');
      } else {
        const data = await res.json();
        error = data.error || 'Invalid code';
      }
    } catch (err) {
      error = 'A network error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Enter Code — GateQR</title>
  <meta name="description" content="Enter the login code sent to your email." />
</svelte:head>

<div class="otp-page">
  <div class="bg-glow"></div>
  <div class="bg-image"></div>
  <div class="bg-overlay"></div>

  <div class="otp-card">
    <div class="envelope-icon">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    </div>

    <h1 class="otp-title">Check your email</h1>
    <p class="otp-main">We sent a 6-digit login code to <strong>{email}</strong></p>
    
    <form class="otp-form" onsubmit={handleVerify}>
      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <div class="field-group">
        <input 
          type="text" 
          bind:value={otp} 
          placeholder="000000" 
          maxlength="6"
          required
          class="otp-input"
          disabled={loading}
        />
      </div>

      <button type="submit" class="verify-btn" disabled={loading || otp.length < 6}>
        {loading ? 'Verifying...' : 'Verify Code'}
      </button>
    </form>

    <p class="otp-sub">
      Didn't receive it? Check your spam folder or
      <a href="/login" class="retry-link">try again</a>.
    </p>

    <a href="/login" class="back-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Back to Sign In
    </a>
  </div>
</div>

<style>
  .otp-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
    background: var(--bg-gradient);
    position: relative;
    overflow: hidden;
  }

  .bg-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(212,166,42,0.15) 0%, transparent 70%);
    bottom: -150px;
    left: -150px;
    pointer-events: none;
    animation: pulse 4s ease-in-out infinite reverse;
    z-index: 2;
  }

  .bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('/rodelsa-image.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;
  }

  .bg-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.7) 100%);
    z-index: 1;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  .otp-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: var(--radius-2xl);
    padding: var(--space-2xl);
    width: 100%;
    max-width: 420px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    position: relative;
    z-index: 10;
    border: 2px solid rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .envelope-icon {
    width: 80px;
    height: 80px;
    background: var(--gradient-maroon);
    border: 3px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    margin-bottom: var(--space-sm);
    box-shadow: var(--shadow-gold-md);
  }

  .otp-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--maroon);
    letter-spacing: -0.02em;
    margin: 0;
    background: var(--gradient-maroon);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .otp-main {
    font-size: 0.95rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
    font-weight: 500;
  }

  .otp-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    width: 100%;
    margin-top: var(--space-sm);
  }

  .error-msg {
    color: #B91C1C;
    background: #FEF2F2;
    border: 2px solid #FCA5A5;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .field-group {
    display: flex;
    flex-direction: column;
  }

  .otp-input {
    text-align: center;
    font-size: 1.75rem;
    letter-spacing: 0.5rem;
    padding: var(--space-md);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    outline: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 56px;
    font-weight: 700;
  }

  .otp-input:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 4px rgba(212,166,42,0.15);
  }

  .verify-btn {
    padding: var(--space-md);
    background: var(--gradient-maroon);
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 52px;
    box-shadow: var(--shadow-gold-sm);
  }

  .verify-btn:hover:not(:disabled) {
    background: var(--gradient-gold);
    color: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-gold-md);
  }

  .verify-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .otp-sub {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: var(--space-md) 0 0;
    font-weight: 500;
  }

  .retry-link {
    color: var(--maroon);
    font-weight: 700;
    text-decoration: none;
    transition: color 0.2s;
  }

  .retry-link:hover {
    color: var(--gold);
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    padding: var(--space-sm) var(--space-lg);
    background: var(--maroon-muted);
    color: var(--maroon);
    font-size: 0.85rem;
    font-weight: 700;
    border-radius: var(--radius-md);
    text-decoration: none;
    border: 2px solid var(--maroon-tint);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .back-btn:hover {
    background: var(--maroon-tint);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  @media (max-width: 768px) {
    .otp-page {
      padding: var(--space-lg);
    }

    .otp-card {
      padding: var(--space-xl);
    }

    .envelope-icon {
      width: 64px;
      height: 64px;
    }

    .otp-title {
      font-size: 1.25rem;
    }
  }
</style>