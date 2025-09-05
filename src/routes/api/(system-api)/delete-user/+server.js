import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

export async function DELETE({ request, locals }) {
  try {
    // Check for session and user ID
    const userId = locals.session?.user?.id;
    if (!userId) {
      return json({ error: 'Unauthorized - No valid session' }, { status: 401 });
    }

    // Delete auth user first (this will cascade to profiles in Supabase)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return json({ error: 'Failed to delete auth user' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 