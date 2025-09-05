import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';
import { commentStore } from '$lib/stores/commentStore';
import { userRateLimiter } from '$lib/server/rate-limiter';
import { validatePostContent, sanitizeInput } from '$lib/server/validators';
import { logError } from '$lib/server/error-handler';

export async function GET({ url }) {
  try {
    const postId = url.searchParams.get('postId');
    if (!postId) {
      return json({ error: 'Post ID is required' }, { status: 400 });
    }

    // Check if comments are enabled with try/catch
    try {
      if (!PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.ENABLED || 
          !PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.ENABLED) {
        return json({ error: 'Comments are disabled' }, { status: 403 });
      }
    } catch (e) {
      console.error('Error checking comment settings:', e);
      return json({ error: 'Comment system unavailable' }, { status: 500 });
    }
    
    // Get comments for the post
    const result = await query(
      `SELECT c.*, p.username
       FROM comments c
       LEFT JOIN profiles p ON c.author_id = p.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );
    
    return json(result.rows);
  } catch (error) {
    logError('comment-get', error, {});
    return json({ error: error.message || 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST({ request, locals }) {
  try {
    // Check if user is authenticated
    if (!locals.session?.user) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get request body
    const { postId, content, parentId } = await request.json();
    
    // Validate inputs
    if (!postId) {
      return json({ error: 'Post ID is required' }, { status: 400 });
    }
    
    // Validate content
    try {
      validatePostContent(content, 1, 5000); // Min 1 char, max 5000
    } catch (error) {
      return json({ error: error.message }, { status: 400 });
    }
    
    // Sanitize user input
    const sanitizedContent = sanitizeInput(content);
    
    // Use the existing userRateLimiter instead of custom implementation
    const userId = locals.session.user.id;
    
    // Apply rate limiting - 12 comments per minute (1 every 5 seconds)
    if (userRateLimiter(userId, 12, 60000)) {
      return json({ 
        error: 'You are commenting too frequently. Please wait a moment before trying again.' 
      }, { status: 429 });
    }
    
    // Insert comment directly without transaction for simplicity
    try {
      // Insert comment
      const result = await query(
        `INSERT INTO comments (post_id, author_id, content, parent_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [postId, userId, sanitizedContent, parentId || null]
      );
      
      // If no rows were returned, the insert failed
      if (!result.rows.length) {
        throw new Error('Failed to insert comment');
      }
      
      const newComment = result.rows[0];
      
      // Get user info - removed avatar_url from the query
      const userResult = await query(
        `SELECT username FROM profiles WHERE id = $1`,
        [userId]
      );
      
      // Add user info to comment
      newComment.username = userResult.rows[0]?.username || 'Anonymous';
      
      // Notify subscribers
      try {
        commentStore.broadcast({
          type: 'comment_added',
          postId,
          parentId: parentId || null
        });
      } catch (e) {
        console.error('Error broadcasting comment:', e);
        // Continue even if broadcast fails
      }

      return json(newComment);
    } catch (error) {
      throw error;
    }
  } catch (error) {
    logError('comment-create', error, { userId: locals.session?.user?.id });
    return json({ error: error.message || 'Failed to create comment' }, { status: 500 });
  }
} 