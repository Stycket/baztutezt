import DOMPurify from 'dompurify';

/**
 * Validates post content
 * @param {Object} post - The post object to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validatePostContent(post) {
  const errors = [];
  
  // Check required fields
  if (!post.title || post.title.trim() === '') {
    errors.push('Title is required');
  } else if (post.title.length > 100) {
    errors.push('Title must be less than 100 characters');
  }
  
  if (!post.content || post.content.trim() === '') {
    errors.push('Content is required');
  } else if (post.content.length > 50000) {
    errors.push('Content must be less than 50,000 characters');
  }
  
  // Validate category
  if (!post.category_id) {
    errors.push('Category is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates comment content
 * @param {Object} comment - The comment object to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateCommentContent(comment) {
  const errors = [];
  
  // Check required fields
  if (!comment.content || comment.content.trim() === '') {
    errors.push('Comment content is required');
  } else if (comment.content.length > 5000) {
    errors.push('Comment must be less than 5,000 characters');
  }
  
  // Validate post_id
  if (!comment.post_id) {
    errors.push('Post ID is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @param {boolean} allowSomeHtml - Whether to allow some safe HTML tags
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input, allowSomeHtml = false) {
  if (!input) return '';
  
  if (allowSomeHtml) {
    // Use DOMPurify for more advanced sanitization when some HTML is allowed
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    });
  }
  
  // Basic HTML entity encoding for plain text
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates profile data
 * @param {Object} profile - The profile object to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateProfileData(profile) {
  const errors = [];
  
  if (profile.username) {
    if (profile.username.length < 3) {
      errors.push('Username must be at least 3 characters');
    } else if (profile.username.length > 20) {
      errors.push('Username must be less than 20 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(profile.username)) {
      errors.push('Username can only contain letters, numbers, underscore and dash');
    }
  }
  
  if (profile.bio && profile.bio.length > 500) {
    errors.push('Bio must be less than 500 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
