import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { postStore } from '$lib/stores/postStore';
import { userRateLimiter } from '$lib/server/rate-limiter';
import { validatePostContent, sanitizeInput } from '$lib/server/validators';
import { logError, ErrorSeverity } from '$lib/server/error-handler';

export async function POST({ request, locals }) {
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Apply rate limiting - 5 posts per minute
  if (userRateLimiter(locals.session.user.id, 5, 60000)) {
    logError('post-save', new Error('Rate limit exceeded'), 
      { userId: locals.session.user.id }, ErrorSeverity.WARNING);
    return json({ error: 'You are posting too frequently. Please wait a moment before trying again.' }, 
      { status: 429 });
  }

  try {
    const { content, status, approval_reason, post_type = 'public', category_id } = await request.json();
    
    // Validate content
    try {
      validatePostContent(content);
    } catch (error) {
      return json({ error: error.message }, { status: 400 });
    }
    
    // Sanitize all user inputs
    const sanitizedContent = sanitizeInput(content);
    const sanitizedReason = sanitizeInput(approval_reason);
    
    // First ensure profile exists in Postgres
    await query(`
      INSERT INTO profiles (
        id,
        email,
        username,
        role,
        privilege_role,
        created_at,
        updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        updated_at = NOW()
    `, [
      locals.session.user.id,
      locals.session.user.email,
      locals.session.user.user_metadata?.username || `user_${locals.session.user.id.slice(0, 8)}`,
      locals.session.user.user_metadata?.role || 'free',
      locals.session.user.user_metadata?.privilege_role || 'user'
    ]);

    // Then save the post with sanitized content
    const result = await query(`
      WITH inserted_post AS (
        INSERT INTO posts (
          author_id,
          content,
          status,
          approval_reason,
          post_type,
          category_id,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      )
      SELECT 
        ip.*,
        pr.username as author_username
      FROM inserted_post ip
      LEFT JOIN profiles pr ON ip.author_id = pr.id
    `, [
      locals.session.user.id,
      sanitizedContent,
      status,
      sanitizedReason,
      post_type,
      category_id || null
    ]);

    if (!result || result.rows.length === 0) {
      throw new Error('Failed to insert post');
    }

    const createdPost = result.rows[0];

    // Broadcast to all connected clients
    postStore.broadcast({
      type: 'post_added',
      post: createdPost
    });

    return json(createdPost);
  } catch (error) {
    logError('post-save', error, { userId: locals.session.user.id }, ErrorSeverity.ERROR);
    return json({ error: error.message }, { status: 500 });
  }
} 