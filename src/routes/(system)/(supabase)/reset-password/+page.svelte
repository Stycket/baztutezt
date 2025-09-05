<script>
    import { supabase } from '$lib/services/system/supabase';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { session } from '$lib/stores';
  
    let email = '';
    let password = '';
    let confirmPassword = '';
    let loading = false;
    let error = null;
    let success = false;
    let isResetMode = false;
    
    // Using the same background image as login page for consistency
    const unsplashImage = "https://wallpapers.com/images/featured/white-gradient-background-o0tqqpgs66oz4rfr.jpg";
  
    onMount(async () => {
      if (!browser) return;
  
      try {
        // Check for password reset token or hash
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const type = params.get('type');
        
        console.log('Checking token:', { token, type, hash });
        
        // Check if we have a recovery token either in hash or query params
        if ((hash && hash.includes('type=recovery')) || (token && type === 'recovery')) {
          console.log('Found recovery token, enabling reset mode');
          isResetMode = true;
          
          // If we have a token in query params, verify it
          if (token && !$session?.user) {
            try {
              console.log('Verifying token...');
              const { data, error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'recovery'
              });
              
              if (verifyError) {
                console.error('Token verification error:', verifyError);
                error = 'Ogiltig eller utgången återställningslänk. Vänligen begär en ny.';
                isResetMode = false;
              } else {
                console.log('Token verified successfully');
              }
            } catch (err) {
              console.error('Token verification error:', err);
              error = 'Ett fel uppstod vid verifiering av återställningslänken. Vänligen försök igen.';
              isResetMode = false;
            }
          } else if ($session?.user) {
            console.log('User already logged in, skipping token verification');
          }
        } else if ($session?.user) {
          // If user is logged in but no recovery token, redirect to frontpage
          await goto('/frontpage');
        }
      } catch (err) {
        console.error('Error in onMount:', err);
        error = err.message || 'Ett okänt fel uppstod';
        loading = false;
      }
    });
  
    async function handleResetPassword() {
      try {
        loading = true;
        error = null;
        success = false;
        
        const resetUrl = 'https://grabobastu.se/reset-password';
        
        const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: resetUrl
        });
        
        if (resetError) throw resetError;
        
        success = true;
        email = '';
      } catch (err) {
        console.error('Password reset error:', err);
        error = err.message || 'Ett okänt fel uppstod';
      } finally {
        loading = false;
      }
    }
  
    async function handleUpdatePassword() {
      try {
        if (password !== confirmPassword) {
          error = 'Lösenorden matchar inte';
          return;
        }
  
        loading = true;
        error = null;
        
        const { data, error: updateError } = await supabase.auth.updateUser({
          password: password
        });
        
        if (updateError) throw updateError;
        
        success = true;
        // Clear sensitive data
        password = '';
        confirmPassword = '';
        
        // Redirect to frontpage after 2 seconds since user is already logged in
        setTimeout(() => {
          window.location.href = '/frontpage';
        }, 2000);
        
      } catch (err) {
        console.error('Password update error:', err);
        error = err.message || 'Ett okänt fel uppstod';
      } finally {
        loading = false;
      }
    }
  </script>
  
  <svelte:head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  </svelte:head>
  
  <div class="login-container">
    <div class="background-image">
      <img src={unsplashImage} alt="Reset password background" />
      <div class="image-overlay">
        <div class="overlay-content">
          <br><br> <br><br> <br><br> <br><br> <br><br> <br><br> <br><br> <br><br>
          <h2>Återställ lösenord</h2>
          <p>Få en länk för att återställa ditt lösenord</p>
        </div>
      </div>
    </div>
    
    <div class="login-form-side">
      <div class="login-form-wrapper">
        {#if !isResetMode}
          <h1 class="login-title">Återställ lösenord</h1>
          <p class="login-subtitle">Ange din e-post för att få en återställningslänk</p>
  
          <form on:submit|preventDefault={handleResetPassword} class="login-form">
            <div class="form-group">
              <label for="email">E-post</label>
              <input 
                type="email" 
                id="email" 
                bind:value={email} 
                required 
                class="form-control"
                placeholder="Ange din e-post"
              />
            </div>
            
            {#if error}
              <div class="error-message">
                {error}
              </div>
            {/if}
  
            {#if success}
              <div class="success-message">
                Återställningslänk har skickats till din e-post. Kontrollera din inkorg.
              </div>
            {/if}
            
            <button type="submit" class="login-button" disabled={loading}>
              {loading ? 'Skickar...' : 'Skicka återställningslänk'}
            </button>
          </form>
          
          <div class="login-footer">
            <p>Kommer du ihåg ditt lösenord? <a href="/login">Logga in</a></p>
          </div>
        {:else}
          <h1 class="login-title">Ange nytt lösenord</h1>
          <p class="login-subtitle">Välj ett nytt lösenord nedan</p>
  
          <form on:submit|preventDefault={handleUpdatePassword} class="login-form">
            <div class="form-group">
              <label for="password">Nytt lösenord</label>
              <input 
                type="password" 
                id="password" 
                bind:value={password} 
                required 
                class="form-control"
                placeholder="Ange nytt lösenord"
                minlength="6"
              />
            </div>
  
            <div class="form-group">
              <label for="confirmPassword">Bekräfta lösenord</label>
              <input 
                type="password" 
                id="confirmPassword" 
                bind:value={confirmPassword} 
                required 
                class="form-control"
                placeholder="Bekräfta nytt lösenord"
                minlength="6"
              />
            </div>
            
            {#if error}
              <div class="error-message">
                {error}
              </div>
            {/if}
  
            {#if success}
              <div class="success-message">
                Lösenordet har uppdaterats! Omdirigerar till inloggning...
              </div>
            {/if}
            
            <button type="submit" class="login-button" disabled={loading}>
              {loading ? 'Uppdaterar...' : 'Uppdatera lösenord'}
            </button>
          </form>
          
          <div class="login-footer">
            <p>Kommer du ihåg ditt lösenord? <a href="/login">Logga in</a></p>
          </div>
        {/if}
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
      background-color: rgba(16, 185, 129, 0.2);
      color: #10b981;
      padding: 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      border: 1px solid rgba(16, 185, 129, 0.3);
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
        min-height: 44px;
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
  