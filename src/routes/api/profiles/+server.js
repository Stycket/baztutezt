import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';

export async function POST({ request }) {
  const { user_id, username, bio } = await request.json();
  
  try {
    console.log('Creating public profile for:', { user_id, username });
    
    const result = await query(`
      INSERT INTO public_profiles (user_id, username, bio)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE 
      SET username = EXCLUDED.username,
          bio = EXCLUDED.bio,
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [user_id, username, bio]);

    console.log('Public profile created:', result.rows[0]);
    return json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error creating public profile:', error);
    return json({ error: error.message }, { status: 500 });
  }
}