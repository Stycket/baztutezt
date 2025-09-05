<script>
  import { goto } from '$app/navigation';
  
  export let onContinueAsGuest;
  export let onClose;
  
  let email = '';
  let error = '';

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleGuestCheckout() {
    if (!validateEmail(email)) {
      error = 'Please enter a valid email address';
      return;
    }
    onContinueAsGuest(email);
  }
</script>

<div class="modal-backdrop">
  <div class="modal">
    <h2>Create an Account?</h2>
    <p>Would you like to create an account to track your purchases?</p>
    
    <div class="buttons">
      <button 
        class="register"
        on:click={() => goto('/register')}
      >
        Create Account
      </button>
      
      <div class="guest-checkout">
        <input
          type="email"
          bind:value={email}
          placeholder="Enter your email to continue as guest"
        />
        {#if error}
          <span class="error">{error}</span>
        {/if}
        <button on:click={handleGuestCheckout}>
          Continue as Guest
        </button>
      </div>
      
      <button class="cancel" on:click={onClose}>
        Cancel
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    padding: 2rem;
    border-radius: 0.5rem;
    max-width: 500px;
    width: 90%;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .guest-checkout {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .error {
    color: red;
    font-size: 0.875rem;
  }
</style> 