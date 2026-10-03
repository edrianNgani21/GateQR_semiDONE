<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let email = $state("");
  let loading = $state(false);
  let error = $state("");

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!email) return;

    loading = true;
    error = "";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        // Redirect to OTP page with email in query param
        goto(`/otp?email=${encodeURIComponent(email)}`);
      } else {
        const data = await res.json();
        error = data.error || "Failed to send login link";
      }
    } catch (err) {
      error = "A network error occurred. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In — GateQR | Liceo de Cagayan University</title>
  <meta
    name="description"
    content="Sign in to GateQR to manage your vehicle parking sticker application at Liceo de Cagayan University."
  />
</svelte:head>

<div class="login-page">
  <div class="bg-glow"></div>
  <div class="bg-image"></div>
  <div class="bg-overlay"></div>

  <div class="login-card">
    <div class="login-brand">
      <div class="login-logo">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      </div>
      <div>
        <h1 class="login-title">GateQR</h1>
        <p class="login-university">Liceo de Cagayan University</p>
      </div>
    </div>

    <div class="login-divider"></div>

    <form class="login-form" onsubmit={handleLogin}>
      <p class="login-desc">
        Enter your Liceo email address to sign in. Visitors may use a personal
        email. A secure login code will be sent to your inbox.
      </p>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <div class="field-group">
        <label class="field-label" for="email">Email address</label>
        <div class="input-wrap">
          <svg
            class="input-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
            />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="email@liceo.edu.ph"
            autocomplete="email"
            required
            disabled={loading}
          />
        </div>
      </div>

      <button type="submit" class="login-btn" disabled={loading}>
        <span>{loading ? "Sending..." : "Send Login Code"}</span>
        {#if !loading}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg
          >
        {/if}
      </button>
    </form>

    <p class="login-footer">
      Having trouble? Contact
      <a href="mailto:osa@liceo.edu.ph" class="footer-link">osa@liceo.edu.ph</a>
    </p>
  </div>
</div>

<style>
  .login-page {
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
    background: radial-gradient(
      circle,
      rgba(212, 166, 42, 0.15) 0%,
      transparent 70%
    );
    top: -150px;
    right: -150px;
    pointer-events: none;
    animation: pulse 4s ease-in-out infinite;
    z-index: 2;
  }

  .bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("/rodelsa-image.png");
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
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.6) 0%,
      rgba(0, 0, 0, 0.4) 50%,
      rgba(0, 0, 0, 0.7) 100%
    );
    z-index: 1;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  .login-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: var(--radius-2xl);
    padding: var(--space-2xl);
    width: 100%;
    max-width: 440px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    position: relative;
    z-index: 10;
    border: 2px solid rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .login-brand {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .login-logo {
    width: 64px;
    height: 64px;
    background: var(--gradient-maroon);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: var(--shadow-gold-md);
    border: 3px solid white;
  }

  .login-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--maroon);
    letter-spacing: -0.02em;
    margin: 0;
    background: var(--gradient-maroon);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .login-university {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0.2rem 0 0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .login-divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--border), transparent);
    margin: var(--space-lg) 0;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .login-desc {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
    font-weight: 500;
  }

  .error-msg {
    color: #b91c1c;
    background: #fef2f2;
    border: 2px solid #fca5a5;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .field-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .input-wrap {
    position: relative;
  }

  .input-icon {
    position: absolute;
    left: var(--space-md);
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
    transition: color 0.2s;
  }

  .input-wrap input {
    padding-left: 2.75rem;
    height: 48px;
    border-radius: var(--radius-md);
    border: 2px solid var(--border);
    font-size: 0.95rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .input-wrap input:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 4px rgba(212, 166, 42, 0.15);
    outline: none;
  }

  .login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    background: var(--gradient-maroon);
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    border-radius: var(--radius-md);
    text-decoration: none;
    box-shadow: var(--shadow-gold-md);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
    height: 52px;
  }

  .login-btn:hover:not(:disabled) {
    background: var(--gradient-gold);
    color: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-gold-lg);
  }

  .login-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .login-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .login-footer {
    margin-top: var(--space-lg);
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    font-weight: 500;
  }

  .footer-link {
    color: var(--maroon);
    font-weight: 700;
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: var(--gold);
  }

  @media (max-width: 768px) {
    .login-page {
      padding: var(--space-lg);
    }

    .login-card {
      padding: var(--space-xl);
    }

    .login-logo {
      width: 56px;
      height: 56px;
    }

    .login-title {
      font-size: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .login-page {
      padding: var(--space-md);
    }

    .login-card {
      padding: var(--space-lg);
      border-radius: var(--radius-xl);
    }

    .login-brand {
      flex-direction: column;
      text-align: center;
    }

    .login-logo {
      width: 52px;
      height: 52px;
    }

    .login-title {
      font-size: 1.375rem;
    }
  }
</style>
