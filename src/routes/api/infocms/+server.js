// src/routes/api/infocms/+server.js
import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';

export async function GET({ url, locals }) {
  try {
    const contentType = url.searchParams.get('type') || 'loggedIn';
    const isLoggedIn = locals.session?.user !== undefined;
    
    const { rows } = await query(`
      SELECT * FROM community_info 
      WHERE content_type = $1
      AND (visible_to_logged_out = true OR $2 = true) -- Check visibility for logged-out users
      ORDER BY created_at DESC 
      LIMIT 1
    `, [contentType, isLoggedIn]);

    if (rows.length === 0) {
      return json(null);
    }

    const content = rows[0];
    
    return json(content);
  } catch (error) {
    console.error('Error fetching community info:', error);
    return json({ error: 'Failed to fetch community info' }, { status: 500 });
  }
}

export async function POST({ request, locals }) {
  // Check if user is logged in
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, dropdown_options, content_type, visible_to_logged_out } = body;

    // Ensure dropdown_options is a valid JSON string
    const dropdownOptionsJson = JSON.stringify(dropdown_options);

    // Insert or update the community info in the database
    const result = await query(`
      INSERT INTO community_info (title, content, dropdown_options, content_type, visible_to_logged_out)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [title, content, dropdownOptionsJson, content_type, visible_to_logged_out]);

    return json(result.rows[0]);
  } catch (error) {
    console.error('Error saving community info:', error);
    return json({ error: 'Failed to save community info' }, { status: 500 });
  }
}