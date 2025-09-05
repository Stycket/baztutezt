<script>
  export let communityInfo; // Ensure this line is present to accept the prop
  // Any necessary script logic can go here
</script>

<div class="content">
  <h1>{communityInfo?.title || 'Welcome to the Community'}</h1>
  <p>{communityInfo?.content || 'No content available for non-members.'}</p>
  
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
  
  <a href="#" class="button">Medlemskap</a>
</div>

<style>
  .content {
    max-width: 800px;
    width: 100%;
    padding: 25px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
  }

  @media (min-width: 768px) {
    .content {
      padding: 40px;
    }
  }

  h1 {
    font-size: 2.5rem;
    color: #2c3e50;
    margin-bottom: 1.5rem;
  }

  p {
    font-size: 1rem;
    line-height: 1.6;
    color: #333;
    margin-bottom: 1.5rem;
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

  .button {
    display: inline-block;
    margin-top: 10px;
    padding: 12px 25px;
    background-color: #3a3c3d;
    color: white;
    border: none;
    border-radius: 6px;
    text-decoration: none;
    font-weight: bold;
    transition: background-color 0.3s, transform 0.2s;
  }

  .button:hover {
    background-color: #2980b9;
    transform: translateY(-2px);
  }
</style>
