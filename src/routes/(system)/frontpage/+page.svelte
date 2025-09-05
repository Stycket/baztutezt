<script>
    import { onMount } from 'svelte';
    import { session } from '$lib/stores';
    import { goto } from '$app/navigation';
    import { api } from '$lib/utils/api';
    
    let posts = [];
    let loading = true;
  
    async function loadPosts() {
      try {
        console.log('Attempting to load admin posts for frontpage...');
        
        // Wait for session to be fully loaded with CSRF token
        if (!$session?.csrf_token) {
          console.log('Waiting for session with CSRF token...');
          await new Promise(resolve => {
            const unsubscribe = session.subscribe(value => {
              if (value?.csrf_token) {
                console.log('Session with CSRF token received:', value.csrf_token);
                unsubscribe();
                resolve();
              }
            });
          });
        }
        
        // Now make the API call when we know we have the CSRF token
        const response = await api('/api/posts', {
          method: 'POST',
          headers: {
            'X-Post-Type': 'admin'
          },
          body: JSON.stringify({}) // Empty object as body
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response from posts API:', errorData);
          throw new Error('Failed to load posts: ' + (errorData.error || response.statusText));
        }
        
        posts = await response.json() || [];
        console.log('Frontpage admin announcements loaded:', posts);
      } catch (error) {
        console.error('Error loading frontpage posts:', error);
        posts = []; // Ensure posts is always an array
      } finally {
        loading = false;
      }
    }
  
    // When the component mounts, load posts
    onMount(() => {
      loadPosts();
    });
  
    function formatDate(date) {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Navigation functions for buttons
    function navigateToBooking() {
      goto('/bookingsystem');
    }
    
    function navigateToForening() {
      goto('/forening');
    }
</script>

<div class="container">
  <div 
    class="background-image" 
    style="background-image: url('https://i.ibb.co/j9YNYWRD/491650039-9127638347340818-3051171191529398547-n.jpg');"
  ></div>
  <div class="gradient-overlay"></div>

  <div class="content-wrapper">
    <!-- Hero Content -->
    <div class="hero-content">
      <h1 class="hero-title"><span style="color: antiquewhite;">GBBF</span> 🪵🔥🌊🏡🌲<br>Välkommen att boka</h1>
      <p class="hero-subtitle"></p>
      <div class="cta-buttons">
        <button class="cta-button primary" on:click={navigateToBooking}>Boka</button>
        <button class="cta-button secondary" on:click={navigateToForening}>Förening</button>
      </div>
    </div>

    <!-- Posts Section -->
    <div class="posts-container">
      <div class="glass-panel">
        <h2 class="section-title">Information</h2>
        
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
          </div>
        {:else if posts.length === 0}
          <div class="empty-state">
            <p>No updates available.</p>
          </div>
        {:else}
          <div class="posts-grid">
            {#each posts as post (post.id)}
              <div class="post-card">
                <div class="post-header">
                  <div class="avatar">
                    {post.author_username[0].toUpperCase()}
                  </div>
                  <div class="post-meta">
                    <span class="author">@{post.author_username}</span>
                    <span class="date">{formatDate(post.created_at)}</span>
                  </div>
                </div>
                <div class="post-content">
                  {post.content}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .container {
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background-size: cover;
    background-position: center;
    z-index: -2;
  }

  .gradient-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%);
    z-index: -1;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    box-sizing: border-box;
  }

  .hero-content {
    position: relative;
    color: rgba(255, 255, 255, 0.95);
    max-width: 600px;
    z-index: 1;
    pointer-events: auto;
    backdrop-filter: blur(8px);
    background: rgba(0, 0, 0, 0.2);
    padding: 2rem;
    border-radius: 1rem;
    margin: 1rem 0;
    width: 100%;
  }

  .hero-title {
    font-size: 2.7rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.95);
  }

  .hero-subtitle {
    font-size: 1.5rem;
    opacity: 0.9;
    line-height: 1.6;
    margin-bottom: 2rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.85);
  }

  .cta-buttons {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .cta-button {
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(51, 41, 39, 0.9);
  }

  .cta-button.primary {
    background: rgba(34, 84, 61, 0.8);
    color: rgba(255, 255, 255, 0.95);
  }

  .cta-button.primary:hover {
    background: rgba(34, 84, 61, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .cta-button.secondary {
    background: rgba(75, 85, 99, 0.8);
    color: rgba(255, 255, 255, 0.95);
  }

  .cta-button.secondary:hover {
    background: rgba(75, 85, 99, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .posts-container {
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 0;
    padding: 0;
  }

  .glass-panel {
    background: rgba(24, 24, 24, 0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    margin-bottom: 1rem;
    width: 100%;
    box-sizing: border-box;
  }

  .section-title {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 2rem;
    color: rgba(255, 255, 255, 0.95);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }

  .posts-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .post-card {
    background: rgba(32, 32, 32, 0.15);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1.25rem;
    transition: transform 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
  }

  .post-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    background: rgba(32, 32, 32, 0.55);
  }

  .post-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .avatar {
    width: 3rem;
    height: 3rem;
    border-radius: 9999px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    color: white;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .post-meta {
    display: flex;
    flex-direction: column;
  }

  .author {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .date {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .post-content {
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-state, .empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    color: rgba(255, 255, 255, 0.95);
  }

  /* Scrollbar styling */
  .posts-container::-webkit-scrollbar {
    width: 8px;
  }

  .posts-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  .posts-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }

  .posts-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
  }

  /* Media queries for responsive design */
  @media (min-width: 1024px) {
    .content-wrapper {
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      gap: 2rem;
    }
    
    .hero-content, .posts-container {
      flex: 1 1 calc(50% - 1rem);
      max-width: calc(50% - 1rem);
      margin: 1rem 0;
      box-sizing: border-box;
    }
    
    .posts-container {
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .glass-panel {
      height: 100%;
      max-height: 80vh;
      overflow-y: auto;
    }
  }
  
  @media (max-width: 768px) {
    .content-wrapper {
      padding: 1rem;
      width: 100%;
      box-sizing: border-box;
    }
    
    .hero-content {
      padding: 1.5rem;
      margin: 1rem 0;
      width: 100%;
      box-sizing: border-box;
    }
    
    .posts-container {
      width: 100%;
      padding: 0;
      box-sizing: border-box;
    }
    
    .hero-title {
      font-size: 2.2rem;
    }
    
    .hero-subtitle {
      font-size: 1.2rem;
    }
    
    .cta-button {
      padding: 0.8rem 1.5rem;
      font-size: 1rem;
    }
  }
  
  @media (max-width: 480px) {
    .content-wrapper {
      padding: 0.75rem;
    }
    
    .hero-content {
      padding: 1.25rem;
      margin: 0.5rem 0;
    }
    
    .glass-panel {
      padding: 1.25rem;
      border-radius: 1rem;
    }
    
    .hero-title {
      font-size: 1.6rem;
      margin-bottom: 1rem;
    }
    
    .post-card {
      padding: 1rem;
    }
    
    .cta-buttons {
      flex-direction: column;
      width: 100%;
    }
    
    .cta-button {
      width: 100%;
      text-align: center;
    }
    
    .section-title {
      font-size: 1.5rem;
    }
  }
</style>