<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  
  const username = $page.params.username;
  let userProfile = null;
  let loading = true;
  let error = null;
  let editingBio = false;
  let bioText = '';

  async function loadProfile() {
    try {
      console.log('🔄 Loading profile for:', username);
      const response = await fetch(`/api/profiles/${username}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Profile load failed:', data);
        throw new Error(data.error || 'Failed to load profile');
      }
      
      userProfile = data;
      
      // Load bio
      const bioResponse = await fetch(`/api/profiles/${username}/bio`);
      const bioData = await bioResponse.json();
      if (bioResponse.ok && bioData.bio) {
        bioText = bioData.bio;
      }
      
      console.log('✅ Profile loaded:', userProfile);
    } catch (err) {
      console.error('❌ Error loading profile:', {
        username,
        error: err.message,
        fullError: err
      });
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function saveBio() {
    try {
      const response = await fetch(`/api/profiles/${username}/bio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioText })
      });

      if (!response.ok) {
        throw new Error('Failed to save bio');
      }

      editingBio = false;
    } catch (err) {
      console.error('Error saving bio:', err);
      error = err.message;
    }
  }

  $: isOwnProfile = $session?.user?.username === username;

  onMount(loadProfile);
</script>

<div class="user-profile">
  <div class="profile-card">
    <div class="profile-header">
      <div class="avatar">
        {username[0].toUpperCase()}
      </div>
      <h1 class="text-4xl font-bold">@{username}</h1>
    </div>

    {#if loading}
      <div class="loading">Loading...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if userProfile}
      <div class="bio-section">
        <h2 class="text-xl font-semibold mb-3">About</h2>
        {#if editingBio && isOwnProfile}
          <div class="edit-bio">
            <textarea
              bind:value={bioText}
              class="w-full p-2 rounded border"
              rows="4"
              placeholder="Write something about yourself..."
            ></textarea>
            <div class="flex gap-2 mt-2">
              <button
                on:click={saveBio}
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
              <button
                on:click={() => editingBio = false}
                class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        {:else}
          <p class="text-gray-700 whitespace-pre-wrap">
            {bioText || 'This user hasn\'t written anything about themselves yet.'}
          </p>
          {#if isOwnProfile}
            <button
              on:click={() => editingBio = true}
              class="mt-2 text-blue-500 hover:text-blue-600"
            >
              Edit Bio
            </button>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .user-profile {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
  }

  .profile-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .avatar {
    width: 5rem;
    height: 5rem;
    border-radius: 9999px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    color: white;
    font-weight: 600;
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bio-section {
    border-top: 1px solid var(--border-color);
    padding-top: 1.5rem;
  }

  .loading {
    text-align: center;
    color: var(--gray-500);
    padding: 2rem 0;
  }

  .error {
    color: red;
    text-align: center;
    padding: 1rem;
  }

  .edit-bio {
    margin-top: 1rem;
  }

  .username-link {
    color: var(--primary-color, #0079d3);
    text-decoration: none;
    font-weight: 500;
  }
  
  .username-link:hover {
    text-decoration: underline;
  }
  
  @media (prefers-color-scheme: dark) {
    .username-link {
      color: var(--primary-color-light, #4da3ff);
    }
  }
</style> 