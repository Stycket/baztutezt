import { json } from '@sveltejs/kit';
import { generateCsrfToken } from '$lib/server/csrf';

export async function POST(event) {
  const session = event.locals.session;
  
  if (!session?.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  // Generate a new CSRF token
  const csrfToken = generateCsrfToken();
  
  // Set CSRF cookie - make it accessible to JavaScript
  event.cookies.set('csrf-token', csrfToken, {
    path: '/',
    httpOnly: false, // Allow JavaScript access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Less strict for development
    maxAge: 60 * 60 * 24 // 24 hours
  });
  
  return json({ success: true, csrf_token: csrfToken });
}
