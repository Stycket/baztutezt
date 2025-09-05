import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function GET({ locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get roles from Supabase
    const { data: dbRoles, error } = await supabaseAdmin
      .from('custom_roles')
      .select('*');

    if (error) throw error;

    // Get roles from PRIVATE_CONFIG with safe fallback
    const configRoles = PRIVATE_CONFIG?.ROLES?.CUSTOM_ROLES || {};

    // Merge roles from both sources
    const mergedRoles = {};

    // Add DB roles
    dbRoles.forEach(role => {
      mergedRoles[role.name] = {
        name: role.name,
        sub_roles: role.sub_roles,
        visible_to_users: role.visible_to_users,
        created_at: role.created_at
      };
    });

    // Add config roles that aren't in DB
    Object.entries(configRoles).forEach(([name, role]) => {
      if (!mergedRoles[name]) {
        mergedRoles[name] = {
          name,
          sub_roles: role.sub_roles,
          visible_to_users: role.visible_to_users,
          created_at: role.created_at
        };
      }
    });

    return json({ roles: Object.values(mergedRoles) });
  } catch (error) {
    console.error('Error getting custom roles:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 