<script context="module">
  import { writable } from 'svelte/store';
  
  // Create a basic config store
  export const appConfig = writable({
    ROLE_SETTINGS: {
      PRIVILEGE_ROLES: {}
    }
  });
</script>

<script>
  import { session } from '$lib/stores';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/services/system/supabase';
  import { goto } from '$app/navigation';
  import { slide } from 'svelte/transition';
  import '../app.css';
  import { PUBLIC_CONFIG } from '$lib/constants';
  import { configStore, loadConfig } from '$lib/stores/configStore';
  import { fade } from 'svelte/transition';
  import { browser } from '$app/environment';
  import DebugTerminal from '$lib/components/system/DebugTerminal.svelte';
  import { addDebugLog } from '$lib/stores';
  import { syncSession, ensureClientSession } from '$lib/services/system/session-sync';
  import { api } from '$lib/utils/api';
  import { isFullscreenMode, showNavbar } from '$lib/stores/uiStore';

  // Add performance tracking
  const startTime = performance.now();
  
  let darkMode = false;
  let showProfileMenu = false;
  let loading = true;
  let error = null;
  let navbarLoaded = false;
  
  // Set configLoaded based on the store's loaded property
  $: configLoaded = $configStore.loaded;

  // Variables for mouse inactivity tracking
  let mouseInactivityTimer;
  let lastMouseMoveTime = Date.now();
  
  // Track fullscreen status from the store
  let isInFullscreenMode = false;
  isFullscreenMode.subscribe(value => {
    isInFullscreenMode = value;
    
    // When entering/exiting fullscreen, always show the navbar first
    if (browser) {
      $showNavbar = true;
      resetMouseInactivityTimer();
    }
  });
  
  function handleMouseMove() {
    if (!isInFullscreenMode) return;
    
    // Always show navbar on mouse movement
    $showNavbar = true;
    lastMouseMoveTime = Date.now();
    
    // Reset the inactivity timer
    resetMouseInactivityTimer();
  }
  
  function resetMouseInactivityTimer() {
    // Clear any existing timer
    if (mouseInactivityTimer) {
      clearTimeout(mouseInactivityTimer);
    }
    
    // Only set timer if in fullscreen mode
    if (isInFullscreenMode) {
      // Set timer to hide navbar after 10 seconds of inactivity
      mouseInactivityTimer = setTimeout(() => {
        $showNavbar = false;
      }, 10000);
    }
  }

  onMount(async () => {
    try {
      // Load configuration first
      if (browser) {
        await loadConfig();
        
        configStore.update(store => ({
          ...store,
          features: {
            ...store.features,
            loaded: true
          }
        }));
        
        // Then ensure session is set
        await ensureClientSession();
        
        if ($session?.user) {
          console.log('Found active session, syncing with store');
          await syncSession();
        }
        
        console.log('Basic session store updated from layout');
      }
      
      loading = false;
      
      // Performance logging
      const endTime = performance.now();
      console.log(`layout-mount: ${endTime - startTime} ms`);

      await loadUserData();
      await loadSocialConfig();

      // Check if CSRF token exists in cookie
      const hasCSRFToken = document.cookie
        .split('; ')
        .some(row => row.startsWith('csrf-token='));
      
      console.log('CSRF token present in cookie:', hasCSRFToken);
      
      // If no token but user is logged in, try to refresh
      if (!hasCSRFToken && $session?.user) {
        console.warn('Session exists but no CSRF token found. Refreshing session...');
        await syncSession(true);
      }
    } catch (err) {
      console.error('Error in layout mount:', err);
      error = err instanceof Error ? err.message : String(err);
      loading = false;
    }
  });

  onMount(() => {
    if (browser) {
      const savedTheme = localStorage.getItem('theme');
      darkMode = savedTheme === 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme || 'light');
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('mousemove', handleMouseMove);
      
      // Add activity tracking for session management
      const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
      const updateActivity = () => {
        if ($session) {
          session.updateActivity();
        }
      };
      
      activityEvents.forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
      });
      
      // Clean up event listeners on destroy
      onDestroy(() => {
        activityEvents.forEach(event => {
          document.removeEventListener(event, updateActivity);
        });
      });
    }
  });

  function toggleTheme() {
    if (browser) {
      darkMode = !darkMode;
      const theme = darkMode ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }

  async function handleSignOut() {
    try {
      loading = true;
      showProfileMenu = false;

      // 1. First clear all stores
      session.set(null);
      configStore.update(store => ({
        ...store,
        user: null
      }));

      // 2. Clear all storage
      if (browser) {
        localStorage.clear();
        sessionStorage.clear();
      }

      // 3. Clear all cookies with all possible combinations
      const domains = [
        window.location.hostname,
        `.${window.location.hostname}`,
        ''  // Also try without domain
      ];
      
      const paths = ['/', '/api', ''];
      
      const cookiesToClear = [
        'sb-access-token',
        'sb-refresh-token',
        'csrf-token',
        'supabase-auth-token'  // Add this if it exists
      ];

      cookiesToClear.forEach(cookieName => {
        domains.forEach(domain => {
          paths.forEach(path => {
            // Clear with all combinations of attributes
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ''}`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ''}; secure`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ''}; secure; samesite=lax`;
          });
        });
      });

      // 4. Sign out from Supabase (this should trigger the onAuthStateChange hook)
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // 5. Force a full page reload to clear any remaining state
      window.location.href = '/';
      return;
      
    } catch (err) {
      console.error('Sign out error:', err);
      // If error occurs, still try to force reload
      window.location.href = '/';
    } finally {
      loading = false;
    }
  }

  function toggleProfileMenu() {
    showProfileMenu = !showProfileMenu;
  }

  // Close menu when clicking outside
  function handleClickOutside(event) {
    const profileButton = event.target.closest('.profile-button');
    const profileMenu = event.target.closest('.profile-menu');
    
    if (!profileButton && !profileMenu) {
      showProfileMenu = false;
    }
  }

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);
    }
  });

  // Add debug logging for session changes
  $: {
    if ($session) {
      addDebugLog({
        type: 'session_state',
        message: 'Session state changed',
        data: {
          user: $session.user,
          privilege_role: $session?.user?.privilege_role
        }
      });
    }
  }

  // Add debug logging before admin menu check
  $: showAdminMenu = $session?.user?.privilege_role === 'admin' || $session?.user?.privilege_role === 'moderator';
  $: {
    addDebugLog({
      type: 'admin_menu_check',
      message: 'Checking admin menu visibility',
      data: {
        showAdminMenu,
        privilege_role: $session?.user?.privilege_role
      }
    });
  }

  async function loadUserData() {
    try {
      await session.refresh();
      
      if (!$session?.user?.id) {
        console.warn('No user ID found after session refresh');
        return;
      }

      // Corrected query
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', $session.user.id)
        .single();
      
      if (profileError) {
        console.error('Profile fetch error:', profileError);
        return;
      }

      // Update session with fresh data
      session.update(current => ({
        ...current,
        user: {
          ...current.user,
          role: profile.role || 'free',
          privilege_role: profile?.privilege_role || 'user',
          custom_roles: profile?.custom_roles || {}
        }
      }));
      
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }

  // Add the handler function
  async function handleLogoClick() {
    if ($session?.user) {
      await goto('/frontpage');
    } else {
      await goto('/');
    }
  }

  async function loadSocialConfig() {
    try {
      const socialConfigResponse = await fetch('/api/get-social-config');
      
      if (socialConfigResponse.ok) {
        const { socialConfig } = await socialConfigResponse.json();
        
        // Update configStore with server settings
        configStore.update(store => ({
          ...store,
          features: {
            ...store.features,
            social: {
              enabled: socialConfig.enabled,
              comments: {
                enabled: socialConfig.comments.enabled,
                threaded: socialConfig.comments.threaded,
                maxNesting: socialConfig.comments.maxNesting,
                moderation: socialConfig.comments.moderation
              }
            }
          }
        }));
        
        console.log('Social config loaded:', socialConfig);
      }
    } catch (err) {
      console.error('Error loading social config:', err);
    }
  }

  // Add a function to handle dashboard navigation
  async function handleDashboardClick(event) {
    event.preventDefault();
    
    try {
      if ($session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', $session.user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        const userRole = data?.role || 'free';
        await goto(`/content/${userRole}`);
      } else {
        await goto('/content/free');
      }
    } catch (err) {
      console.error('Error navigating to dashboard:', err);
      await goto('/content');
    }
  }

  // Instead of completely hiding the navbar, we'll keep it in a minimized state with just the logo
  $: navbarState = isInFullscreenMode 
    ? ($showNavbar ? 'full' : 'minimized')
    : 'full';
</script>

<div class="app-container">
  <nav class="navbar fixed top-0 left-0 right-0 z-50" class:navbar-minimized={navbarState === 'minimized'}>
    <div class="nav-container">
      <div class="nav-brand" on:click={handleLogoClick}>
        <img 
          src="https://cdn.prod.website-files.com/64f62918453bf2fd6d2829c1/654c4935824c04859c5d0998_bastulogo.png" 
          alt="AuraVibeZ Logo" 
          class="logo-image"
        /> 
      </div>
      
      <div class="nav-links" class:nav-links-hidden={navbarState === 'minimized'}>
        {#if $session?.user}
          <a href="/bookingsystem" class="nav-link">Bokning</a>
          <a href="/forening" class="nav-link">Förening</a>
        {:else}
          <a href="/login" class="nav-link">Logga in</a>
          <a href="/forening" class="nav-link">Förening</a>
        {/if}
        
        <button
          on:click={toggleTheme}
          class="theme-toggle"
          aria-label="Toggle theme"
        >
          {#if darkMode}
            🌞
          {:else}
            🌙
          {/if}
        </button>

        {#if $session?.user}
          <div class="relative profile-container">
            <button 
              class="profile-button"
              on:click|stopPropagation={toggleProfileMenu}
            >
              <span class="text-xs">👤</span>
            </button>

            {#if showProfileMenu}
              <div
                class="profile-menu"
                transition:slide={{ duration: 200 }}
              >
                <div class="profile-menu-header">
                  <div class="profile-menu-label">Inloggad</div>
                  <div class="profile-menu-email" title={$session.user.email}>
                    {$session.user.email}
                  </div>
                </div>
                <a href="/user" class="menu-item">
                  Profil
                </a>
                
                <!-- Admin Dashboard - only shown to admins -->
                {#if $session?.user?.privilege_role === 'admin'}
                  <a 
                    href="/admin" 
                    class="menu-item"
                    on:click|stopPropagation
                  >
                    Admin Dashboard
                  </a>
                {/if}
                
                <!-- Moderator Dashboard - shown to both admins and moderators -->
                {#if $session?.user?.privilege_role === 'admin' || $session?.user?.privilege_role === 'moderator'}
                  <a 
                    href="/appadmin" 
                    class="menu-item"
                    on:click|stopPropagation
                  >
                    Moderator Panel
                  </a>
                {/if}
                
                <button 
                  on:click={handleSignOut}
                  class="menu-item text-red-600 w-full text-left"
                  disabled={loading}
                >
                  {#if loading}
                    Loggar ut...
                  {:else}
                    Logga ut
                  {/if}
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </nav>

  <!--
<div class="relative">
   <DebugTerminal /> 
</div>
-->
  <main class="main-content">
    {#if !configLoaded && browser}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>Loading application...</p>
      </div>
    {:else}
      {#if $configStore.isLoading}
        <div class="loading-overlay">Loading application configuration...</div>
      {:else if $configStore.isError}
        <div class="error-overlay">
          <p>Error loading application configuration:</p>
          <p>{$configStore.error}</p>
        </div>
      {:else}
        <slot />
      {/if}
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    margin-top: 55px;
    padding: 0;
    box-sizing: border-box;
  }

  .navbar {
    height: 111px;
    background-color: rgba(14,14,14,0.42);
    border-bottom: 1px solid var(--border-color);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    width: 100%;
    transition: all 0.3s ease-in-out;
  }
  
  .navbar-minimized {
    background-color: rgba(14,14,14,0); /* Completely transparent */
    border-bottom-color: transparent;
    box-shadow: none; /* Remove any shadow */
  }

  .nav-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
    padding: 0;
    width: 98%;
    max-width: 1800px;
    margin: 0 auto;
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
    .navbar {
      height: 60px; /* Base height for navbar */
    }
    
    .logo-image {
      height: 55px; /* Nearly as tall as the navbar */
      max-height: 55px;
      width: auto;
      object-fit: contain;
      margin: 0;
    }
    
    .nav-brand {
      padding: 0;
      margin-right: 0.5rem;
      flex-shrink: 0;
      height: 100%;
      display: flex;
      align-items: center;
    }
    
    .nav-container {
      width: 98%;
      padding: 0 0.25rem;
      justify-content: space-between;
      align-items: center;
      height: 100%;
    }
    
    .nav-links {
      gap: 0.4rem;
      flex-grow: 1;
      justify-content: flex-end;
      align-items: center;
      height: 100%;
    }
    
    .nav-link, .theme-toggle {
      padding: 0.25rem;
      font-size: 0.75rem;
    }
    
    .profile-button {
      width: 26px;
      height: 26px;
      padding: 0.15rem;
      min-width: 26px;
    }
    
    .main-content {
      margin-top: 60px; /* Match navbar height */
    }
  }

  /* Additional breakpoint for medium small devices */
  @media (min-width: 481px) and (max-width: 767px) {
    .navbar {
      height: 75px;
    }
    
    .logo-image {
      height: 70px;
      max-height: 70px;
    }
    
    .main-content {
      margin-top: 75px;
    }
  }

  /* Desktop settings */
  @media (min-width: 768px) {
    .logo-image {
      height: 111px;
    }
  }

  .main-content {
    flex: 1;
    margin-top: 64px;
    position: relative;
    width: 100%;
    padding: 0;
    box-sizing: border-box;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: opacity 0.3s ease-in-out;
  }
  
  .nav-links-hidden {
    opacity: 0;
    pointer-events: none; /* Disable interactions with hidden links */
  }

  .nav-link {
    color: white;
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .nav-link:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .theme-toggle {
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .theme-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .profile-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    border-radius: 0.375rem;
    background-color: var(--card-bg, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    color: var(--text-color, #4b5563);
    transition: all 0.2s;
    width: 32px;
    height: 32px;
  }

  .profile-button:hover {
    background-color: var(--hover-bg, #f3f4f6);
    border-color: var(--primary-color, #3b82f6);
  }

  .profile-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.5rem);
    width: 16rem;
    background-color: var(--card-bg, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 50;
    overflow: hidden;
  }

  .profile-menu-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .profile-menu-label {
    font-size: 0.75rem;
    color: var(--text-muted, #6b7280);
  }

  .profile-menu-email {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-color, #1f2937);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-item {
    display: block;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--text-color, #1f2937);
    transition: background-color 0.2s;
    text-decoration: none;
  }

  .menu-item:hover {
    background-color: var(--hover-bg, #f3f4f6);
  }

  .cart-container {
    display: inline-block;
    position: relative;
  }

  .cart-notification {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 60;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #111827;
  }

  .notification-image {
    width: 32px;
    height: 32px;
    border-radius: 0.25rem;
    object-fit: cover;
    border: 1px solid #e5e7eb;
  }

  .cart-button {
    position: relative;
    transition: all 0.2s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: white;
    cursor: pointer;
  }

  .cart-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .cart-preview-wrapper {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 50;
  }

  .cart-count {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ef4444;
    color: white;
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    min-width: 18px;
    text-align: center;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
    z-index: 51; /* Higher z-index to ensure it's clickable */
  }

  .navbar-minimized .nav-brand {
    background-color: rgba(14,14,14,0.4); /* Slight background just for the logo */
    border-radius: 0.375rem;
  }

  .logo-image {
    height: auto;
    max-height: 70px;
    width: auto;
    object-fit: contain;
    border-bottom-left-radius: 9%;
  }

  @media (min-width: 768px) {
    .logo-image {
      max-height: 111px; /* Original size only on desktop */
    }
  }

  .loading-overlay, .error-overlay {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    z-index: 100;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: inline-block;
    }
    
    .nav-container {
      width: 90%;
      padding: 0 1rem;
    }
  }

  @media (min-width: 1200px) {
    .nav-container {
      width: 80%;
    }
  }
</style>