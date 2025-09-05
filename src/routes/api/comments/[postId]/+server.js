import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { APP_CONFIG } from '$lib/constants';

export async function GET({ params }) {
  try {
    const result = await query(`
      WITH RECURSIVE comment_hierarchy AS (
        -- Get root comments
        SELECT 
          c.id,
          c.post_id,
          c.content,
          c.parent_id,
          c.depth,
          c.created_at,
          p.username as author_username,
          c.thread_path::text as path,
          ARRAY[c.id] as path_array
        FROM comments c
        LEFT JOIN profiles p ON c.author_id = p.id
        WHERE c.post_id = $1 
          AND c.parent_id IS NULL
          AND c.deleted_at IS NULL 
          AND c.status = 'active'

        UNION ALL

        -- Get child comments
        SELECT 
          c.id,
          c.post_id,
          c.content,
          c.parent_id,
          c.depth,
          c.created_at,
          p.username as author_username,
          c.thread_path::text as path,
          ch.path_array || c.id
        FROM comments c
        JOIN comment_hierarchy ch ON c.parent_id = ch.id
        LEFT JOIN profiles p ON c.author_id = p.id
        WHERE c.deleted_at IS NULL 
          AND c.status = 'active'
      )
      SELECT * FROM comment_hierarchy
      ORDER BY path_array
    `, [params.postId]);
    
    return json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 