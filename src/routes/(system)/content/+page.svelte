<script>
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/services/system/supabase';

  let loading = true;

  const handleRouting = async () => {
    if ($session?.user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', $session.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      const userRole = data?.role || 'free';
      await goto(`/content/${userRole}`);
    } else {
      await goto('/content/free');
    }
    loading = false;
  };

  onMount(handleRouting);
</script>

{#if loading}
  <div class="flex justify-center items-center min-h-[50vh]">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
{/if} 