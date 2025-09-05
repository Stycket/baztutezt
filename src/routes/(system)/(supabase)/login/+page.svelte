<script>
  import { supabase } from '$lib/services/system/supabase';
  import { session } from '$lib/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { syncSession, ensureClientSession } from '$lib/services/system/session-sync';
  import { page } from '$app/stores';

  let email = '';
  let password = '';
  let loading = false;
  let error = null;
  let successMessage = '';
  
  // Specifik Unsplash-bild för login-sidan
  const unsplashImage = "https://wallpapers.com/images/featured/white-gradient-background-o0tqqpgs66oz4rfr.jpg";

  onMount(async () => {
    try {
      const sessionSynced = await syncSession();
      console.log('Layout session sync result:', sessionSynced);
    } catch (err) {
      console.error('Error in layout session sync:', err);
    }

    // Check for registration success parameter
    if ($page.url.searchParams.get('registered') === 'true') {
      successMessage = 'Du har fått ett e-postmeddelande! Kontrollera din inkorg för att aktivera ditt konto.';
    }
  });

  async function handleLogin() {
    try {
      loading = true;
      error = null;
      
      console.log('Attempting login...');
      
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      console.log('Auth response:', { success: !!data, hasUser: !!data?.session?.user });
      
      if (authError) throw authError;

      // Set cookies without HttpOnly flag så att JavaScript kan läsa dem
      document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      console.log('Cookies set without HttpOnly flag');

      // Uppdatera session-store direkt
      session.set(data.session);
      
      // Enkel omdirigering
      console.log('Login successful, redirecting...');
      window.location.href = '/frontpage';
    } catch (err) {
      console.error('Login error:', err);
      error = err instanceof Error ? err.message : 'An error occurred during login';
      loading = false;
    }
  }
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</svelte:head>

<div class="login-container">
  <div class="background-image">
    <img src={unsplashImage} alt="Login background" />
    <div class="image-overlay">
      <div class="overlay-content">
        <br><br> <br><br> <br><br> <br><br> <br><br> <br><br> <br><br> <br><br>
        <h2>Medlemsinloggning</h2>
        <p>Logga in för att boka bastutid</p>
      </div>
    </div>
  </div>
  
  <div class="login-form-side">
    <div class="login-form-wrapper">
      <h1 class="login-title">Logga in
      <p class="login-subtitle"></p>

      <form on:submit|preventDefault={handleLogin} class="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="email" 
            id="email" 
            bind:value={email} 
            required 
            class="form-control"
            placeholder="skriv email"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Lösenord</label>
          <input 
            type="password" 
            id="password" 
            bind:value={password} 
            required 
            class="form-control"
            placeholder="Skriv lösenord"
          />
        </div>
        
        {#if error}
          <div class="error-message">
            {error}
          </div>
        {/if}
        
        {#if successMessage}
          <div class="success-message">
            {successMessage}
          </div>
        {/if}
        
        <button type="submit" class="login-button" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      
      <div class="login-footer">
        
        <p><a href="/reset-password">Glömt löseord?</a></p>
      </div>
    </div>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 0;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 10;
  }
  
  .background-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }
  
  .background-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to left, rgba(0, 0, 0, 0.85) 40%, rgba(0, 0, 0, 0.4));
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 10%;
  }
  
  .overlay-content {
    color: white;
    max-width: 500px;
    text-align: left;
  }
  
  .overlay-content h2 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .overlay-content p {
    font-size: 1.25rem;
    opacity: 0.9;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  
  .login-form-side {
    width: 40%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    color: #e0e0e0;
    position: relative;
    z-index: 2;
    margin-left: auto;
  }
  
  .login-form-wrapper {
    width: 100%;
    max-width: 360px;
    padding: 1.75rem;
    background-color: rgba(18, 18, 18, 0.75);
    backdrop-filter: blur(8px);
    border-radius: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .login-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 0.25rem;
    text-align: center;
  }
  
  .login-subtitle {
    color: #a0a0a0;
    margin-bottom: 1.5rem;
    text-align: center;
    font-size: 0.9rem;
  }
  
  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
  }
  
  .form-group label {
    font-weight: 500;
    color: #d0d0d0;
    font-size: 0.9rem;
  }
  
  .form-control {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #333;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s ease;
    background-color: #1e1e1e;
    color: #ffffff;
    box-sizing: border-box;
  }
  
  .form-control:focus {
    border-color: #4f46e5;
    outline: none;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3);
    background-color: #2a2a2a;
  }
  
  .form-control::placeholder {
    color: #666;
  }
  
  .error-message {
    background-color: rgba(220, 38, 38, 0.2);
    color: #ef4444;
    padding: 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid rgba(220, 38, 38, 0.3);
  }
  
  .success-message {
    background-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    padding: 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  
  .login-button {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: #4f46e5;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  
  .login-button:hover {
    background-color: #4338ca;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }
  
  .login-button:disabled {
    background-color: #3f3f46;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  .login-footer {
    text-align: center;
    color: #a0a0a0;
    font-size: 0.85rem;
    line-height: 1.5;
    margin-top: 0.5rem;
  }
  
  .login-footer a {
    color: #6366f1;
    text-decoration: none;
    font-weight: 500;
  }
  
  .login-footer a:hover {
    text-decoration: underline;
    color: #818cf8;
  }
  
  /* Enhanced responsive design for mobile devices */
  @media (max-width: 768px) {
    .login-form-side {
      width: 100%;
      padding: 1rem;
      margin: 0;
      min-height: 100%;
      justify-content: center;
    }
    
    .login-form-wrapper {
      background-color: rgba(18, 18, 18, 0.9);
      max-width: 100%;
      margin: 0 auto;
      padding: 1.5rem;
      border-radius: 0.75rem;
    }
    
    .overlay-content {
      display: none;
    }

    .login-title {
      font-size: 1.5rem;
    }

    .login-subtitle {
      font-size: 0.85rem;
    }

    .form-control {
      padding: 0.875rem;
      font-size: 1rem;
      min-height: 44px; /* Better touch target */
    }

    .login-button {
      padding: 0.875rem;
      min-height: 44px;
      font-size: 1rem;
    }

    .form-group label {
      font-size: 0.95rem;
    }

    .login-footer {
      font-size: 0.9rem;
      padding: 0.5rem 0;
    }

    .login-footer a {
      padding: 0.25rem 0;
      display: inline-block;
    }
  }

  /* Additional styles for very small screens */
  @media (max-width: 360px) {
    .login-form-wrapper {
      padding: 1.25rem;
    }

    .login-title {
      font-size: 1.35rem;
    }

    .form-group {
      gap: 0.25rem;
    }
  }

  /* Fix for landscape mode */
  @media (max-height: 600px) and (orientation: landscape) {
    .login-container {
      min-height: 100%;
      position: relative;
    }

    .login-form-wrapper {
      margin: 1rem auto;
    }

    .form-group {
      gap: 0.25rem;
    }

    .login-form {
      gap: 1rem;
    }
  }
</style>
