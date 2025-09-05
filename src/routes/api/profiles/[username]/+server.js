import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';

export async function GET({ params }) {
  try {
    console.log('🔍 Searching for profile:', params.username);
    
    // Get profile directly from local postgres
    const result = await query(`
      SELECT user_id, username, bio, updated_at
      FROM public_profiles 
      WHERE username = $1
    `, [params.username]);

    if (!result.rows.length) {
      console.log('❌ User not found:', params.username);
      return json({ 
        error: 'User not found',
        searchedUsername: params.username
      }, { status: 404 });
    }

    const profile = result.rows[0];
    console.log('✅ Returning profile:', profile);
    return json(profile);
  } catch (error) {
    console.error('Server error:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 