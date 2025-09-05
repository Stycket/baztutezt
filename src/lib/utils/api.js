import { get } from 'svelte/store';
import { session } from '$lib/stores';

/**
 * Enhanced fetch function that automatically adds CSRF token and validates session
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function api(url, options = {}) {
  const currentSession = get(session);
  
  // Check if session is expired before making the request
  if (currentSession && session.isExpired()) {
    console.log('Session expired, clearing session before API call');
    session.clearSession();
    throw new Error('Session expired. Please log in again.');
  }
  
  // Update activity timestamp
  if (currentSession) {
    session.updateActivity();
  }
  
  // Set up headers with default method
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Add CSRF token if available and this is a state-changing request
  if (currentSession?.csrf_token && 
      (method === 'POST' || 
       method === 'PUT' || 
       method === 'DELETE' || 
       method === 'PATCH')) {
    headers['X-CSRF-Token'] = currentSession.csrf_token;
    console.log(`Adding CSRF token for ${url}:`, currentSession.csrf_token);
  }
  
  // Ensure URL starts with /api/
  const apiUrl = url.startsWith('/api/') 
    ? url 
    : `/api${url.startsWith('/') ? url : '/' + url}`;
  
  console.log(`API call to: ${apiUrl}`);
  
  try {
    // Make the request
    const response = await fetch(apiUrl, {
      ...options,
      method, // Ensure method is set
      headers,
      credentials: 'include' // Always include credentials
    });
    
    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      console.log('Authentication error received, clearing session');
      session.clearSession();
      
      // Try to redirect to login page if we're not already there
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    
    // If it's a network error and we have a session, it might be expired
    if (currentSession && (error.name === 'TypeError' || error.message.includes('fetch'))) {
      console.log('Network error with active session, checking if session is still valid');
      try {
        await session.refresh();
      } catch (refreshError) {
        console.log('Session refresh failed, clearing session');
        session.clearSession();
      }
    }
    
    throw error;
  }
}

// Add convenience methods
api.get = (url, options = {}) => api(url, { ...options, method: 'GET' });

api.post = (url, data, options = {}) => api(url, { 
  ...options, 
  method: 'POST',
  body: JSON.stringify(data)
});

api.put = (url, data, options = {}) => api(url, { 
  ...options, 
  method: 'PUT',
  body: JSON.stringify(data)
});

api.delete = (url, options = {}) => api(url, { ...options, method: 'DELETE' });

api.patch = (url, data, options = {}) => api(url, { 
  ...options, 
  method: 'PATCH',
  body: JSON.stringify(data)
});

// Add a method for form data submissions
api.form = (url, formData, options = {}) => {
  // Remove Content-Type for FormData, browser will set it with boundary
  const headers = { ...options.headers };
  delete headers['Content-Type'];
  
  return api(url, {
    ...options,
    method: 'POST',
    headers,
    body: formData
  });
}; 