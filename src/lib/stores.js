// src/lib/stores.js
import { writable, get } from 'svelte/store';
import { supabase } from '$lib/services/system/supabase';

function createSessionStore() {
  const { subscribe, set, update } = writable(null);
  let sessionCheckInterval = null;
  let lastActivityTime = Date.now();
  
  // Check if session is expired based on access token expiry
  function isSessionExpired(session) {
    if (!session?.access_token) return true;
    
    try {
      // Parse JWT token to get expiry time
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      // Consider session expired if it expires within the next 5 minutes
      return currentTime >= (expiryTime - 5 * 60 * 1000);
    } catch (error) {
      console.error('Error parsing session token:', error);
      return true;
    }
  }
  
  // Clear session and cleanup
  function clearSession() {
    console.log('Clearing expired session');
    set(null);
    
    // Clear cookies
    if (typeof document !== 'undefined') {
      document.cookie = 'sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie = 'sb-refresh-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie = 'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
    
    // Clear local storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    
    // Clear session storage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  }
  
  // Start periodic session health check
  function startSessionHealthCheck() {
    if (sessionCheckInterval) return;
    
    sessionCheckInterval = setInterval(async () => {
      const currentSession = get({ subscribe });
      
      if (!currentSession) {
        // No session, clear interval
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
        return;
      }
      
      // Check if session is expired
      if (isSessionExpired(currentSession)) {
        console.log('Session expired, clearing...');
        clearSession();
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
        return;
      }
      
      // Check for inactivity (30 minutes)
      const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
      if (Date.now() - lastActivityTime > inactivityThreshold) {
        console.log('Session inactive for too long, clearing...');
        clearSession();
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
        return;
      }
      
      // Try to refresh session periodically (every 10 minutes)
      try {
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (!newSession || isSessionExpired(newSession)) {
          console.log('Session refresh failed or expired');
          clearSession();
          clearInterval(sessionCheckInterval);
          sessionCheckInterval = null;
        }
      } catch (error) {
        console.error('Session health check failed:', error);
        clearSession();
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
      }
    }, 60000); // Check every minute
  }
  
  // Stop session health check
  function stopSessionHealthCheck() {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
  }
  
  // Update last activity time
  function updateActivity() {
    lastActivityTime = Date.now();
  }
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      if (value) {
        updateActivity();
        startSessionHealthCheck();
      } else {
        stopSessionHealthCheck();
      }
    },
    update: (updater) => {
      update(updater);
      updateActivity();
    },
    refresh: async () => {
      try {
        updateActivity();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user || isSessionExpired(session)) {
          clearSession();
          return null;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        // Get CSRF token from cookie
        const csrfToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrf-token='))
          ?.split('=')[1];

        const mergedSession = {
          ...session,
          user: {
            ...session.user,
            role: profile?.role || 'free',
            privilege_role: profile?.privilege_role || 'user',
            username: profile?.username || null,
            custom_roles: profile?.custom_roles || {},
            subscription_status: profile?.subscription_status,
            subscription_id: profile?.subscription_id
          },
          csrf_token: csrfToken
        };

        set(mergedSession);
        return mergedSession;
      } catch (error) {
        console.error('Session refresh failed:', error);
        clearSession();
        return null;
      }
    },
    isExpired: () => {
      const currentSession = get({ subscribe });
      return !currentSession || isSessionExpired(currentSession);
    },
    updateActivity,
    clearSession
  };
}

function createSubscriptionStore() {
  const { subscribe, set, update } = writable({
    data: null,
    currentPriceId: null,
    subscription_id: null,
    subscription_status: null,
    role: null,
    products: [],
    productsLoading: false,
    error: null,
    lastFetch: 0
  });

  async function loadSubscriptionData() {
    update(s => ({ ...s, loading: true }));
    
    try {
      await session.refresh();
      const currentSession = get(session);
      
      if (!currentSession?.user?.id) {
        set({
          data: null,
          lastFetch: Date.now(),
          loading: false,
          error: null,
          products: [],
          currentPriceId: null,
          subscription_id: null,
          subscription_status: null,
          role: null
        });
        return null;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();

      if (profile?.subscription_id) {
        const response = await fetch(`/api/get-subscription?subscriptionId=${profile.subscription_id}`);
        if (!response.ok) throw new Error('Failed to fetch subscription');
        const { priceId } = await response.json();
        
        const subscriptionData = {
          role: profile.role,
          subscription_id: profile.subscription_id,
          currentPriceId: priceId,
          subscription_status: profile.subscription_status
        };

        // Update both store and session
        set({
          data: subscriptionData,
          lastFetch: Date.now(),
          loading: false,
          error: null,
          ...subscriptionData
        });

        session.update(current => ({
          ...current,
          user: {
            ...current.user,
            ...subscriptionData
          }
        }));
        
        return subscriptionData;
      }
      
      // Reset if no subscription
      const resetData = {
        data: null,
        lastFetch: Date.now(),
        loading: false,
        error: null,
        currentPriceId: null,
        subscription_id: null,
        subscription_status: null,
        role: 'free'
      };
      
      set(resetData);
      
      // Update session with free role
      session.update(current => ({
        ...current,
        user: {
          ...current.user,
          role: 'free'
        }
      }));
      
      return null;
    } catch (error) {
      console.error('Subscription data load error:', error);
      set({
        data: null,
        lastFetch: 0,
        loading: false,
        error: error.message,
        products: [],
        currentPriceId: null,
        subscription_id: null,
        subscription_status: null,
        role: null
      });
      throw error;
    }
  }

  return {
    subscribe,
    setInitialState: (state) => {
      update(store => ({ ...store, ...state }));
      // Also update session
      session.update(current => ({
        ...current,
        user: {
          ...current.user,
          ...state
        }
      }));
    },
    reset: () => {
      const resetData = {
        data: null,
        lastFetch: 0,
        loading: false,
        error: null,
        products: [],
        productsLoading: false,
        currentPriceId: null,
        subscription_id: null,
        subscription_status: null,
        role: 'free'
      };
      set(resetData);
      // Update session with free role
      session.update(current => ({
        ...current,
        user: {
          ...current.user,
          role: 'free'
        }
      }));
    },
    loadSubscriptionData,
    fetchProducts: async () => {
      update(s => ({ ...s, productsLoading: true }));
      try {
        const response = await fetch('/api/subscription-products');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch products');
        
        update(s => ({
          ...s,
          products: data.products,
          productsLoading: false
        }));
      } catch (error) {
        update(s => ({
          ...s,
          error: error.message,
          productsLoading: false
        }));
      }
    }
  };
}

export const session = createSessionStore();
export const subscriptionStore = createSubscriptionStore();

export const debugStore = writable([]);

export function addDebugLog(log) {
  debugStore.update(logs => [...logs, {
    timestamp: new Date().toISOString(),
    content: log
  }]);
}