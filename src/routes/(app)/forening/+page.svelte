<script>
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  import NonLoggedIn from './NonLoggedIn.svelte';
  import LoggedIn from './LoggedIn.svelte';

  // Reactive variable to check if the user is logged in
  $: isLoggedIn = $session?.user !== undefined;

  let communityInfo = null;
  let isLoading = true;

  // Fetch community info on mount
  onMount(async () => {
    try {
      const contentType = isLoggedIn ? 'loggedIn' : 'loggedOut'; // Determine content type based on login status
      const response = await fetch(`/api/infocms?type=${contentType}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched community info:', data); // Log the fetched data
        communityInfo = data; // Directly assign the fetched data
      } else {
        console.error('Failed to fetch community info:', response.status);
      }
    } catch (error) {
      console.error('Error fetching community info:', error);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="container">
  <div 
    class="background-image" 
    style="background-image: url('https://wallpapers.com/images/featured/white-gradient-background-o0tqqpgs66oz4rfr.jpg');"
  ></div>

  <div class="content-wrapper">
    {#if isLoading}
      <div class="glass-card loading"><p>Loading...</p></div>
    {:else if !communityInfo}
      <div class="glass-card"><p>No content available</p></div>
    {:else if !isLoggedIn}
      <NonLoggedIn {communityInfo} />
    {:else}
      <LoggedIn {communityInfo} />
    {/if}
  </div>
</div>

<style>
  .container {
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: -2;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 8vh;
    min-height: 100vh;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .content-wrapper {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 20px;
    width: 100%;
    max-width: 800px;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
    color: #333;
  }

  @media (min-width: 768px) {
    .glass-card {
      padding: 30px;
    }
  }

  .loading {
    text-align: center;
    font-size: 1.2rem;
  }
</style>