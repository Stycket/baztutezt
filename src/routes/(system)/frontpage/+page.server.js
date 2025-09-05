import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (!locals.session?.user) {
    throw redirect(303, '/login');
  }

  return {
    user: locals.session.user
  };
}