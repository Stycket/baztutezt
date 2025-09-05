<script>
  export let communityInfo;
</script>

<div class="member-content">
  <h1>{communityInfo?.title || 'Members Area'}</h1>
  <div class="content">
    {@html communityInfo?.content || 'No content available for members'}
  </div>
  
  {#if communityInfo?.dropdown_options?.length > 0}
    <div class="dropdowns">
      {#each communityInfo.dropdown_options as option}
        <details class="dropdown">
          <summary class="dropdown-summary">{option.name}</summary>
          <div class="dropdown-content">{option.text}</div>
        </details>
      {/each}
    </div>
  {/if}
  
  <a href="/appadmin" class="admin-link">Edit Content</a>
</div>

<style>
  .member-content {
    max-width: 800px;
    width: 100%;
    padding: 40px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
  }

  h1 {
    font-size: 2.5rem;
    color: #2c3e50;
    margin-bottom: 1.5rem;
  }

  .content {
    font-size: 1rem;
    line-height: 1.6;
    color: #333;
    margin-bottom: 2rem;
  }

  .dropdowns {
    margin-top: 2rem;
  }

  .dropdown {
    margin: 15px 0;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  .dropdown-summary {
    padding: 15px;
    cursor: pointer;
    font-weight: bold;
    background: rgba(241, 241, 241, 0.9);
    color: #2c3e50;
  }

  .dropdown-content {
    padding: 15px;
    background: rgba(245, 245, 245, 0.8);
    color: #333;
  }

  .admin-link {
    display: inline-block;
    margin-top: 25px;
    padding: 12px 25px;
    background: #4CAF50;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    transition: background 0.3s, transform 0.2s;
  }

  .admin-link:hover {
    background: #45a049;
    transform: translateY(-2px);
  }
</style>