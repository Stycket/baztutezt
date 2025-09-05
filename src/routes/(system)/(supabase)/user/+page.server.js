import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export async function load({ locals }) {
  if (!locals.session?.user) {
    return { purchases: [], subscription: null, custom_roles: {}, visibleRoles: [] };
  }

  try {
    // Get user's profile data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('custom_roles')
      .eq('id', locals.session.user.id)
      .single();

    if (profileError) throw profileError;

    // Get all custom roles from the user's profile
    const userCustomRoles = profile?.custom_roles || {};
    
    // Since we removed Stripe, simplify by only relying on the user's actual roles
    const finalVisibleRoles = Object.keys(userCustomRoles);
    
    console.log('User custom roles:', userCustomRoles);
    console.log('All visible roles:', finalVisibleRoles);
    
    // We'll return empty arrays/objects since Stripe functionality has been removed
    return {
      custom_roles: userCustomRoles,
      visibleRoles: finalVisibleRoles,
      subscription: null,
      purchases: []
    };
  } catch (err) {
    console.error('Error loading user data:', err);
    throw error(500, 'Error loading user data');
  }
} 