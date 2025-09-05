<script>
  import { session } from '$lib/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/services/system/supabase';
  import { configStore } from '$lib/stores/configStore';
  import { onMount } from 'svelte';
  import { appConfig } from '../../../+layout.svelte';
  
  export let data;
  let { custom_roles, visibleRoles } = data;

  let userBio = '';
  let isEditing = false;
  let saving = false;
  let showPasswordChange = false;
  let newPassword = '';
  let confirmPassword = '';
  let passwordError = null;
  let passwordSuccess = false;

  async function refreshUserData() {
    if (!$session?.user?.id) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', $session.user.id)
      .single();
      
    if (profile) {
      session.update(current => ({
        ...current,
        user: {
          ...current.user,
          role: profile.role,
          privilege_role: profile.privilege_role,
          custom_roles: profile.custom_roles || {}
        }
      }));
    }
  }

  async function loadUserBio() {
    const username = $session?.user?.username || $session?.user?.user_metadata?.username;
    if (!username) {
      console.error('No username found in session');
      return;
    }
    
    try {
      console.log('🔄 Loading bio for:', username);
      const response = await fetch(`/api/profiles/${username}/bio`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load bio');
      }
      
      userBio = data.bio ?? '';
      console.log('✅ Bio loaded:', userBio);
    } catch (error) {
      console.error('❌ Error loading bio:', error);
    }
  }

  async function saveBio() {
    const username = $session?.user?.username || $session?.user?.user_metadata?.username;
    if (!username || saving) return;
    
    saving = true;
    try {
      console.log('💾 Saving bio for:', username);
      const response = await fetch(`/api/profiles/${username}/bio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: userBio })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save bio');
      
      console.log('✅ Bio saved successfully');
      isEditing = false;
    } catch (error) {
      console.error('❌ Error saving bio:', error);
      alert(`Failed to save bio: ${error.message}`);
    } finally {
      saving = false;
    }
  }

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      passwordError = 'Lösenorden matchar inte';
      return;
    }

    try {
      saving = true;
      passwordError = null;
      passwordSuccess = false;

      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) throw updateError;
      
      // Clear form and show success
      newPassword = '';
      confirmPassword = '';
      passwordSuccess = true;
      
      // Hide the form after 2 seconds
      setTimeout(() => {
        showPasswordChange = false;
        passwordSuccess = false;
      }, 2000);

    } catch (err) {
      console.error('Password update error:', err);
      passwordError = err.message || 'Ett fel uppstod vid uppdatering av lösenord';
    } finally {
      saving = false;
    }
  }

  onMount(async () => {
    if (!$session?.user) {
      goto('/login');
      return;
    }
    
    // Initial refresh
    await refreshUserData();
    
    // Set up periodic refresh
    const refreshInterval = setInterval(refreshUserData, 5000);
    
    await loadUserBio();
    
    return () => {
      clearInterval(refreshInterval);
    };
  });
</script>

{#if $session?.user}
  <div class="max-w-4xl mx-auto p-6">
    <div class="bg-white shadow rounded-lg p-6">
      <h1 class="text-2xl font-bold mb-6">User Profile</h1>
      
      <!-- Roles Section -->
      <div class="roles-container">
        {#if $session?.user?.privilege_role}
          <div class="role-badge privilege-role">
            <div class="role-main">
              <span class="role-icon">⚙️</span>
              <span class="role-name">{$session.user.privilege_role}</span>
            </div>
          </div>
        {/if}
        
        {#if $session?.user?.role}
          <div class="role-badge subscription-role">
            <div class="role-main">
              <span class="role-icon">⭐</span>
              <span class="role-name">{$session.user.role}</span>
            </div>
          </div>
        {/if}
        
        {#if custom_roles && Object.keys(custom_roles).length > 0}
          {#each Object.entries(custom_roles) as [roleName, subRoleValue]}
            <div class="role-badge custom-role">
              <div class="role-main">
                <span class="role-icon">🏆</span>
                <span class="role-name">{roleName}</span>
              </div>
              <div class="subroles-display">
                {#if Array.isArray(subRoleValue) && subRoleValue.length > 0}
                  {#each subRoleValue as subRole}
                    <span class="subrole-tag">{subRole}</span>
                  {/each}
                {:else if typeof subRoleValue === 'string'}
                  <span class="subrole-tag">{subRoleValue}</span>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>


      <!-- Password Change Section -->
      <div class="mt-6 user-card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Lösenord</h2>
          {#if !showPasswordChange}
            <button
              on:click={() => showPasswordChange = true}
              class="change-password-button"
            >
              Ändra lösenord
            </button>
          {/if}
        </div>

        {#if showPasswordChange}
          <form on:submit|preventDefault={handlePasswordChange} class="space-y-4">
            <div class="form-group">
              <label for="newPassword">Nytt lösenord</label>
              <input
                type="password"
                id="newPassword"
                bind:value={newPassword}
                required
                minlength="6"
                class="form-control"
                placeholder="Ange nytt lösenord"
              />
            </div>

            <div class="form-group">
              <label for="confirmPassword">Bekräfta lösenord</label>
              <input
                type="password"
                id="confirmPassword"
                bind:value={confirmPassword}
                required
                minlength="6"
                class="form-control"
                placeholder="Bekräfta nytt lösenord"
              />
            </div>

            {#if passwordError}
              <div class="error-message">
                {passwordError}
              </div>
            {/if}

            {#if passwordSuccess}
              <div class="success-message">
                Lösenordet har uppdaterats!
              </div>
            {/if}

            <div class="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                class="save-button"
              >
                {saving ? 'Uppdaterar...' : 'Uppdatera lösenord'}
              </button>

              <button
                type="button"
                on:click={() => {
                  showPasswordChange = false;
                  passwordError = null;
                  passwordSuccess = false;
                  newPassword = '';
                  confirmPassword = '';
                }}
                class="cancel-button"
              >
                Avbryt
              </button>
            </div>
          </form>
        {/if}
      </div>

    </div>
  </div>
{:else}
  <div class="flex justify-center items-center h-screen">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
{/if}

<style>
  /* Roles container */
  .roles-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 1rem 0 1.5rem;
  }
  
  /* Role badge base styling */
  .role-badge {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: transform 0.2s, box-shadow 0.2s;
    min-width: 120px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .role-badge:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  }
  
  /* Role main content */
  .role-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .role-icon {
    font-size: 1.125rem;
  }
  
  /* Role type specific styling */
  .privilege-role {
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    color: white;
  }
  
  .subscription-role {
    background: linear-gradient(135deg, #3b82f6, #60a5fa);
    color: white;
  }
  
  .custom-role {
    background: linear-gradient(135deg, #b45309, #d97706);
    color: white;
  }
  
  /* Subroles display */
  .subroles-display {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  
  .subrole-tag {
    font-size: 0.7rem;
    background: rgba(255, 255, 255, 0.3);
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    color: #1a202c;
    font-weight: 600;
  }
  
  /* User card */
  .user-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    border: 1px solid #f0f0f0;
    transition: transform 0.2s ease;
  }
  
  .user-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  /* Bio section */
  .bio-text {
    background: #f9f9f9;
    border-radius: 8px;
    padding: 1rem;
    min-height: 80px;
    border: 1px solid #f0f0f0;
  }
  
  .bio-textarea {
    width: 100%;
    min-height: 120px;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    resize: vertical;
    background: #f9f9f9;
    transition: border-color 0.2s, background-color 0.2s;
  }
  
  .bio-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    background: white;
  }
  
  .save-button {
    padding: 0.5rem 1.25rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  
  .save-button:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .save-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .cancel-button {
    padding: 0.5rem 1.25rem;
    background: white;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .cancel-button:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  .edit-button {
    color: #3b82f6;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }
  
  .edit-button:hover {
    color: #2563eb;
    text-decoration: underline;
  }
  
  /* Dark mode support */
  :global(:root[data-theme="dark"]) .user-card {
    background: #1f2937;
    border-color: #374151;
  }
  
  :global(:root[data-theme="dark"]) .bio-text {
    background: #111827;
    border-color: #374151;
  }
  
  :global(:root[data-theme="dark"]) .subscription-date {
    background: #1f2937;
    border-color: #374151;
  }
  
  :global(:root[data-theme="dark"]) .show-more-button {
    background: #374151;
    color: #e5e7eb;
  }
  
  :global(:root[data-theme="dark"]) .show-more-button:hover {
    background: #4b5563;
    color: #f9fafb;
  }
  
  :global(:root[data-theme="dark"]) .bio-textarea {
    background: #111827;
    border-color: #374151;
    color: #e5e7eb;
  }
  
  :global(:root[data-theme="dark"]) .bio-textarea:focus {
    background: #1f2937;
    border-color: #3b82f6;
  }
  
  :global(:root[data-theme="dark"]) .cancel-button {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }
  
  :global(:root[data-theme="dark"]) .cancel-button:hover {
    background: #374151;
    color: #f9fafb;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
      text-align: center;
    }
    
    .profile-meta {
      justify-content: center;
    }
    
    .roles-container {
      justify-content: center;
    }
  }
  
  @media (max-width: 480px) {
    .horizontal-purchases {
      grid-template-columns: 1fr;
    }
  }
  
  /* Dark mode support for subroles */
  :global(:root[data-theme="dark"]) .role-badge {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  :global(:root[data-theme="dark"]) .subrole-tag {
    background: rgba(255, 255, 255, 0.35);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    color: #1a202c;
  }
  
  /* Role name styling */
  .role-name {
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .change-password-button {
    padding: 0.5rem 1rem;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .change-password-button:hover {
    background: #4338ca;
    transform: translateY(-1px);
  }

  .form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    color: #1f2937;
  }

  .form-control:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  :global(:root[data-theme="dark"]) .form-control {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }

  :global(:root[data-theme="dark"]) .form-control:focus {
    border-color: #4f46e5;
  }

  .error-message {
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-radius: 0.5rem;
  }

  .success-message {
    padding: 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-radius: 0.5rem;
  }
</style>
