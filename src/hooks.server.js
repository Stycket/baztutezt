// src/hooks.server.js
import { supabase } from '$lib/services/system/supabase';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { redirect } from '@sveltejs/kit';
import { initializeDatabase } from '$lib/server/db';
import { createSupabaseServerClient } from '@supabase/auth-helpers-sveltekit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { ipRateLimiter, endpointRateLimiter } from '$lib/server/rate-limiter';
import { json } from '@sveltejs/kit';
import { validateCsrfToken, generateCsrfToken } from '$lib/server/csrf';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // Initialize database with proper error handling
  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    // Only throw for API routes that require database access
    if (event.url.pathname.startsWith('/api/')) {
      return json({ error: 'Database initialization failed' }, { status: 503 });
    }
  }

  console.log('Hooks - Request URL:', event.url.pathname);

  // Get session from cookie
  const accessToken = event.cookies.get('sb-access-token');
  const refreshToken = event.cookies.get('sb-refresh-token');

  console.log('Auth status:', { 
    hasAccessToken: !!accessToken, 
    hasRefreshToken: !!refreshToken,
    path: event.url.pathname
  });

  let session = null;

  // Optimera sessionshantering
  if (accessToken && refreshToken) {
    try {
      // Använd en timeout för att undvika att vänta för länge på Supabase
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session fetch timeout')), 2000)
      );
      
      const sessionPromise = supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      await Promise.race([sessionPromise, timeoutPromise]);

      // Get current session
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (currentSession?.user) {
        session = currentSession;
        
        // Hämta bara grundläggande profildata för sessionen
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, privilege_role')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          session.user = {
            ...session.user,
            role: profile.role || 'free',
            privilege_role: profile.privilege_role || 'user'
          };
        }
        
        // Add CSRF token to session if not present
        if (!session.csrf_token) {
          session.csrf_token = generateCsrfToken();
          // Set CSRF cookie (HttpOnly for security)
          event.cookies.set('csrf-token', session.csrf_token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 // 24 hours
          });
        }
      }
    } catch (err) {
      console.error('Session error:', err);
      // Clear invalid cookies
      event.cookies.delete('sb-access-token');
      event.cookies.delete('sb-refresh-token');
      event.cookies.delete('csrf-token');
    }
  }

  event.locals.session = session;
  
  // CSRF protection for state-changing requests
  if (event.request.method !== 'GET' && 
      event.request.method !== 'HEAD' && 
      event.request.method !== 'OPTIONS' &&
      event.url.pathname.startsWith('/api/')) {
    
    // Skip CSRF check for authentication endpoints and refresh endpoint
    if (!event.url.pathname.includes('/auth/signin') && 
        !event.url.pathname.includes('/auth/signup') &&
        !event.url.pathname.includes('/auth/reset-password') &&
        !event.url.pathname.includes('/auth/refresh-session')) {
      
      const token = event.request.headers.get('x-csrf-token');
      
      if (!session?.csrf_token) {
        console.error('CSRF check failed: No session token available');
        return json({ error: 'Session expired or invalid' }, { status: 403 });
      }
      
      if (!token) {
        console.error('CSRF check failed: Missing token header for:', event.url.pathname);
        return json({ error: 'Missing CSRF token' }, { status: 403 });
      }
      
      const validationResult = validateCsrfToken(event.request, session);
      
      if (!validationResult.valid) {
        console.error('CSRF validation failed for:', event.url.pathname, 'Token:', token);
        return json({ error: 'Invalid CSRF token' }, { status: 403 });
      }
      
      // If token is valid but aging, set a header to trigger refresh on client
      if (validationResult.needsRefresh) {
        event.locals.refreshCsrf = true;
      }
    }
  }

  // Admin route protection
  if (event.url.pathname.startsWith('/admin')) {
    console.log('Admin check - Session:', session);
    
    if (!session?.user) {
      throw redirect(303, '/login');
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('privilege_role')
      .eq('id', session.user.id)
      .single();

    console.log('Admin check - Profile:', profile);

    if (!profile || (profile.privilege_role !== 'admin' && profile.privilege_role !== 'moderator')) {
      throw redirect(303, '/');
    }
  }
  
  // Continue with the request
  const response = await resolve(event);
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Add Content Security Policy
  const isDev = process.env.NODE_ENV !== 'production';

  // Allow all image sources in both development and production
  const imgSrc = "'self' data: blob: *";

  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.stripe.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    `img-src ${imgSrc}; ` +
    "font-src 'self'; " +
    "connect-src 'self' https://*.supabase.co; " +
    "frame-src https://js.stripe.com; " +
    "object-src 'none';"
  );
  
  // Add CSRF refresh header if needed
  if (event.locals.refreshCsrf) {
    response.headers.set('X-Refresh-CSRF', 'true');
  }
  
  return response;
}

// Add global error handler
export function handleError({ error, event }) {
  const errorId = crypto.randomUUID();
  
  console.error(`[${errorId}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: event.url.pathname,
    method: event.request.method,
    userId: event.locals.session?.user?.id
  });
  
  // Return sanitized error for production
  return {
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
    errorId: errorId
  };
}

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

