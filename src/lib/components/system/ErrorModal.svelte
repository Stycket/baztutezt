<script>
  export let errorMessage = '';
  export let onClose = () => {};
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
    <div class="text-red-600 mb-4">
      <h3 class="text-lg font-semibold">Error</h3>
      <p>{errorMessage}</p>
    </div>
    <button 
      class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      on:click={onClose}
    >
      Close
    </button>
  </div>
</div> 