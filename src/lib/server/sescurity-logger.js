import crypto from 'crypto';

export function logSecurityEvent(eventType, details, userId = null) {
  const timestamp = new Date().toISOString();
  const eventId = crypto.randomUUID();
  
  console.log(`🔒 [${timestamp}] [${eventId}] Security event: ${eventType}`, {
    userId,
    ...details
  });
  
  // Här kan du även spara till databas eller skicka till extern loggningslösning
}