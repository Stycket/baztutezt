<script>
import { slide } from 'svelte/transition';
import { debugStore, addDebugLog, session } from '$lib/stores';
  
  let isOpen = false;
  let expandedLogs = new Set();
  
  function toggleTerminal() {
    isOpen = !isOpen;
  }

  function toggleLog(timestamp) {
    if (expandedLogs.has(timestamp)) {
      expandedLogs.delete(timestamp);
    } else {
      expandedLogs.add(timestamp);
    }
    expandedLogs = expandedLogs;
  }

  function clearLogs() {
    debugStore.set([]);
    expandedLogs.clear();
    expandedLogs = expandedLogs;
  }

  $: {
    if ($session?.user) {
      addDebugLog({
        type: 'profile_menu_check',
        message: 'Checking admin privileges',
        data: {
          privilege_role: $session.user.privilege_role,
          user: $session.user
        }
      });
    }
  }
</script>

<div class="fixed left-0 right-0 top-16 z-40">
  <button 
    class="debug-toggle"
    on:click={toggleTerminal}
  >
    <span class="text-sm font-mono flex items-center w-full px-4">
      <span class="flex-1 text-left">Debug Console ({$debugStore.length})</span>
      <span>{isOpen ? '▼' : '▲'}</span>
    </span>
  </button>
  
  {#if isOpen}
    <div 
      transition:slide
      class="terminal-window"
    >
      <div class="terminal-header">
        <h3 class="text-white font-mono text-sm">Debug Logs</h3>
        <button 
          class="clear-button"
          on:click={clearLogs}
        >
          clear
        </button>
      </div>
      
      <div class="terminal-content">
        {#each $debugStore as log}
          <div class="log-entry">
            <button 
              class="log-toggle"
              on:click={() => toggleLog(log.timestamp)}
            >
              <span class="mr-2">{expandedLogs.has(log.timestamp) ? '▼' : '▶'}</span>
              <span class="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span class="log-type">{log.content.type}</span>
            </button>
            
            {#if expandedLogs.has(log.timestamp)}
              <div class="log-details" transition:slide>
                <pre>{JSON.stringify(log.content, null, 2)}</pre>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-toggle {
    width: 100%;
    height: 20px;
    background-color: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(8px);
    color: #94a3b8;
    border-top: 1px solid #374151;
    border-bottom: 1px solid #374151;
    font-size: 0.75rem;
    transition: color 0.2s;
    text-align: left;
  }

  .debug-toggle:hover {
    color: #e2e8f0;
  }

  .terminal-window {
    background-color: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(8px);
    height: 320px;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid #374151;
  }

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: rgba(31, 41, 55, 0.95);
    border-bottom: 1px solid #374151;
  }

  .clear-button {
    color: #94a3b8;
    font-size: 0.75rem;
    font-family: monospace;
    padding: 0.25rem 0.5rem;
    transition: color 0.2s;
  }

  .clear-button:hover {
    color: #ef4444;
  }

  .terminal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    font-family: monospace;
    font-size: 0.875rem;
  }

  .log-entry {
    margin-bottom: 0.25rem;
  }

  .log-toggle {
    width: 100%;
    text-align: left;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    color: #e5e7eb;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;  background-color: rgba(15, 23, 42, 0.3);
  }

  .log-toggle:hover {
    background-color: rgba(55, 65, 81, 0.5);
  }

  .timestamp {
    color: #64748b;
    margin-right: 0.5rem;  background-color: rgba(15, 23, 42, 0.3);
  }

  .log-type {
    color: #fbbf24;
  }

  .log-details {
    padding: 0.5rem 1rem 0.5rem 2rem;
    color: #cbd5e1;
    white-space: pre-wrap;
    overflow-x: auto;
    background-color: rgba(15, 23, 42, 0.3);
    border-radius: 0.25rem;
    margin-top: 0.25rem;
  }

  pre {
    margin: 0;
    color: #94a3b8;
  }

  /* Scrollbar Styles */
  .terminal-content::-webkit-scrollbar {
    width: 8px;
  }

  .terminal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .terminal-content::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 4px;
  }

  .terminal-content {
    scrollbar-width: thin;
    scrollbar-color: #4b5563 transparent;
  }
</style> 