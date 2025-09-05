import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { query, ensureInitialized } from '$lib/server/db';

/**
 * @typedef {import('@sveltejs/kit').RequestEvent} RequestEvent
 */

export async function PUT({ request, params, locals }) {
  // Check if user is admin or moderator
  if (!locals.session?.user?.privilege_role || 
      (locals.session.user.privilege_role !== 'admin' && 
       locals.session.user.privilege_role !== 'moderator')) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await ensureInitialized();
    const userId = params.userId;
    const { privilege_role } = await request.json();
    
    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }
    
    if (!privilege_role) {
      return json({ error: 'Privilege role is required' }, { status: 400 });
    }
    
    // Validate privilege_role
    const validRoles = ['user', 'moderator', 'admin'];
    if (!validRoles.includes(privilege_role)) {
      return json({ error: 'Invalid privilege role' }, { status: 400 });
    }

    // Update the role in Supabase profiles
    const { error: supabaseError } = await supabaseAdmin
      .from('profiles')
      .update({ privilege_role })
      .eq('id', userId);
    
    if (supabaseError) {
      throw supabaseError;
    }
    
    // Also update the local PostgreSQL database
    await query(
      `UPDATE profiles SET 
        privilege_role = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [privilege_role, userId]
    );

    return json({ 
      success: true, 
      message: 'User role updated successfully',
      userId,
      privilege_role
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 