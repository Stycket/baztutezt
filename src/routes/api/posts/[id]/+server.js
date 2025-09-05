import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function GET({ params }) {
  const postId = params.id;
  
  // Check if social features are enabled
  const socialEnabled = PRIVATE_CONFIG?.FEATURES?.SOCIAL_SETTINGS?.ENABLED || false;
  if (!socialEnabled) {
    return json({ error: 'Social features are disabled' }, { status: 403 });
  }
  
  try {
    const result = await query(`
      SELECT 
        p.id, 
        p.content, 
        p.created_at, 
        p.author_id,
        u.username,
        COUNT(c.id) AS comment_count
      FROM posts p
      LEFT JOIN profiles u ON p.author_id = u.id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE p.id = $1
      GROUP BY p.id, p.content, p.created_at, p.author_id, u.username
    `, [postId]);

    if (result.rows.length === 0) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    return json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching post:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }) {
  const postId = params.id;
  
  // Check if social features are enabled
  const socialEnabled = PRIVATE_CONFIG?.FEATURES?.SOCIAL_SETTINGS?.ENABLED || false;
  if (!socialEnabled) {
    return json({ error: 'Social features are disabled' }, { status: 403 });
  }
  
  try {
    if (!locals.session?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content } = await request.json();
    
    if (!content || content.trim() === '') {
      return json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    // First check if the post exists and belongs to the user
    const checkResult = await query(`
      SELECT author_id FROM posts WHERE id = $1
    `, [postId]);

    if (checkResult.rows.length === 0) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    const post = checkResult.rows[0];
    const isAdmin = locals.session.user.privilege_role === 'admin';
    
    if (post.author_id !== locals.session.user.id && !isAdmin) {
      return json({ error: 'You do not have permission to edit this post' }, { status: 403 });
    }

    // Update the post
    const result = await query(`
      UPDATE posts
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, content, created_at, updated_at, author_id
    `, [content, postId]);

    return json(result.rows[0]);
  } catch (error) {
    console.error('Error updating post:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ params, locals }) {
  const postId = params.id;
  
  // Check if social features are enabled
  const socialEnabled = PRIVATE_CONFIG?.FEATURES?.SOCIAL_SETTINGS?.ENABLED || false;
  if (!socialEnabled) {
    return json({ error: 'Social features are disabled' }, { status: 403 });
  }
  
  try {
    if (!locals.session?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First check if the post exists and belongs to the user
    const checkResult = await query(`
      SELECT author_id FROM posts WHERE id = $1
    `, [postId]);

    if (checkResult.rows.length === 0) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    const post = checkResult.rows[0];
    const isAdmin = locals.session.user.privilege_role === 'admin';
    
    if (post.author_id !== locals.session.user.id && !isAdmin) {
      return json({ error: 'You do not have permission to delete this post' }, { status: 403 });
    }

    // Delete the post
    await query(`
      DELETE FROM posts WHERE id = $1
    `, [postId]);

    return json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 