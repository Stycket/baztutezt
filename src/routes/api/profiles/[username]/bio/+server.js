import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db.js';

export async function GET({ params, locals }) {
  try {
    const { username } = params;
    console.log('🔍 Fetching bio for username:', username);
    
    // First try to get by username
    let result = await query(`
      SELECT bio 
      FROM public_profiles 
      WHERE username = $1
    `, [username]);

    // If not found and we have a session, try by user_id
    if (!result.rows.length && locals.session?.user?.id) {
      result = await query(`
        SELECT bio 
        FROM public_profiles 
        WHERE user_id = $1
      `, [locals.session.user.id]);
    }

    console.log('✅ Bio fetched:', result.rows[0]?.bio);
    return json({ bio: result.rows[0]?.bio ?? null });
  } catch (error) {
    console.error('Error fetching bio:', error);
    return json({ error: 'Failed to fetch bio' }, { status: 500 });
  }
}

export async function POST({ request, params, locals }) {
  try {
    const { bio } = await request.json();
    const { username } = params;
    console.log('📝 Saving bio for username:', username);

    // First ensure profile exists
    if (locals.session?.user) {
      await query(`
        INSERT INTO public_profiles (user_id, username, bio)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE 
        SET username = EXCLUDED.username,
            bio = EXCLUDED.bio,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [locals.session.user.id, username, bio]);
    }

    const result = await query(`
      UPDATE public_profiles 
      SET bio = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE username = $2 
      OR user_id = $3
      RETURNING *
    `, [bio, username, locals.session?.user?.id]);

    if (!result.rows.length) {
      console.error('❌ User not found in local postgres:', username);
      return json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ Bio saved successfully');
    return json({ success: true, bio: result.rows[0].bio });
  } catch (error) {
    console.error('❌ Error saving bio:', error);
    return json({ error: 'Failed to save bio' }, { status: 500 });
  }
} 