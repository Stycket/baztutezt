const ipRequests = new Map();
const userRequests = new Map();
const endpointRequests = new Map();

// List of exempt user IDs who bypass rate limiting
// Add the user ID from the error logs
const exemptUsers = [
  '27d37f8e-5380-47eb-bb34-5ca8a93e04b2'  // User who needs rate limit exemption
];

// Clear old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of ipRequests.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      ipRequests.delete(key);
    }
  }
  for (const [key, data] of userRequests.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      userRequests.delete(key);
    }
  }
  for (const [key, data] of endpointRequests.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      endpointRequests.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function ipRateLimiter(ip, limit = 60, windowMs = 60000) {
  const now = Date.now();
  const record = ipRequests.get(ip) || { count: 0, timestamp: now };
  
  // Reset if window has passed
  if (now - record.timestamp > windowMs) {
    record.count = 0;
    record.timestamp = now;
  }
  
  record.count += 1;
  ipRequests.set(ip, record);
  
  return record.count > limit;
}

export function userRateLimiter(userId, limit = 100, windowMs = 60000) {
  if (!userId) return false;
  
  // Check if user is exempt from rate limiting
  if (exemptUsers.includes(userId)) {
    console.log(`Rate limit exemption applied for user: ${userId}`);
    return false; // Never rate limit exempt users
  }
  
  const now = Date.now();
  const record = userRequests.get(userId) || { count: 0, timestamp: now };
  
  if (now - record.timestamp > windowMs) {
    record.count = 0;
    record.timestamp = now;
  }
  
  record.count += 1;
  userRequests.set(userId, record);
  
  return record.count > limit;
}

export function endpointRateLimiter(endpoint, ip, limit = 30, windowMs = 60000) {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  const record = endpointRequests.get(key) || { count: 0, timestamp: now };
  
  if (now - record.timestamp > windowMs) {
    record.count = 0;
    record.timestamp = now;
  }
  
  record.count += 1;
  endpointRequests.set(key, record);
  
  return record.count > limit;
}