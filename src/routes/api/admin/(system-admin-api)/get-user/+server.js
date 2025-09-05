import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export async function GET({ url, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = url.searchParams.get('userId');
    
    // Validera användar-ID-format (UUID)
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        username,
        role,
        privilege_role,
        custom_roles
      `)
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    return json({ 
      custom_roles: user.custom_roles || {},
      privilege_role: user.privilege_role,
      role: user.role,
      username: user.username
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request, locals }) {
  if (!locals.session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify admin status
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('privilege_role')
    .eq('id', locals.session.user.id)
    .single();

  if (!profile || profile.privilege_role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { userId, newPrivilege } = await request.json();
  
  // Validera användar-ID
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: 'Invalid user ID format' }, { status: 400 });
  }
  
  // Validera privilege-värde
  const validPrivileges = ['user', 'moderator', 'admin'];
  if (!validPrivileges.includes(newPrivilege)) {
    return json({ error: 'Invalid privilege value' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ privilege_role: newPrivilege })
      .eq('id', userId);

    if (error) throw error;

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
} 