import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import fs from 'fs/promises';
import path from 'path';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function POST({ request, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roleName } = await request.json();
    
    if (!roleName) {
      return json({ error: 'Role name is required' }, { status: 400 });
    }

    // 1. Delete the role from the database
    const { error: deleteError } = await supabaseAdmin
      .from('custom_roles')
      .delete()
      .eq('name', roleName);

    if (deleteError) throw deleteError;

    // 2. Update any user profiles that have this role
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, custom_roles')
      .filter('custom_roles', 'not.is', null);

    if (profilesError) throw profilesError;

    // Update each profile to remove the role
    for (const profile of profiles) {
      if (profile.custom_roles && profile.custom_roles[roleName]) {
        const updatedRoles = { ...profile.custom_roles };
        delete updatedRoles[roleName];
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            custom_roles: updatedRoles,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);
          
        if (updateError) {
          console.error(`Error updating profile ${profile.id}:`, updateError);
        }
      }
    }

    // 3. Remove from PRIVATE_CONFIG in memory
    let configUpdated = false;
    
    // Check if role exists in ROLES.CUSTOM_ROLES
    if (PRIVATE_CONFIG?.ROLES?.CUSTOM_ROLES?.[roleName]) {
      delete PRIVATE_CONFIG.ROLES.CUSTOM_ROLES[roleName];
      configUpdated = true;
    }
    
    // Check if role exists in STRIPE.CUSTOM_ROLES
    if (PRIVATE_CONFIG?.STRIPE?.CUSTOM_ROLES?.[roleName]) {
      delete PRIVATE_CONFIG.STRIPE.CUSTOM_ROLES[roleName];
      configUpdated = true;
    }
    
    // 4. If we updated the config in memory, try to update the file
    if (configUpdated) {
      try {
        const privateConstantsPath = path.resolve('src/lib/server/private-constants.js');
        let privateContent = await fs.readFile(privateConstantsPath, 'utf-8');
        
        // Safely remove the role from the file
        const escapedRoleName = roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Pattern to match the role in ROLES.CUSTOM_ROLES
        const rolesRegex = new RegExp(`(CUSTOM_ROLES\\s*:\\s*{[^}]*?})\\s*${escapedRoleName}\\s*:\\s*{[^}]*?},?`, 'g');
        privateContent = privateContent.replace(rolesRegex, '$1');
        
        // Pattern to match the role in STRIPE.CUSTOM_ROLES
        const stripeRegex = new RegExp(`(STRIPE\\s*:[^}]*CUSTOM_ROLES\\s*:\\s*{[^}]*?})\\s*${escapedRoleName}\\s*:\\s*{[^}]*?},?`, 'g');
        privateContent = privateContent.replace(stripeRegex, '$1');
        
        await fs.writeFile(privateConstantsPath, privateContent, 'utf-8');
      } catch (fileError) {
        console.error('Error updating config file:', fileError);
        // Continue even if file update fails
      }
    }

    return json({ 
      success: true, 
      updated: {
        database: true,
        config: configUpdated
      }
    });
  } catch (error) {
    console.error('Error deleting custom role:', error);
    return json({ error: error.message }, { status: 500 });
  }
}