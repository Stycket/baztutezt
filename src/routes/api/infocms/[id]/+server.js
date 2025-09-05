import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';

export async function PUT({ params, request, locals }) {
  // Check if user is logged in
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { title, content, dropdown_options, content_type, visible_to_logged_out } = body;

    // Ensure dropdown_options is a valid JSON string
    const dropdownOptionsJson = JSON.stringify(dropdown_options);

    // Update existing community info in the database
    const result = await query(`
      UPDATE community_info 
      SET title = $1, content = $2, dropdown_options = $3, content_type = $4, visible_to_logged_out = $5, 
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [title, content, dropdownOptionsJson, content_type, visible_to_logged_out, id]);

    if (result.rows.length === 0) {
      return json({ error: 'Content not found' }, { status: 404 });
    }

    return json(result.rows[0]);
  } catch (error) {
    console.error('Error updating community info:', error);
    return json({ error: 'Failed to update community info' }, { status: 500 });
  }
}
