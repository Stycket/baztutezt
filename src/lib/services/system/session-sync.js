import { supabase } from './supabase';
import { session } from '$lib/stores';
import { browser } from '$app/environment';
import { configStore } from '$lib/stores/configStore';
import { get } from 'svelte/store';
import { api } from '$lib/utils/api';

/**
 * Synchronizes the session store with Supabase auth state
 */
export async function syncSession(forceFetch = false) {
  if (!browser) return null;
  
  try {
    console.log('Syncing session with Supabase');
    const { data: { session: authSession } } = await supabase.auth.getSession();
    
    if (!authSession) {
      console.log('No active session found in Supabase');
      session.set(null);
      return null;
    }
    
    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authSession.user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }
    
    // Get CSRF token from cookie
    let csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='))
      ?.split('=')[1];
    
    // If CSRF token is missing but we have a session, refresh it
    if ((!csrfToken || forceFetch) && authSession) {
      try {
        console.log('CSRF token missing or refresh forced, fetching new token...');
        const response = await fetch('/api/auth/refresh-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          csrfToken = data.csrf_token;
          console.log('New CSRF token obtained:', csrfToken ? 'Yes' : 'No');
          
          // Add a small delay to ensure cookie is set
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Log all cookies for debugging
          console.log('All cookies after refresh:', document.cookie);
          
          // Try to read from cookie again as a fallback
          if (!csrfToken) {
            csrfToken = document.cookie
              .split('; ')
              .find(row => row.startsWith('csrf-token='))
              ?.split('=')[1];
            
            console.log('Retrieved CSRF token from cookie after refresh:', !!csrfToken);
          }
        } else {
          console.error('Failed to refresh CSRF token:', await response.text());
        }
      } catch (err) {
        console.error('Error refreshing CSRF token:', err);
      }
    }
    
    // Merge auth session with profile data
    const mergedSession = {
      ...authSession,
      user: {
        ...authSession.user,
        role: profile?.role || 'free',
        privilege_role: profile?.privilege_role || 'user',
        username: profile?.username || null,
        custom_roles: profile?.custom_roles || {},
        subscription_status: profile?.subscription_status,
        subscription_id: profile?.subscription_id
      },
      csrf_token: csrfToken
    };
    
    console.log('Session synced successfully:', mergedSession.user.email, 
                'CSRF token present:', !!mergedSession.csrf_token);
    session.set(mergedSession);
    return mergedSession;
  } catch (error) {
    console.error('Error syncing session:', error);
    session.set(null);
    return null;
  }
}

export async function syncCookiesWithServer() {
  try {
    console.log('Syncing cookies with server');
    
    // Gör ett anrop till en endpoint som bara kontrollerar sessionen
    const response = await fetch('/api/check-session', {
      method: 'GET',
      credentials: 'include' // Viktigt för att skicka cookies
    });
    
    if (!response.ok) {
      console.error('Failed to sync cookies with server:', response.status);
      return false;
    }
    
    const result = await response.json();
    console.log('Cookie sync result:', result);
    return result.authenticated;
  } catch (err) {
    console.error('Error syncing cookies with server:', err);
    return false;
  }
}

/**
 * Ensures the client session is set correctly from cookies
 */
export async function ensureClientSession() {
  if (!browser) return null;
  
  try {
    console.log('Ensuring client session is set correctly');
    
    // Wait for config to be loaded
    if (!get(configStore).loaded) {
      await new Promise(resolve => {
        const unsubscribe = configStore.subscribe(config => {
          if (config.loaded) {
            unsubscribe();
            resolve();
          }
        });
      });
    }
    
    const { data: { session: authSession } } = await supabase.auth.getSession();
    
    if (!authSession) {
      console.log('No tokens found in cookies');
      session.set(null);
      return null;
    }
    
    console.log('Found tokens in cookies, setting session');
    
    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authSession.user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }
    
    // Merge auth session with profile data
    const mergedSession = {
      ...authSession,
      user: {
        ...authSession.user,
        role: profile?.role || 'free',
        privilege_role: profile?.privilege_role || 'user',
        username: profile?.username || null,
        custom_roles: profile?.custom_roles || {},
        subscription_status: profile?.subscription_status,
        subscription_id: profile?.subscription_id
      }
    };
    
    console.log('Session set successfully on client');
    session.set(mergedSession);
    return mergedSession;
  } catch (error) {
    console.error('Error ensuring client session:', error);
    session.set(null);
    return null;
  }
}
