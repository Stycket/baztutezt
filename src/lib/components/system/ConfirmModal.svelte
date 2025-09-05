<script>
  import { slide } from 'svelte/transition';
  
  export let show = false;
  export let message = '';
  export let onConfirm;
  export let onCancel;
</script>

<div 
  class="modal-overlay"
  class:show
  transition:slide={{ duration: 100 }}
>
  <div class="modal-content">
    <p>{message}</p>
    <div class="modal-actions">
      <button 
        class="cancel-button"
        on:click={onCancel}
      >
        Cancel
      </button>
      <button 
        class="confirm-button"
        on:click={onConfirm}
      >
        Remove
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-content {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    width: 90%;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .cancel-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--card-bg);
  }

  .confirm-button {
    padding: 0.5rem 1rem;
    background: var(--error-color, #dc2626);
    color: white;
    border: none;
    border-radius: 0.5rem;
  }
</style> 