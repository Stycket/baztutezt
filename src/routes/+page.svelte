<script>
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  import { configStore } from '$lib/stores/configStore';
  import { browser } from '$app/environment';
  
  let loading = true;

  onMount(async () => {
    if (browser) {
      if (!$configStore.loaded) {
        await new Promise(resolve => {
          const unsubscribe = configStore.subscribe(config => {
            if (config.loaded) {
              unsubscribe();
              resolve();
            }
          });
        });
      }
      loading = false;
    }
  });
</script>

<div class="page-wrapper">
  <div class="background-image">
    <div class="dark-overlay"></div>
  </div>
  
  <div class="header-text">
    <h1>Gråbo Bad och Bastu Förening <br> 🪵🔥🌊🏡🌲</h1>
  </div>
  
  <div class="content-container">
    {#if loading}
      <div class="loading-container">
        <div class="spinner"></div>
      </div>
    {:else}
      <main class="main-content">
        <div class="welcome-container">
          <h1 class="title">Välkommen till Föreningen 🌲</h1>
        </div>
        
        <div class="card-container">
          <div class="card">
            <h2 class="subtitle">Vill du veta mer om föreningen?</h2>
            <p>Vi är en gemenskap av bastuälskare som strävar efter att främja hälsa och välbefinnande genom bastubad. Gå med oss för att njuta av avkoppling och social samvaro.</p>
            <a href="/forening" class="cta-button primary">Gå till Föreningen</a>
          </div>
          
          <div class="card">
            <h2 class="subtitle">Kontakta Oss</h2>
            <p>Du kan kontakta oss genom vår facebook grupp.</p>
            
          </div>
        </div>
      </main>
    {/if}
  </div>
</div>

<style>
  :global(html), :global(body) {
    height: 100%;
    margin: 0;
    padding: 0;
    font-family: 'Arial', sans-serif;
    color: #fff;
    overflow-x: hidden;
  }

  .page-wrapper {
    min-height: 100vh;
    width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0;
    box-sizing: border-box;
 bottom:155px;
  }

  .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('https://i.ibb.co/vC737sh0/480562629-10160471897437540-8797408155310197330-n.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: -1;
  }

  .dark-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 0;
  }

  .header-text {
    width: 100%;
    max-width: 1000px;
    text-align: left;
    margin: 0;
    padding-top: 10rem;
    color: #fff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 1;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    box-sizing: border-box;
  }

  .header-text h1 {
    font-size: 1.5rem;
    font-weight: 500;
    margin: 0;
    padding: 0.5rem 0;
    line-height: 1.3;
  }

  .content-container {
    width: 100%;
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1;
    padding: 0 0.5rem;
    box-sizing: border-box;
  }

  .main-content {
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    padding: 1.25rem;
    width: 100%;
    text-align: center;
    box-sizing: border-box;
    margin-top: 0.5rem;
   
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100px;
    width: 100%;
  }

  .spinner {
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .welcome-container {
    margin-bottom: 1.5rem;
  }

  .title {
    font-size: 1.8rem;
    margin-bottom: 1rem;
    color: #2c3e50;
    line-height: 1.2;
  }

  .card-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    width: 100%;
  }

  .card {
    background: rgba(255, 255, 255, 0.95);
    padding: 1.25rem 1rem;
    border-radius: 10px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .subtitle {
    font-size: 1.3rem;
    margin: 0.5rem 0 1rem;
    color: #3498db;
    line-height: 1.2;
  }

  .card p {
    margin-bottom: 1.2rem;
    line-height: 1.5;
    color: #555;
    font-size: 0.95rem;
  }

  .cta-button {
    display: inline-block;
    padding: 0.7rem 1rem;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    text-decoration: none;
    margin-top: auto;
    width: 100%;
    max-width: 250px;
    box-sizing: border-box;
  }

  .cta-button.primary {
    background: #3498db;
    color: white;
    border: 2px solid #3498db;
  }

  .cta-button.secondary {
    background: #7f8c8d;
    color: white;
    border: 2px solid #7f8c8d;
  }

  /* Media Queries for Larger Screens */
  @media (min-width: 481px) {
    .page-wrapper {
      padding: 20px;
      justify-content: center;
    }
    
    .header-text {
      padding-top: 6rem;
      padding-left: 20px;
      padding-right: 20px;
    }
    
    .content-container {
      padding: 0 20px;
    }

    .header-text h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .main-content {
      padding: 2rem;
    }

    .title {
      font-size: 2rem;
    }

    .card-container {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    .card {
      padding: 1.5rem;
    }

    .subtitle {
      font-size: 1.4rem;
    }

    .card p {
      font-size: 1rem;
    }

    .cta-button {
      padding: 0.8rem 1.5rem;
      width: fit-content;
    }
  }

  @media (min-width: 769px) {
    .header-text h1 {
      font-size: 2.2rem;
    }

    .title {
      font-size: 2.5rem;
    }

    .card {
      padding: 2rem;
    }
  }
</style>