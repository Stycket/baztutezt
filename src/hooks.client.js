import { onAuthStateChange, supabase } from '$lib/services/system/supabase';
import { session } from '$lib/stores';

onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    localStorage.setItem('session', JSON.stringify(session));
  } else if (event === 'SIGNED_OUT') {
    // Clear everything
    localStorage.clear();
    sessionStorage.clear();
    session.set(null);
  }
});
