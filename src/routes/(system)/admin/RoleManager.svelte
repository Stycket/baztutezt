<script>
  import { PUBLIC_CONFIG } from '$lib/constants';
  import { onMount } from 'svelte';
  import { api } from '$lib/utils/api';
  
  export let data;
  let showRoleSystem = false;
  let editingRole = null;
  let newRoleName = '';
  let newSubRoles = [''];
  let isVisibleToUsers = false;
  let error = null;
  let success = null;
  let loading = false;
  let customRoles = {};
  
  // Change from Map to object for better reactivity
  let editingSubRoles = {};

  onMount(async () => {
    await loadCustomRoles();
  });

  async function loadCustomRoles() {
    try {
      console.log("Fetching custom roles...");
      loading = true;
      const response = await api.get('/api/admin/get-custom-roles');
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(`Failed to load custom roles: ${errorData.error}`);
      }
      
      const data = await response.json();
      console.log("Received data:", data);
      
      if (!data.roles) {
        console.error("No roles property in response data:", data);
        throw new Error('Invalid response format');
      }
      
      customRoles = data.roles.reduce((acc, role) => {
        acc[role.name] = role;
        return acc;
      }, {});
      
      console.log("Processed custom roles:", customRoles);
    } catch (err) {
      console.error('Error loading custom roles:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function toggleVisibility(roleName, currentVisibility) {
    try {
      loading = true;
      error = null;
      success = null;
      
      const response = await api.patch('/api/admin/role_action', {
        roleName,
        action: 'toggle_visibility',
        isVisibleToUsers: !currentVisibility
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update visibility: ${errorData.error}`);
      }
      
      // Update local state
      customRoles[roleName].visible_to_users = !currentVisibility;
      success = `Visibility for ${roleName} updated successfully`;
      
      // Reload roles to ensure everything is in sync
      await loadCustomRoles();
    } catch (err) {
      console.error('Error toggling visibility:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function toggleRoleSystem() {
    showRoleSystem = !showRoleSystem;
    if (showRoleSystem) {
      loadCustomRoles();
    }
  }

  function addNewSubRole() {
    newSubRoles = [...newSubRoles, ''];
  }

  function removeSubRole(index) {
    newSubRoles = newSubRoles.filter((_, i) => i !== index);
  }

  function updateSubRole(index, value) {
    newSubRoles = newSubRoles.map((role, i) => i === index ? value : role);
  }
  
  async function deleteRole(roleName) {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      loading = true;
      error = null;
      success = null;
      
      const response = await api.post('/api/admin/delete-custom-role', { roleName });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete role');
      }
      
      success = `Role "${roleName}" deleted successfully`;
      
      // Remove from local state
      delete customRoles[roleName];
      customRoles = {...customRoles}; // Trigger reactivity
      
      await loadCustomRoles(); // Refresh the list
    } catch (err) {
      console.error('Error deleting role:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function createRole() {
    try {
      loading = true;
      error = null;
      success = null;
      
      // Validate inputs
      if (!newRoleName.trim()) {
        throw new Error('Role name is required');
      }
      
      // Filter out empty sub-roles
      const filteredSubRoles = newSubRoles.filter(sr => sr.trim());
      
      const roleData = {
        roleName: newRoleName.trim(),
        subRoles: filteredSubRoles,
        isVisibleToUsers: isVisibleToUsers
      };
      
      // Use api.post instead of fetch
      const response = await api.post('/api/admin/create-role', roleData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create role');
      }
      
      success = `Role "${newRoleName}" created successfully`;
      
      // Reset form
      newRoleName = '';
      newSubRoles = [''];
      isVisibleToUsers = false;
      
      await loadCustomRoles(); // Refresh the list
    } catch (err) {
      console.error('Error creating role:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="mb-6">
  <button 
    on:click={toggleRoleSystem}
    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
  >
    {showRoleSystem ? 'Hide' : 'Show'} Role System
  </button>
</div>

{#if showRoleSystem}
  <div class="roles-container">
    <div class="content-wrapper">
      <h3 class="text-xl font-semibold mt-8 mb-4 text-white">Existing Custom Roles</h3>
      
      {#if loading}
        <p class="text-gray-400">Loading roles...</p>
      {:else if Object.keys(customRoles).length === 0}
        <p class="text-gray-400">No custom roles found.</p>
      {:else}
        <div class="roles-grid">
          {#each Object.values(customRoles) as role (role.name)}
            <div class="role-card">
              <div class="flex justify-between items-start">
                <h4 class="text-lg font-medium text-white">{role.name}</h4>
                <div class="flex space-x-2">
                  <button 
                    on:click={() => toggleVisibility(role.name, role.visible_to_users)}
                    class="action-button"
                    title={role.visible_to_users ? "Make hidden" : "Make visible"}
                  >
                    {#if role.visible_to_users}
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                      </svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    {/if}
                  </button>
                  
                  <button 
                    on:click={() => deleteRole(role.name)}
                    class="action-button"
                    title="Delete role"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <p class="text-sm mt-2 text-gray-300">
                <span class="font-medium text-gray-200">Sub Roles:</span> 
                {#if role.sub_roles && role.sub_roles.length > 0}
                  {role.sub_roles.join(', ')}
                {:else}
                  <span class="text-gray-500">None</span>
                {/if}
              </p>
              
              <p class="text-sm mt-1">
                <span class="font-medium text-gray-200">Visibility:</span> 
                <span class={role.visible_to_users ? 'text-green-400' : 'text-red-400'}>
                  {role.visible_to_users ? 'Visible to Users' : 'Hidden'}
                </span>
                {#if role.source}
                  <span class="ml-2 text-xs text-gray-500">(Source: {role.source})</span>
                {/if}
              </p>
            </div>
          {/each}
        </div>
      {/if}
      
      <div class="form-section">
        <h3 class="text-xl font-semibold mb-4 text-white">Create New Role</h3>
        
        {#if error}
          <div class="error-message">
            <p>{error}</p>
          </div>
        {/if}
        
        {#if success}
          <div class="success-message">
            <p>{success}</p>
          </div>
        {/if}
        
        <div class="space-y-4">
          <div class="form-group">
            <label for="roleName" class="block text-sm font-medium text-gray-200 mb-1">Role Name</label>
            <input 
              type="text" 
              id="roleName" 
              bind:value={newRoleName} 
              class="input-field"
            />
          </div>
          
          <div class="form-group">
            <label class="block text-sm font-medium text-gray-200 mb-1">Sub Roles</label>
            {#each newSubRoles as subRole, i}
              <div class="flex items-center mb-2">
                <input 
                  type="text" 
                  bind:value={newSubRoles[i]} 
                  on:input={(e) => updateSubRole(i, e.target.value)}
                  class="input-field flex-1"
                />
                <button 
                  on:click={() => removeSubRole(i)}
                  class="remove-button ml-2"
                >
                  <span class="text-red-400">Remove</span>
                </button>
              </div>
            {/each}
            <button 
              on:click={addNewSubRole}
              class="add-button"
            >
              Add Sub Role
            </button>
          </div>
          
          <div class="flex items-center">
            <input 
              type="checkbox" 
              id="visibleToUsers" 
              bind:checked={isVisibleToUsers} 
              class="checkbox"
            />
            <label for="visibleToUsers" class="ml-2 block text-sm text-gray-200">
              Visible to users
            </label>
          </div>
          
          <button 
            on:click={createRole}
            disabled={loading}
            class="submit-button"
          >
            {loading ? 'Creating...' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 

<style>
  .roles-container {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 0 1rem;
  }

  .content-wrapper {
    width: 100%;
    max-width: 768px;
  }

  .roles-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    width: 100%;
  }

  .form-section {
    width: 100%;
    margin-top: 2rem;
  }

  .role-card {
    background: rgba(25, 25, 25, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0.75rem;
    padding: 1rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    width: 100%;
    box-sizing: border-box;
  }

  .role-card:hover {
    background: rgba(30, 30, 30, 0.95);
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
  }

  .action-button {
    padding: 0.375rem;
    border-radius: 0.5rem;
    background: rgba(45, 45, 45, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .action-button:hover {
    background: rgba(55, 55, 55, 0.95);
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .error-message,
  .success-message {
    width: 100%;
    margin: 1rem 0;
    padding: 1rem;
    border-radius: 0.5rem;
    box-sizing: border-box;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .form-group {
    background: rgba(30, 30, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0.75rem;
    padding: 1rem;
    margin-bottom: 1rem;
    width: 100%;
    box-sizing: border-box;
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: #e5e7eb;
    transition: all 0.2s ease;
  }

  .input-field:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
  }

  .checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(20, 20, 20, 0.95);
    cursor: pointer;
  }

  .remove-button {
    padding: 0.5rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .remove-button:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .add-button {
    padding: 0.5rem 1rem;
    background: rgba(59, 130, 246, 0.1);
    color: rgb(59, 130, 246);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    margin-top: 0.5rem;
    display: inline-flex;
    align-items: center;
  }

  .add-button:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
    background: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .submit-button:hover:not(:disabled) {
    background: rgb(37, 99, 235);
    transform: translateY(-1px);
  }

  .submit-button:disabled {
    background: rgba(59, 130, 246, 0.5);
    cursor: not-allowed;
  }
</style> 