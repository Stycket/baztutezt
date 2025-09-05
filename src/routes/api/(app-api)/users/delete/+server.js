import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { query, ensureInitialized } from '$lib/server/db';

/**
 * @typedef {import('@sveltejs/kit').RequestEvent} RequestEvent
 */

export async function DELETE({ url, locals }) {
  // Check if user is admin or moderator
  if (!locals.session?.user?.privilege_role || 
      (locals.session.user.privilege_role !== 'admin' && 
       locals.session.user.privilege_role !== 'moderator')) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await ensureInitialized();
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    // First delete the user's bookings from the local PostgreSQL database
    try {
      await query('DELETE FROM bookings WHERE user_id = $1', [userId]);
      console.log(`Deleted bookings for user ${userId}`);
    } catch (err) {
      console.error('Error deleting user bookings:', err);
      // Continue with deletion even if bookings couldn't be deleted
    }

    // Delete the user's public profile (bio, etc.) if it exists
    try {
      await query('DELETE FROM public_profiles WHERE user_id = $1', [userId]);
      console.log(`Deleted public profile for user ${userId}`);
    } catch (err) {
      console.error('Error deleting public profile:', err);
      // Continue with deletion even if public profile couldn't be deleted
    }

    // Delete any comments made by the user
    try {
      await query('DELETE FROM comments WHERE author_id = $1', [userId]);
      console.log(`Deleted comments for user ${userId}`);
    } catch (err) {
      console.error('Error deleting user comments:', err);
      // Continue with deletion
    }

    // Delete any posts made by the user
    try {
      await query('DELETE FROM posts WHERE author_id = $1', [userId]);
      console.log(`Deleted posts for user ${userId}`);
    } catch (err) {
      console.error('Error deleting user posts:', err);
      // Continue with deletion
    }

    // Next delete the user's profile from the local profiles table
    try {
      await query('DELETE FROM profiles WHERE id = $1', [userId]);
      console.log(`Deleted local profile for user ${userId}`);
    } catch (err) {
      console.error('Error deleting local profile:', err);
      // Continue with deletion even if local profile couldn't be deleted
    }

    // Finally delete the user from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return json({ error: 'Failed to delete user from Supabase' }, { status: 500 });
    }

    return json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 