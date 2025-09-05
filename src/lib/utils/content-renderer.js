/**
 * Safely renders content that may contain HTML
 * This is used when displaying user-generated content that has been sanitized on the server
 * @param {string} content - The content to render
 * @returns {string} - HTML string that can be used with {@html ...} in Svelte
 */
export function renderContent(content) {
  if (!content) return '';
  
  // Convert URLs to clickable links
  const linkedContent = content.replace(
    /(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  
  // Convert line breaks to <br> tags
  return linkedContent.replace(/\n/g, '<br>');
}
