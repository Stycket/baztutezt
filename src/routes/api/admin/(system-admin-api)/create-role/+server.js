import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import * as fs from 'fs/promises';
import path from 'path';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function POST({ request, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roleName, subRoles, isVisibleToUsers } = await request.json();

    // Validate roleName to prevent filesystem attacks
    if (!/^[a-zA-Z0-9_]+$/.test(roleName)) {
      return json({ error: 'Invalid role name format' }, { status: 400 });
    }

    // Check if role already exists in database
    const { data: existingRole, error: checkError } = await supabaseAdmin
      .from('custom_roles')
      .select('name')
      .eq('name', roleName)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // Not found error is ok
      throw checkError;
    }

    if (existingRole) {
      return json({ error: `Role "${roleName}" already exists` }, { status: 400 });
    }

    // Create the role in Supabase
    const { error: dbError } = await supabaseAdmin
      .from('custom_roles')
      .insert({
        name: roleName,
        sub_roles: subRoles,
        visible_to_users: isVisibleToUsers
      });

    if (dbError) throw dbError;

    // Initialize ROLES and CUSTOM_ROLES if they don't exist
    if (!PRIVATE_CONFIG.ROLES) {
      PRIVATE_CONFIG.ROLES = {};
    }
    
    if (!PRIVATE_CONFIG.ROLES.CUSTOM_ROLES) {
      PRIVATE_CONFIG.ROLES.CUSTOM_ROLES = {};
    }

    // Add to PRIVATE_CONFIG
    PRIVATE_CONFIG.ROLES.CUSTOM_ROLES[roleName] = {
      name: roleName,
      sub_roles: subRoles,
      visible_to_users: isVisibleToUsers,
      created_at: new Date().toISOString()
    };

    // Update private-constants file
    try {
      const privateConstantsPath = path.join(process.cwd(), 'src', 'lib', 'server', 'private-constants.js');
      let privateContent = await fs.readFile(privateConstantsPath, 'utf-8');

      // Check if ROLES and CUSTOM_ROLES exist in the file
      if (!privateContent.includes('ROLES')) {
        // Add ROLES object if it doesn't exist
        privateContent = privateContent.replace(
          'export const PRIVATE_CONFIG = {', 
          'export const PRIVATE_CONFIG = {\n  ROLES: {\n    CUSTOM_ROLES: {}\n  },'
        );
      } else if (!privateContent.includes('CUSTOM_ROLES')) {
        // Add CUSTOM_ROLES object if it doesn't exist
        privateContent = privateContent.replace(
          /ROLES\s*:\s*{/,
          'ROLES: {\n    CUSTOM_ROLES: {},'
        );
      }

      // Add the new role to CUSTOM_ROLES in PRIVATE_CONFIG
      const privateRoleContent = `
      ${roleName}: {
        name: '${roleName}',
        sub_roles: ${JSON.stringify(subRoles)},
        visible_to_users: ${isVisibleToUsers},
        created_at: '${new Date().toISOString()}'
      },\n`;

      // Insert the new role before the closing brace of CUSTOM_ROLES
      const privateRolesRegex = /(CUSTOM_ROLES\s*:\s*{[^}]*)(})/;
      privateContent = privateContent.replace(privateRolesRegex, `$1${privateRoleContent}$2`);

      await fs.writeFile(privateConstantsPath, privateContent, 'utf-8');
    } catch (fileError) {
      console.error('Error updating config file:', fileError);
      // Continue even if file update fails
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error creating role:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function GET({ locals }) {
  // Merge necessary private config with public config
  const safeConfig = {
    ...PUBLIC_CONFIG,
    shipping: {
      countries: PRIVATE_CONFIG.SHIPPING.ALLOWED_COUNTRIES
    }
  };
  
  return json(safeConfig);
} 