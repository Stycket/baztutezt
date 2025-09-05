<script>
  import { slide, fade } from 'svelte/transition';
  import { cart } from '$lib/stores/cart';
  import { goto } from '$app/navigation';
  import ConfirmModal from './ConfirmModal.svelte';
  
  export let show = false;
  
  let showConfirmModal = false;
  let itemToRemove = null;
  
  $: total = $cart.reduce((sum, item) => sum + (item.unit_amount * item.quantity), 0);

  function handleCheckout() {
    goto('/cart');
  }

  function updateQuantity(item, change) {
    const newQuantity = Math.max(1, Math.min(item.quantity + change, item.maxQuantity || 99));
    cart.updateQuantity(item.price_id, newQuantity);
  }

  function confirmRemove(item) {
    itemToRemove = item;
    showConfirmModal = true;
  }

  function handleRemoveConfirm() {
    if (itemToRemove) {
      cart.removeItem(itemToRemove.price_id);
    }
    showConfirmModal = false;
    itemToRemove = null;
  }

  function handleRemoveCancel() {
    showConfirmModal = false;
    itemToRemove = null;
  }

  function handleViewCart() {
    goto('/cart');
  }
  
  function removeItem(id) {
    cart.removeItem(id);
  }
</script>

{#if showConfirmModal}
  <ConfirmModal
    show={showConfirmModal}
    message={`Remove ${itemToRemove?.name} from cart?`}
    onConfirm={handleRemoveConfirm}
    onCancel={handleRemoveCancel}
  />
{/if}

<div 
  class="cart-preview-container"
  role="menu"
  style="visibility: {show ? 'visible' : 'hidden'}"
>
  {#if show}
    <div 
      class="cart-preview"
      transition:slide|local={{ duration: 150 }}
    >
      <div class="cart-preview-header">
        <div class="cart-preview-label">Cart Items</div>
      </div>
      
      {#if $cart.length === 0}
        <div class="cart-empty">Cart is empty</div>
      {:else}
        <div class="cart-preview-items">
          {#each $cart as item (item.id)}
            <div class="cart-item">
              <div class="item-image">
                {#if item.image}
                  <img 
                    src={item.image} 
                    alt={item.name}
                  />
                {:else}
                  <div class="image-placeholder">
                    <span>{item.name.charAt(0)}</span>
                  </div>
                {/if}
              </div>
              <div class="item-details">
                <div class="item-name">{item.name}</div>
                <div class="item-price">${(item.unit_amount / 100).toFixed(2)}</div>
              </div>
              <div class="quantity-controls">
                <button 
                  class="quantity-btn"
                  on:click={() => updateQuantity(item, -1)}
                  disabled={item.quantity <= 1}
                >
                  -
                </button>
                <span class="quantity-display">{item.quantity}</span>
                <button 
                  class="quantity-btn"
                  on:click={() => updateQuantity(item, 1)}
                  disabled={item.quantity >= (item.maxQuantity || 99)}
                >
                  +
                </button>
              </div>
              <button 
                class="remove-btn"
                on:click={() => confirmRemove(item)}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
        <div class="cart-preview-footer">
          <div class="cart-total">
            <span>Total:</span>
            <span>${(total / 100).toFixed(2)}</span>
          </div>
          <button 
            class="checkout-button"
            on:click={handleCheckout}
          >
            Go to Checkout
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cart-preview-container {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 320px;
    z-index: 40;
  }

  .cart-preview {
    position: relative;
    width: 100%;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 85vh;
  }

  .cart-preview-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .cart-preview-items {
    overflow-y: auto;
    flex-grow: 1;
    max-height: 400px;
    scrollbar-gutter: stable;
    opacity: 0;
    animation: fadeIn 0.15s ease-out forwards 0.15s;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* For Webkit browsers */
  .cart-preview-items::-webkit-scrollbar {
    width: 8px;
  }

  .cart-preview-items::-webkit-scrollbar-track {
    background: transparent;
  }

  .cart-preview-items::-webkit-scrollbar-thumb {
    background-color: var(--gray-300);
    border-radius: 4px;
  }

  /* For Firefox */
  .cart-preview-items {
    scrollbar-width: thin;
    scrollbar-color: var(--gray-300) transparent;
  }

  .cart-preview-footer {
    border-top: 1px solid var(--border-color);
    background: var(--card-bg);
    flex-shrink: 0;
  }

  .cart-preview-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gray-500);
    font-weight: 500;
  }

  .cart-item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
  }

  .cart-item-content {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .cart-item-image {
    width: 48px;
    height: 48px;
    border-radius: 0.375rem;
    object-fit: cover;
    border: 1px solid var(--border-color);
  }

  .cart-item-details {
    flex: 1;
    min-width: 0;
  }

  .cart-item-name {
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cart-item-price {
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .quantity-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .quantity-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
    color: var(--gray-700);
  }

  .quantity-btn:hover:not(:disabled) {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .quantity-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quantity-display {
    min-width: 24px;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-color);
  }

  .cart-total {
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    font-weight: 500;
    background: var(--gray-50);
  }

  .cart-empty {
    padding: 1rem;
    text-align: center;
    color: var(--gray-500);
  }

  .checkout-button {
    width: calc(100% - 2rem);
    margin: 1rem;
    padding: 0.75rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.2s;
  }

  .checkout-button:hover {
    background: var(--primary-color-dark, #4a5568);
    transform: translateY(-1px);
  }

  .checkout-button:active {
    transform: translateY(0);
  }

  .remove-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    color: var(--gray-500);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .remove-btn:hover {
    color: var(--error-color, #dc2626);
    border-color: var(--error-color, #dc2626);
  }

  .cart-item {
    position: relative;
  }

  .item-image {
    width: 40px;
    height: 40px;
    border-radius: 0.25rem;
    overflow: hidden;
    margin-right: 0.75rem;
    background: #f3f4f6;
  }
  
  .item-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e5e7eb;
    color: #6b7280;
    font-weight: bold;
  }
  
  .item-details {
    flex: 1;
  }
  
  .item-name {
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }
  
  .item-price {
    font-size: 0.75rem;
    color: #6b7280;
  }
</style> 