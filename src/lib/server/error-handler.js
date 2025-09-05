import crypto from 'crypto';

// Define error severity levels
export const ErrorSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

export function logError(context, error, additionalInfo = {}, severity = ErrorSeverity.ERROR) {
    const timestamp = new Date().toISOString();
    const errorId = crypto.randomUUID();
    
    console.error(`❌ [${timestamp}] [${errorId}] Error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      severity,
      ...additionalInfo
    });
    
    return errorId;
  }