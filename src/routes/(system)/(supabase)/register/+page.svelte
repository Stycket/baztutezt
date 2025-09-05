<script>
  import { supabase } from '$lib/services/system/supabase';
  import { goto } from '$app/navigation';
  import { APP_CONFIG, PUBLIC_CONFIG } from '$lib/constants';
  import { api } from '$lib/utils/api';
  
  let email = '';
  let password = '';
  let confirmPassword = '';
  let username = '';
  let error = '';
  let loading = false;
  let successMessage = '';
  
  // Add fallback for USERNAME_SETTINGS if PUBLIC_CONFIG.FEATURES is undefined
  const USERNAME_SETTINGS = PUBLIC_CONFIG?.FEATURES?.USERNAME_SETTINGS || {
    ENABLED: true,
    REQUIRED: true,
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    ALLOWED_CHARACTERS: '^[a-zA-Z0-9_-]+$'
  };
  
  // Same unsplash image as login page
  const unsplashImage = "https://images.unsplash.com/photo-1738253145985-ade54be5786c?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  
  async function validateUsername(username) {
    if (!username && USERNAME_SETTINGS.REQUIRED) {
      throw new Error('Username is required');
    }

    if (username) {
      if (username.length < USERNAME_SETTINGS.MIN_LENGTH) {
        throw new Error(`Username must be at least ${USERNAME_SETTINGS.MIN_LENGTH} characters`);
      }
      
      if (username.length > USERNAME_SETTINGS.MAX_LENGTH) {
        throw new Error(`Username must be less than ${USERNAME_SETTINGS.MAX_LENGTH} characters`);
      }

      if (!new RegExp(USERNAME_SETTINGS.ALLOWED_CHARACTERS).test(username)) {
        throw new Error('Username can only contain letters, numbers, underscore and dash');
      }

      try {
        const { data, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (checkError) throw checkError;
        if (data) throw new Error('Username is already taken');
      } catch (error) {
        if (error.message === 'Username is already taken') throw error;
        throw new Error('Failed to check username availability');
      }
    }
  }

  const handleRegister = async () => {
    try {
      if (loading) return;
      loading = true;
      error = '';

      // Validate two words and format username
      if (username) {
        const words = username.trim().split(/\s+/);
        if (words.length !== 2) {
          throw new Error('Både för och efternamn');
        }
        username = words.join('-');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      if (USERNAME_SETTINGS.ENABLED) {
        await validateUsername(username);
      }

      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Sign up the user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            role: 'free',
            username: USERNAME_SETTINGS.ENABLED ? username : null
          }
        }
      });
      
      if (signUpError) {
        console.log('SignUp Error:', signUpError); // Debug log
        
        if (signUpError.status === 429) {
          throw new Error('Too many signup attempts. Please try again in a few minutes.');
        }
        
        // Check for specific email already registered error
        if (signUpError.message && (
          signUpError.message.includes('already registered') ||
          signUpError.message.includes('User already registered') ||
          signUpError.message.includes('email address is already registered') ||
          signUpError.message.includes('duplicate key value violates unique constraint') ||
          signUpError.message.includes('already exists') ||
          signUpError.message.includes('already been registered') ||
          signUpError.message.includes('email already exists')
        )) {
          throw new Error('Emailen är redan registrerad, du kan använda återställningslänken: https://grabobastu.se/reset-password');
        }
        
        throw signUpError;
      }

      // Check if user was actually created (not just existing user)
      if (data?.user && !data.user.email_confirmed_at) {
        // Show success message for new user
        successMessage = 'Du har fått ett e-postmeddelande! Kontrollera din inkorg för att aktivera ditt konto.';
        
        // Clear form
        email = '';
        password = '';
        confirmPassword = '';
        username = '';
      } else if (data?.user && data.user.email_confirmed_at) {
        // User already exists and is confirmed
        throw new Error('Emailen är redan registrerad, du kan använda återställningslänken: https://grabobastu.se/reset-password');
      } else {
        // No user data returned - something went wrong
        throw new Error('Registration failed. Please try again.');
      }

      // Try to create profiles in background (don't fail registration if this fails)
      if (data?.user) {
        try {
          // Sign in to create profiles
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (!signInError) {
            // Create profile with active session
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email,
                username: username || `user_${data.user.id.slice(0, 8)}`,
                role: 'free',
                privilege_role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (profileError) {
              console.error('Profile creation error:', profileError);
            }

            // Create public profile in local postgres
            const publicProfileResponse = await api('/profiles', {
              method: 'POST',
              body: JSON.stringify({
                user_id: data.user.id,
                username: username || `user_${data.user.id.slice(0, 8)}`,
                bio: ''
              })
            });

            if (!publicProfileResponse.ok) {
              const errorData = await publicProfileResponse.json();
              console.error('Public profile creation error:', errorData);
            }
          }
        } catch (profileError) {
          console.error('Background profile creation failed:', profileError);
          // Don't throw error - registration was successful
        }
      }
    } catch (err) {
      error = err.message || 'Registration failed. Please try again.';
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</svelte:head>

<div class="login-container">
  <div class="background-image">
    <img src={unsplashImage} alt="Register background" />
    <div class="image-overlay">
      <div class="overlay-content">
        <br><br> <br><br> <br><br> <br><br> <br><br> <br><br> <br><br> <br><br>
        <h2>Gråbo Bastuförening</h2>
        <p>Skapa ditt konto</p>
      </div>
    </div>
  </div>
  
  <div class="login-form-side">
    <div class="login-form-wrapper">
      <h1 class="login-title">Regristrera
      <p class="login-subtitle">Skapa konto för att boka</p>

      <form on:submit|preventDefault={handleRegister} class="login-form">
        {#if USERNAME_SETTINGS.ENABLED}
          <div class="form-group">
            <label for="username">Fullständigt namn</label>
            <input 
              type="text" 
              id="username" 
              bind:value={username} 
              required={USERNAME_SETTINGS.REQUIRED}
              class="form-control"
              placeholder="Fullständigt namn"
              title="Bekräfta Löseord"
            />
            <small class="text-gray-400 text-sm mt-1"></small>
          </div>
        {/if}
        
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="email" 
            id="email" 
            bind:value={email} 
            required 
            class="form-control"
            placeholder="Email"
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
            placeholder="Välj Lösenord"
          />
        </div>
        
        <div class="form-group">
          <label for="confirm-password">Bekräfta Lösenord</label>
          <input 
            type="password" 
            id="confirm-password" 
            bind:value={confirmPassword} 
            required 
            class="form-control"
            placeholder="Bekräfta Löseord"
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
          {loading ? 'Creating Account...' : 'Regristrera och få e-mail'}
        </button>
      </form>
      
      <div class="login-footer">
        <p>Har  du redan skapat konto? <a href="/login">Logga In</a></p>
      </div>
    </div>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    min-height: 100vh;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    position: relative;
    margin-top: -111px; /* Offset for navbar height */
    padding-top: 111px; /* Add padding for navbar */
  }
  
  .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
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
    .login-container {
      margin-top: -60px; /* Adjust for mobile navbar height */
      padding-top: 60px;
      min-height: 100vh;
    }

    .login-form-side {
      width: 100%;
      padding: 1rem;
      margin: 0;
      min-height: 100%;
      justify-content: flex-start;
      padding-top: 1rem;
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
  }

  /* Additional breakpoint for medium small devices */
  @media (min-width: 481px) and (max-width: 767px) {
    .login-container {
      margin-top: -75px; /* Adjust for medium mobile navbar height */
      padding-top: 75px;
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

    .form-control {
      font-size: 0.95rem;
    }
  }

  /* Fix for landscape mode */
  @media (max-height: 600px) and (orientation: landscape) {
    .login-container {
      min-height: 100%;
      position: relative;
      overflow-y: auto;
    }

    .login-form-wrapper {
      margin: 1rem auto;
    }

    .form-group {
      gap: 0.25rem;
    }

    .login-form {
      gap: 0.75rem;
    }
  }

  /* Fix for iPhone 5/SE and other very small devices */
  @media (max-height: 568px) {
    .login-container {
      overflow-y: auto;
      position: relative;
    }
    
    .login-form-wrapper {
      margin: 1rem auto;
    }
  }
</style>
