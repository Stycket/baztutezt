<script>
  import RoleManager from './RoleManager.svelte';
  import { session } from '$lib/stores';
  import { configStore } from '$lib/stores/configStore';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/utils/api';
  import { addDebugLog } from '$lib/stores';
  
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  export let data;
  
  // Admin panel variables
  let users = data?.users?.map(user => ({
    ...user,
    custom_roles: user.custom_roles || {}
  })) || [];
  let customRoles = data.customRoles;
  let loading = false;
  let error = null;
  let showUserList = false;
  let expandedUsers = new Set();
  let showCustomRoles = new Set();
  let resetStatus = '';
  let resetError = '';

  // Poster variables
  let userInput = '';
  let posterLoading = false;
  let result = null;
  let submittedMessage = '';
  let userPosts = [];

  // Check if user has admin privileges
  $: isAdmin = $session?.user?.privilege_role === 'admin';
  $: isModerator = $session?.user?.privilege_role === 'moderator';
  $: hasAccess = isAdmin || isModerator;
  
  let privilegeRoles = [
    { name: 'user', display_name: 'User' },
    { name: 'moderator', display_name: 'Moderator' },
    { name: 'admin', display_name: 'Admin' }
  ];

  function showSuccess(message) {
    success = message;
    setTimeout(() => { success = null; }, 3000);
  }

  function showError(message) {
    error = message;
    setTimeout(() => { error = null; }, 3000);
  }

  async function loadUserPosts() {
    try {
      const response = await api.post('/api/posts', { 
        'X-Post-Type': 'admin'
      });
      userPosts = await response.json();
      // Filter to only show admin posts
      userPosts = userPosts.filter(post => post.post_type === 'admin');
    } catch (error) {
      console.error('Error loading admin posts:', error);
    }
  }

  async function handleSubmit() {
    if (!userInput.trim() || posterLoading) return;
    
    posterLoading = true;
    submittedMessage = userInput;
    
    try {
      // Skip DeepSeek verification and post directly to the database
      // Only admins can use this
      if (!$session?.user?.privilege_role || $session.user.privilege_role !== 'admin') {
        throw new Error('Only administrators can post announcements');
      }
      
      const saveResponse = await api('/api/posts/save', {
        method: 'POST',
        body: JSON.stringify({
          content: userInput,
          status: 'approved', // Automatically approve admin posts
          approval_reason: 'Admin announcement',
          post_type: 'admin', // This is crucial - it identifies admin posts
          username: $session?.user?.username || $session?.user?.user_metadata?.username || 'Anonymous'
        })
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.message || 'Failed to save post');
      }

      await loadUserPosts();
      userInput = '';
      
    } catch (error) {
      console.error('Error:', error);
      errorMessage = error.message;
    } finally {
      posterLoading = false;
    }
  }

  onMount(() => {
    loadUserPosts();
  });

  async function handlePrivilegeUpdate(userId, newPrivilege) {
    try {
      loading = true;
      error = null;
      
      const response = await api.post('/api/admin/update-privilege', {
        userId,
        newPrivilege
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update privilege');
      }

      users = users.map(user => 
        user.id === userId ? { ...user, privilege_role: newPrivilege } : user
      );
      
      showSuccess('User privilege updated successfully');
    } catch (err) {
      showError(`Error updating privilege: ${err.message}`);
    } finally {
      loading = false;
    }
  }

  function toggleUserList() {
    showUserList = !showUserList;
  }

  async function toggleCustomRoles(userId) {
    try {
      if (showCustomRoles.has(userId)) {
        showCustomRoles.delete(userId);
      } else {
        loading = true;
        const response = await api.get(`/api/admin/get-user?userId=${userId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch user data');
        }
        
        const userData = await response.json();
        
        // Update the users array with fresh data
        users = users.map(user => 
          user.id === userId 
            ? { ...user, custom_roles: userData.custom_roles }
            : user
        );
        
        showCustomRoles.add(userId);
      }
      showCustomRoles = new Set(showCustomRoles); // Force UI update
    } catch (err) {
      error = err.message;
      console.error('Error toggling custom roles:', err);
    } finally {
      loading = false;
    }
  }

  async function assignSubRole(userId, roleName, subRole) {
    try {
      loading = true;
      error = null;
      
      const response = await api.post('/api/admin/assign-subrole', {
        userId,
        roleName,
        subRole
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign sub-role');
      }

      const { custom_roles } = await response.json();
      
      // Update the users array with new custom roles
      users = users.map(user => 
        user.id === userId 
          ? { ...user, custom_roles: custom_roles }
          : user
      );

    } catch (err) {
      error = err.message;
      console.error('Error assigning sub-role:', err);
    } finally {
      loading = false;
    }
  }

  async function handleDatabaseReset() {
    if (!confirm('Are you sure you want to reset the database? This cannot be undone!')) {
      return;
    }
    
    loading = true;
    resetStatus = '';
    resetError = '';
    
    try {
      const response = await api.post('/api/postgres-database/reset-database', {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Database reset failed');
      }
      
      resetStatus = 'Database reset successful. Please reload the page.';
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Database reset error:', error);
      resetError = error.message || 'Unknown error occurred';
    } finally {
      loading = false;
    }
  }

  async function handleLogoClick() {
    if ($session?.user) {
      await goto('/frontpage');
    } else {
      await goto('/');
    }
  }

  function groupPurchasesByCheckout(purchases) {
    // This function is no longer needed but keeping the stub to avoid breaking references
    return [];
  }

  function toggleUserPurchaseDetails(purchaseId) {
    // This function is no longer needed but keeping the stub to avoid breaking references
  }

  async function handleCustomRoleUpdate(userId, roleName, subRole) {
    try {
      loading = true;
      error = null;
      
      const response = await api.post('/api/admin/assign-subrole', {
        userId,
        roleName,
        subRole
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update custom role');
      }
      
      const { custom_roles } = await response.json();
      
      // Update the user in the local state
      users = users.map(user => {
        if (user.id === userId) {
          return {
            ...user,
            custom_roles
          };
        }
        return user;
      });
      
      showSuccess('Custom role updated successfully');
    } catch (err) {
      console.error('Error updating custom role:', err);
      showError(err.message);
    } finally {
      loading = false;
    }
  }

  // Add debug logging before admin menu check
  $: showAdminMenu = $session?.user?.privilege_role === 'admin' || $session?.user?.privilege_role === 'moderator';
  $: {
    addDebugLog({
      type: 'admin_menu_check',
      message: 'Checking admin menu visibility',
      data: {
        showAdminMenu,
        privilege_role: $session?.user?.privilege_role
      }
    });
  }

  // Add debug logging to check admin privileges
  $: {
    if ($session?.user) {
      console.log('Admin check:', {
        isAdmin,
        isModerator,
        hasAccess
      });
    }
  }

  // Watch for changes to showShippingProducts
  $: if (false) {
    // Placeholder for removed code to avoid reactive statement errors
  }

  async function fetchShippingProducts() {
    if (!showShippingProducts) return;
    
    try {
      shippedProducts = data.shippingOrders.filter(order => order.status === 'shipped');
      unshippedProducts = data.shippingOrders.filter(order => order.status === 'pending');
    } catch (error) {
      console.error('Error fetching shipping products:', error);
      showError('Error fetching shipping products');
    }
  }

  async function updateUserRole(userId, newRole) {
    try {
      const response = await api.post('/api/admin/update-privilege', {
        userId,
        role: newRole
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user role');
      }
      
      // Update local user data
      users = users.map(user => {
        if (user.id === userId) {
          return { ...user, privilege_role: newRole };
        }
        return user;
      });
      
      showSuccess(`Updated user role to ${newRole}`);
    } catch (error) {
      console.error('Error updating user role:', error);
      showError(error.message || 'Error updating user role');
    }
  }

  async function handleRoleAction(action, role) {
    try {
      if (action === 'create') {
        // Create new role
        const response = await api.post('/api/admin/create-role', {
          name: role.name,
          display_name: role.display_name,
          permissions: role.permissions || []
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create role');
        }
        
        const result = await response.json();
        customRoles[result.role.name] = result.role;
        customRoles = { ...customRoles }; // Force update
        
      } else if (action === 'delete') {
        // Delete existing role
        const response = await api.delete(`/api/admin/delete-custom-role?roleName=${role.name}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete role');
        }
        
        // Remove from local state
        const { [role.name]: removedRole, ...restRoles } = customRoles;
        customRoles = restRoles;
      }
    } catch (error) {
      console.error('Error handling role action:', error);
      showError(error.message || 'Error processing role action');
    }
  }

  async function assignSubrole(userId, roleName, shouldAssign) {
    try {
      const response = await api.post('/api/admin/assign-subrole', {
        userId,
        roleName,
        assign: shouldAssign
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subrole');
      }
      
      // Update local user data
      users = users.map(user => {
        if (user.id === userId) {
          const custom_roles = { ...user.custom_roles };
          
          if (shouldAssign) {
            custom_roles[roleName] = true;
          } else {
            delete custom_roles[roleName];
          }
          
          return { ...user, custom_roles };
        }
        return user;
      });
      
      showSuccess(`${shouldAssign ? 'Assigned' : 'Removed'} role ${roleName}`);
    } catch (error) {
      console.error('Error updating subrole:', error);
      showError(error.message || 'Error updating subrole');
    }
  }
</script>

<div class="split-container">
  {#if hasAccess}
    <!-- Left Side - Admin Panel -->
    <div class="left-section">
      {#if isModerator && !isAdmin}
        <div class="moderator-bg"></div>
      {/if}
      {#if isAdmin}
        <div class="admin-controls">
          <h2>Admin Controls</h2>
          
          <!-- App Controls Section -->
          <div class="control-section">
            <h3 class="text-blue-400 text-left">App Controls</h3>
            
            <!-- Database Reset Button -->
            <div class="mb-6">
              <button
                on:click={handleDatabaseReset}
                disabled={loading}
                class="control-button bg-red-600 hover:bg-red-700 text-white"
              >
                <i>🔄</i>
                {loading ? 'Processing...' : 'Reset Database'}
              </button>
              {#if resetStatus}
                <p class="status-message success-message">{resetStatus}</p>
              {/if}
              {#if resetError}
                <p class="status-message error-message">{resetError}</p>
              {/if}
            </div>
          </div>

          <!-- System Controls Section -->
          <div class="control-section">
            <h3 class="text-red-400 text-left">System Controls</h3>
            
            <!-- User Management -->
            <div class="mb-6">
              <button
                on:click={() => showUserList = !showUserList}
                class="control-button bg-blue-600 hover:bg-blue-700 text-white"
              >
                <i>👥</i>
                {showUserList ? 'Hide' : ''} User List
              </button>
            </div>

            <!-- Role System -->
            <div class="mb-6">
              <button
                on:click={() => {
                  showCustomRoles = showCustomRoles.size > 0 ? new Set() : new Set(['show']);
                  showUserList = false;
                }}
                class="control-button bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <i>👑</i>
                {showCustomRoles.size > 0 ? 'Hide' : ''} Role System
              </button>
            </div>
          </div>

          {#if showUserList}
            <div class="user-list bg-gray-900 rounded-lg shadow-lg overflow-hidden p-6">
              <h3 class="text-xl font-semibold mb-4 text-white">User Management</h3>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700">
                  <thead class="bg-gray-800">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-800">
                    {#each users as user}
                      <tr class="bg-gray-900">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="flex items-center">
                            <div class="text-sm font-medium text-gray-200">
                              {user.username || user.email.split('@')[0] || 'No username'}
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="text-sm text-gray-300">{user.email}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.privilege_role}
                            on:change={(e) => handlePrivilegeUpdate(user.id, e.target.value)}
                            disabled={loading}
                            class="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-white
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {#each privilegeRoles as role}
                              <option value={role.name}>{role.display_name}</option>
                            {/each}
                          </select>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div class="flex gap-2">
                            <button
                              on:click={() => toggleCustomRoles(user.id)}
                              class="text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              {showCustomRoles.has(user.id) ? 'Hide' : 'Show'} Custom Roles
                            </button>
                          </div>
                        </td>
                      </tr>
                      {#if showCustomRoles.has(user.id)}
                        <tr>
                          <td colspan="4" class="px-6 py-4 bg-gray-800">
                            <div class="space-y-4">
                              <!-- Subscription Role -->
                              <div class="flex items-center">
                                <span class="text-gray-300 mr-2">Role:</span>
                                <span class="text-gray-200">
                                  {user.privilege_role || 'User'}
                                </span>
                              </div>

                              <!-- Created Custom Roles -->
                              <div class="space-y-4">
                                <h4 class="font-medium text-gray-200">Custom Roles</h4>
                                {#if data.customRoles && Object.keys(data.customRoles).length > 0}
                                  {#each Object.entries(data.customRoles) as [roleName, roleConfig]}
                                    <div class="flex items-center justify-between text-sm border-b border-gray-700 pb-2">
                                      <span class="text-gray-300">{roleConfig.name}:</span>
                                      <div class="flex items-center gap-2">
                                        <select
                                          class="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-white
                                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          on:change={(e) => handleCustomRoleUpdate(user.id, roleConfig.name, e.target.value)}
                                          value={user.custom_roles?.[roleConfig.name] || ''}
                                        >
                                          <option value="">Not assigned</option>
                                          {#each roleConfig.sub_roles || [] as subRole}
                                            <option value={subRole}>{subRole}</option>
                                          {/each}
                                        </select>
                                        <span class="text-xs text-gray-400">
                                          {roleConfig.visible_to_users ? '(Visible to user)' : '(Hidden)'}
                                        </span>
                                      </div>
                                    </div>
                                  {/each}
                                {:else}
                                  <div class="text-sm text-gray-400">No custom roles defined</div>
                                {/if}
                              </div>
                            </div>
                          </td>
                        </tr>
                      {/if}
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}

          {#if showCustomRoles.size > 0}
            <div class="mt-8 control-section">
              <h3 class="text-xl font-semibold mb-4">Role Management</h3>
              <RoleManager {users} />
            </div>
          {/if}
        </div>
      {:else}
        <div class="image-section">
          <img 
            src="https://images.unsplash.com/photo-1737202325171-0f62f8296922?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Decorative background"
            class="fixed-image"
          />
        </div>
      {/if}
    </div>

    <!-- Right Side - Content Management -->
    <div class="content-section">
      <div class="posts-header">
        <h1 class="text-4xl font-bold mb-4 text-white">Content Management</h1>
        <p class="text-xl text-gray-300">Create and manage announcements</p>
      </div>

      <div class="posts-content">
        <div class="post-card">
          <form 
            class="flex flex-col w-full gap-6" 
            on:submit|preventDefault={handleSubmit}
          >
            <div class="announcement-input flex flex-col w-full">
              <label for="announcement" class="block text-lg font-medium text-white mb-3">
                Write Announcement
              </label>
              <textarea
                id="announcement"
                bind:value={userInput}
                placeholder="Write your announcement here..."
                disabled={posterLoading}
                class="w-full p-6 rounded-lg resize-vertical bg-[#1a1a1a] text-white placeholder-gray-400 min-h-[300px] text-base leading-relaxed border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 transition-all duration-200"
                rows="12"
              ></textarea>
              <p class="text-sm text-gray-400 mt-3">
                Write a clear and concise announcement for users.
              </p>
            </div>
            <button
              type="submit"
              disabled={posterLoading || !userInput.trim()}
              class="submit-button bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0"
            >
              {posterLoading ? 'Checking...' : 'Post Announcement'}
            </button>
          </form>
        </div>

        <!-- Posts List -->
        <div class="mt-12">
          <h2 class="text-2xl font-bold mb-6 text-white">Announcement History</h2>
          {#if userPosts.length === 0}
            <p class="text-gray-400 text-center py-8">No announcements yet.</p>
          {:else}
            <div class="posts-grid gap-8">
              {#each userPosts as post}
                <div class="post-card hover:transform hover:-translate-y-1 transition-all duration-200">
                  <div class="post-header mb-6">
                    <div class="avatar bg-blue-600 text-white">
                      {(post.author_username || 'A')[0].toUpperCase()}
                    </div>
                    <div class="post-meta">
                      <span class="author text-white font-medium">@{post.author_username || 'Anonymous'}</span>
                      <span class="date text-gray-400">{new Date(post.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div class="post-content text-gray-200 leading-relaxed bg-[#1a1a1a] p-6 rounded-lg mb-6">
                    {post.content}
                  </div>
                  <div class="status-section">
                    <div class="status-badge {post.status === 'Approved' ? 'approved' : 'rejected'}">
                      {post.status}
                    </div>
                    <p class="text-sm text-gray-400">Reason: {post.approval_reason}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="unauthorized">
      <h1>Unauthorized Access</h1>
      <p>You don't have permission to view this page.</p>
    </div>
  {/if}
</div>

<style>
  .split-container {
    height: 100%;
    width: 100%;
    background: var(--background);
    overflow: hidden;
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    display: flex;
  }

  .left-section {
    width: 50%;
    height: 100%;
    overflow-y: auto;
    padding: 2.5rem;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.1));
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .content-section {
    width: 50%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: #0d0d0d;
    border-left: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .admin-controls {
    background: rgba(15, 15, 15, 0.8);
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    max-width: 800px;
    width: 100%;
    box-sizing: border-box;
  }

  .admin-controls h2 {
    color: #e5e7eb;
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.25rem;
    text-align: center;
    position: relative;
  }

  .admin-controls h2::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 2px;
    background: var(--primary-color);
    border-radius: 2px;
  }

  .admin-controls h3 {
    color: #e5e7eb;
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    text-align: left;
  }

  .control-section {
    background: rgba(20, 20, 20, 0.8);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.05);
    width: 100%;
    box-sizing: border-box;
  }

  .control-section:hover {
    background: rgba(30, 30, 30, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .control-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.25s ease;
    width: 100%;
    text-align: left;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 0.5rem;
    background: rgba(30, 30, 30, 0.8);
    color: #e5e7eb;
    font-size: 0.875rem;
    box-sizing: border-box;
  }

  .control-button:last-child {
    margin-bottom: 0;
  }

  .control-button:hover {
    background: rgba(40, 40, 40, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .control-button:active {
    transform: translateY(0);
    background: rgba(35, 35, 35, 0.9);
  }

  .control-button i {
    font-size: 1rem;
    opacity: 0.9;
  }

  .status-message {
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    text-align: center;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .posts-header {
    position: sticky;
    top: 0;
    background: rgba(10, 10, 10, 0.95);
    padding: 2.5rem 1.5rem 1.5rem;
    z-index: 10;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  }

  .posts-content {
    padding: 1.5rem;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .post-card {
    background: rgba(15, 15, 15, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 1rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .post-card:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }

  .announcement-input {
    width: 100%;
    box-sizing: border-box;
  }

  .announcement-input :global(textarea) {
    font-family: system-ui, -apple-system, sans-serif;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    width: 100%;
    padding: 1rem;
    box-sizing: border-box;
  }

  .submit-button {
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 1rem;
    border: none;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .posts-grid {
    display: flex;
    flex-direction: column;
  }

  .post-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .avatar {
    width: 3rem;
    height: 3rem;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .post-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .post-content {
    line-height: 1.7;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .status-badge {
    padding: 0.5rem 1.25rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .status-badge.approved {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .status-badge.rejected {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  /* Scrollbar styling */
  .content-section::-webkit-scrollbar {
    width: 8px;
  }

  .content-section::-webkit-scrollbar-track {
    background: rgba(10, 10, 10, 0.5);
  }

  .content-section::-webkit-scrollbar-thumb {
    background: rgba(100, 100, 100, 0.5);
    border-radius: 4px;
  }

  .content-section::-webkit-scrollbar-thumb:hover {
    background: rgba(150, 150, 150, 0.5);
  }

  /* Responsive design */
  @media (max-width: 1024px) {
    .split-container {
      flex-direction: column;
      height: 100vh;
      overflow-y: auto;
    }

    .left-section,
    .content-section {
      width: 100%;
      height: auto;
      min-height: auto;
      padding: 2rem;
    }

    .left-section {
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .admin-controls {
      max-width: 100%;
    }
  }

  .user-list {
    max-width: 800px;
    width: 100%;
  }

  /* Add styles for unauthorized access screen */
  .unauthorized {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #0a0a0a;
    color: white;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 50;
  }
  
  /* Fix for image section */
  .image-section {
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .fixed-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>