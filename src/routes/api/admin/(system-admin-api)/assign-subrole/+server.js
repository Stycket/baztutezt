import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export async function POST({ request, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, roleName, subRole } = await request.json();

    // Get current user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('custom_roles')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Update custom_roles
    const custom_roles = {
      ...userData.custom_roles,
      [roleName]: subRole || null
    };

    // Update the profile
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ custom_roles })
      .eq('id', userId)
      .select('custom_roles')
      .single();

    if (updateError) throw updateError;

    return json({ custom_roles: updatedUser.custom_roles });
  } catch (error) {
    console.error('Error assigning sub-role:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 