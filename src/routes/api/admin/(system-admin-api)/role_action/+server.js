import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import * as fs from 'fs/promises';
import path from 'path';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function DELETE({ request, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { roleName } = await request.json();
    
    // Validera roleName
    if (!roleName || !/^[a-zA-Z0-9_]+$/.test(roleName)) {
      return json({ error: 'Invalid role name format' }, { status: 400 });
    }
    
    // Delete from Supabase
    const { error: dbError } = await supabaseAdmin
      .from('custom_roles')
      .delete()
      .eq('name', roleName);
      
    if (dbError) throw dbError;
    
    // Remove from PRIVATE_CONFIG
    delete PRIVATE_CONFIG.ROLES.CUSTOM_ROLES[roleName];
    
    // Update private-constants file
    const privateConstantsPath = path.resolve('src/lib/server/private-constants.js');
    let privateContent = await fs.readFile(privateConstantsPath, 'utf-8');
    
    // Säkrare sätt att ta bort rollen från filen
    const escapedRoleName = roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const roleRegex = new RegExp(`\\s*${escapedRoleName}:\\s*{[^}]*},?\\n?`);
    privateContent = privateContent.replace(roleRegex, '');
    
    await fs.writeFile(privateConstantsPath, privateContent, 'utf-8');
    
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ request, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { roleName, subRoles } = await request.json();
    
    if (!/^[a-zA-Z0-9_]+$/.test(roleName)) {
      return json({ error: 'Invalid role name format' }, { status: 400 });
    }
    
    // Update in Supabase
    const { error: dbError } = await supabaseAdmin
      .from('custom_roles')
      .update({ sub_roles: subRoles })
      .eq('name', roleName);
      
    if (dbError) throw dbError;
    
    // Update PRIVATE_CONFIG
    PRIVATE_CONFIG.ROLES.CUSTOM_ROLES[roleName].sub_roles = subRoles;
    
    // Update private-constants file
    const privateConstantsPath = path.resolve('src/lib/server/private-constants.js');
    let privateContent = await fs.readFile(privateConstantsPath, 'utf-8');
    
    // Update the sub_roles in the existing role entry
    const roleRegex = new RegExp(`(${roleName}:\\s*{[^}]*sub_roles:\\s*)\\[[^\\]]*\\]`);
    privateContent = privateContent.replace(
      roleRegex,
      `$1${JSON.stringify(subRoles)}`
    );
    
    await fs.writeFile(privateConstantsPath, privateContent, 'utf-8');
    
    return json({ success: true });
  } catch (error) {
    console.error('Error updating role:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request, locals }) {
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roleName, action, isVisibleToUsers } = await request.json();
    
    if (action !== 'toggle_visibility') {
      return json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(roleName)) {
      return json({ error: 'Invalid role name format' }, { status: 400 });
    }

    // Update in Supabase
    const { error: dbError } = await supabaseAdmin
      .from('custom_roles')
      .update({ visible_to_users: isVisibleToUsers })
      .eq('name', roleName);
      
    if (dbError) throw dbError;

    // Update PRIVATE_CONFIG 
    PRIVATE_CONFIG.ROLES.CUSTOM_ROLES[roleName].visible_to_users = isVisibleToUsers;

    // Update private-constants file
    const privateConstantsPath = path.resolve('src/lib/server/private-constants.js');
    let privateContent = await fs.readFile(privateConstantsPath, 'utf-8');

    // Update the visibility in the CUSTOM_ROLES section
    const roleRegex = new RegExp(`(${roleName}:\\s*{[^}]*visible_to_users:\\s*)\\w+`, 'g');
    privateContent = privateContent.replace(roleRegex, `$1${isVisibleToUsers}`);

    await fs.writeFile(privateConstantsPath, privateContent, 'utf-8');

    return json({ success: true });
  } catch (error) {
    console.error('Error updating role visibility:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 