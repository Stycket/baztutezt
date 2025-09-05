import { redirect, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
  // Check if user is admin or moderator
  if (!locals.session?.user?.privilege_role || 
      (locals.session.user.privilege_role !== 'admin' && 
       locals.session.user.privilege_role !== 'moderator')) {
    throw redirect(302, '/');
  }

  try {
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    return {
      users
    };
  } catch (err) {
    console.error('Error in appadmin load function:', err);
    throw error(500, 'Error loading admin data');
  }
}
