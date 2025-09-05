import crypto from 'crypto';

// Generate a CSRF token with timestamp
export function generateCsrfToken() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac('sha256', process.env.APP_SECRET || 'fallback-secret')
    .update(randomBytes + timestamp)
    .digest('hex');
  
  return `${randomBytes}.${timestamp}.${signature}`;
}

// Validate a CSRF token
export function validateCsrfToken(request, session) {
  const token = request.headers.get('x-csrf-token');
  const storedToken = session?.csrf_token;
  
  if (!token || !storedToken) {
    console.log('CSRF validation failed: Missing token or stored token');
    return { valid: false };
  }
  
  // First try basic equality check
  if (token === storedToken) {
    // Try to extract timestamp from token to check age
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const timestamp = parseInt(parts[1], 10);
        const tokenAge = Date.now() - timestamp;
        return { 
          valid: true, 
          tokenAge,
          needsRefresh: tokenAge > 3000000 // 50 minutes (out of 60)
        };
      }
      return { valid: true };
    } catch (e) {
      return { valid: true };
    }
  }
  
  // If that fails, try to parse token parts (for backward compatibility)
  try {
    const parts = token.split('.');
    
    // If we don't have exactly 3 parts, validation fails
    if (parts.length !== 3) {
      console.log('CSRF validation failed: Invalid token format');
      return { valid: false };
    }
    
    const [randomBytes, timestamp, signature] = parts;
    
    // Check if token is expired (1 hour validity)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 3600000) { // 1 hour in milliseconds
      console.log('CSRF validation failed: Token expired');
      return { valid: false };
    }
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', process.env.APP_SECRET || 'fallback-secret')
      .update(randomBytes + timestamp)
      .digest('hex');
    
    const valid = signature === expectedSignature;
    return { 
      valid, 
      tokenAge,
      needsRefresh: tokenAge > 3000000 // 50 minutes (out of 60)
    };
  } catch (error) {
    console.error('CSRF validation error:', error);
    return { valid: false };
  }
} 