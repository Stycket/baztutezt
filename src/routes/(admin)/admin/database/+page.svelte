<script>
  import { session } from '$lib/stores';
  
  async function resetDatabase() {
    try {
      const response = await fetch('/api/postgres-database/reset-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add CSRF token from session
          'x-csrf-token': $session?.csrf_token
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset database');
      }

      alert('Database reset successful');
    } catch (error) {
      console.error('Error resetting database:', error);
      alert('Failed to reset database: ' + error.message);
    }
  }
</script>

<div class="admin-section">
  <h2>Database Management</h2>
  
  <div class="warning-box">
    <h3>⚠️ Warning</h3>
    <p>Resetting the database will delete all data. This action cannot be undone.</p>
  </div>

  <button 
    class="danger-button" 
    on:click={() => {
      if (confirm('Are you sure you want to reset the database? This cannot be undone!')) {
        resetDatabase();
      }
    }}
  >
    Reset Database
  </button>
</div>

<style>
  .admin-section {
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .warning-box {
    background-color: #fff3cd;
    border: 1px solid #ffeeba;
    color: #856404;
    padding: 1rem;
    border-radius: 0.25rem;
    margin-bottom: 1rem;
  }

  .danger-button {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .danger-button:hover {
    background-color: #c82333;
  }
</style> 