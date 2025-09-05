<script>
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  import { api } from '$lib/utils/api'; 

  // Content types
  let contentTypes = [
    { id: 'loggedIn', label: 'Inloggad Föreningsinfo' },
    { id: 'loggedOut', label: 'Utloggad Föreningsinfo' }
  ];
  let selectedContentType = 'loggedIn'; // Default to logged-in content

  // Form data
  let title = '';
  let content = '';
  let dropdowns = [{ name: '', text: '' }];
  let isEditing = false;
  let currentId = null;
  let isLoading = true;

  // Load data based on selected content type
  async function loadData() {
    if (!$session.user) return; // Ensure user is logged in

    isLoading = true;
    try {
      const response = await fetch(`/api/infocms?type=${selectedContentType}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data) {
          title = data.title || '';
          content = data.content || '';
          dropdowns = data.dropdown_options?.length > 0 
            ? data.dropdown_options 
            : [{ name: '', text: '' }];
          currentId = data.id;
          isEditing = true;
        } else {
          // No existing content found for this type
          resetForm();
        }
      } else {
        console.error('Failed to fetch content:', response.status);
        resetForm();
      }
    } catch (error) {
      console.error('Error loading content:', error);
      resetForm();
    } finally {
      isLoading = false;
    }
  }

  // Reset form to empty state
  function resetForm() {
    title = '';
    content = '';
    dropdowns = [{ name: '', text: '' }];
    currentId = null;
    isEditing = false;
  }

  // Toggle content type
  function toggleContentType(type) {
    selectedContentType = type;
    loadData();
  }

  // Form actions
  function addDropdown() {
    dropdowns = [...dropdowns, { name: '', text: '' }];
  }

  function removeDropdown(index) {
    dropdowns = dropdowns.filter((_, i) => i !== index);
    if (dropdowns.length === 0) addDropdown();
  }

  async function saveData() {
    if (!$session.user) return;

    try {
      const body = {
        title,
        content,
        dropdown_options: dropdowns.filter(d => d.name.trim() || d.text.trim()),
        content_type: selectedContentType,
        visible_to_logged_out: selectedContentType === 'loggedOut'
      };

      const url = currentId ? `/api/infocms/${currentId}` : '/api/infocms';
      
      // Use the api utility instead of fetch directly
      const response = currentId 
        ? await api.put(url, body)
        : await api.post('/api/infocms', body);

      if (!response.ok) {
        throw new Error('Failed to save content');
      }

      const result = await response.json();
      currentId = result.id;
      isEditing = true;
      alert('Content saved successfully!');
      loadData(); // Reload to ensure we have fresh data
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save content');
    }
  }

  // Load initial data
  onMount(() => {
    loadData();
  });

  // Watch for content type changes
  $: if (selectedContentType) {
    loadData();
  }
</script>

<div class="admin-panel">
  <h1>Föreningsinfo Editor</h1>
  
  {#if !$session.user}
    <p class="login-message">Please log in to access admin features</p>
  {:else if isLoading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Loading content...</span>
    </div>
  {:else}
    <div class="content-type-toggle">
      {#each contentTypes as type}
        <button
          class:active={selectedContentType === type.id}
          on:click={() => toggleContentType(type.id)}
        >
          {type.label}
        </button>
      {/each}
    </div>

    <div class="form-group">
      <label for="content-title">Titel</label>
      <input 
        type="text" 
        id="content-title"
        bind:value={title} 
        placeholder="Enter a title for this content section"
      />
    </div>

    <div class="form-group">
      <label for="content-main">Brödtext</label>
      <textarea 
        id="content-main"
        bind:value={content} 
        placeholder="Skriv text här (du kan stylea med HTML med hjälp av GPT)"
        rows="8"
      ></textarea>
      <small class="input-help">Det här är informationen på föreningssidan för {selectedContentType === 'loggedIn' ? 'inloggade' : 'besökare'}.</small>
    </div>

    <h3>Expanderbara sektioner</h3>
    <small class="section-help">Här kan man skapa dropdown knappar med info</small>
    
    {#each dropdowns as dropdown, index (index)}
      <div class="dropdown-group">
        <input 
          type="text" 
          bind:value={dropdown.name} 
          placeholder="Section Title (e.g., 'Membership Fees')" 
        />
        <textarea 
          bind:value={dropdown.text} 
          placeholder="Section Content - Add detailed information here"
          rows="5"
        ></textarea>
        <button on:click={() => removeDropdown(index)}>×</button>
      </div>
    {/each}
    
    <button on:click={addDropdown}>Ny dropdown knapp sektion </button>

    <div class="actions">
      <button on:click={saveData} disabled={isLoading}>
        {isEditing ? 'Uppdatera' : 'Spara'} Tezt
      </button>
      <button on:click={resetForm}>Ta bort allt</button>
    </div>
  {/if}
</div>

<style>
  .admin-panel {
    max-width: 100%;
    margin: 0 auto;
    padding: 0.5rem;
    background-color: transparent;
    border-radius: 8px;
    box-shadow: none;
    overflow: hidden; /* Prevent content overflow */
  }
  
  h1 {
    font-size: 1.8rem;
    margin-bottom: 1.5rem;
    color: var(--text-color);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
    word-break: break-word; /* Handle long titles */
  }
  
  .content-type-toggle {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap; /* Allow wrapping on small screens */
  }
  
  .content-type-toggle button {
    padding: 0.6rem 1.2rem;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-color);
    font-weight: 500;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: all 0.2s ease;
    flex: 1; /* Equal width buttons */
    min-width: 120px; /* Minimum width */
  }
  
  .content-type-toggle button.active {
    background: var(--primary-color);
    color: white;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .content-type-toggle button:hover:not(.active) {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }
  
  .form-group {
    margin-bottom: 1.5rem;
    width: 100%; /* Ensure full width */
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-color);
  }
  
  input[type="text"], textarea {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-family: inherit;
    background-color: rgba(255, 255, 255, 0.2);
    color: var(--text-color);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-sizing: border-box; /* Include padding in width calculation */
  }
  
  input[type="text"]:focus, textarea:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 59, 130, 246), 0.25);
    outline: none;
  }
  
  textarea {
    min-height: 120px;
    resize: vertical;
    line-height: 1.5;
    max-width: 100%; /* Prevent horizontal overflow */
  }
  
  h3 {
    margin: 1.5rem 0 1rem;
    font-weight: 600;
    color: var(--text-color);
    font-size: 1.25rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }
  
  .dropdown-group {
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    padding-top: 4rem;
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    position: relative;
    box-sizing: border-box;
  }
  
  .dropdown-group input {
    margin-bottom: 0.75rem;
  }
  
  .dropdown-group button {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    width: 40px;
    height: 40px;
    margin-bottom: 1rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(244, 67, 54, 0.2);
    color: white;
    border-radius: 8px;
    font-size: 1.5rem;
    font-weight: bold;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(244, 67, 54, 0.3);
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 5;
  }
  
  .dropdown-group button:hover {
    background-color: rgba(244, 67, 54, 0.8);
    transform: scale(1.05);
  }
  
  .dropdown-group input:first-of-type {
    margin-top: 0.5rem;
  }
  
  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    justify-content: flex-end;
    flex-wrap: wrap; /* Allow wrapping on small screens */
  }
  
  button {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    font-size: 0.95rem;
    white-space: nowrap; /* Prevent text wrapping in buttons */
  }

  /* Default button style for adding new dropdown */  
  button:not(.actions button):not(.content-type-toggle button):not(.dropdown-group button) {
    background-color: rgba(255, 255, 255, 0.2);
    color: var(--text-color);
    padding: 0.6rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: fit-content;
    margin: 0.5rem 0 1.5rem;
  }
  
  button:not(.actions button):not(.content-type-toggle button):not(.dropdown-group button):hover {
    background-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }
  
  button:not(.actions button):not(.content-type-toggle button):not(.dropdown-group button)::before {
    content: "+";
    font-weight: bold;
    font-size: 1.2rem;
    line-height: 1;
    margin-right: 0.25rem;
  }
  
  .actions button {
    background-color: var(--primary-color);
    color: white;
    flex: 1; /* Equal width buttons on mobile */
    min-width: 120px; /* Minimum width */
    max-width: 200px; /* Maximum width */
  }
  
  .actions button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .actions button:last-child {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
  }
  
  .actions button:last-child:hover {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  button:disabled {
    background: rgba(204, 204, 204, 0.3);
    cursor: not-allowed;
    color: var(--text-secondary);
    transform: none !important;
    box-shadow: none !important;
  }
  
  .login-message {
    color: #f44336;
    text-align: center;
    padding: 2rem 1rem;
    background-color: rgba(244, 67, 54, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(244, 67, 54, 0.2);
  }
  
  .input-help, .section-help {
    display: block;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.9);
    margin-top: -0.5rem;
    margin-bottom: 1rem;
    font-weight: 500;
    background-color: rgba(0, 0, 0, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
    border-left: 3px solid var(--primary-color);
  }

  .section-help {
    margin-top: -0.5rem;
    margin-bottom: 1.5rem;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 3px solid rgba(var(--primary-rgb, 59, 130, 246), 0.2);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .admin-panel {
      padding: 0;
    }
    
    .actions {
      flex-direction: column;
      align-items: stretch;
    }
    
    .actions button {
      width: 100%;
      max-width: 100%;
    }
    
    .dropdown-group {
      padding: 1.5rem;
      padding-top: 4.5rem;
    }
    
    .dropdown-group button {
      width: 48px;
      height: 48px;
    }
    
    .input-help, .section-help {
      font-size: 0.95rem;
      padding: 0.75rem;
    }
  }
</style>