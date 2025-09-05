import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

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