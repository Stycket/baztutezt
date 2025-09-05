<script>
  import { createEventDispatcher } from 'svelte';
  import MarkdownContent from './MarkdownContent.svelte';
  import { formatDate } from '$lib/utils';
  
  export let post;
  
  const dispatch = createEventDispatcher();
  
  // Function to handle post click (navigate to post detail page)
  function handlePostClick(event) {
    // Prevent navigation if user is selecting text or clicking links
    if (window.getSelection().toString() || 
        event.target.tagName === 'A' || 
        event.target.closest('a')) {
      return;
    }
    
    // Navigate to post detail
    window.location.href = `/posts/${post.id}`;
  }
  
  function toggleComments() {
    dispatch('toggleComments');
  }
  
  function likePost() {
    dispatch('like');
  }
</script>

<div class="post-card-inner">
  <div class="post-header p-4 pb-2">
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2">
        <a href="/user/{post.author_username || post.username}" class="font-medium text-blue-600 hover:underline">
          @{post.author_username || post.username || 'Anonymous'}
        </a>
        <span class="text-gray-400">•</span>
        <span class="text-gray-500 text-sm">{formatDate(post.created_at)}</span>
        
        {#if post.category_name || post.category_id}
          <span class="text-gray-400">•</span>
          <a 
            href="/posts?category={post.category_id}" 
            class="category-pill text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
          >
            {post.category_name || 'Uncategorized'}
          </a>
        {/if}
      </div>
    </div>
  </div>
  
  <div 
    class="post-content p-4 pt-2 cursor-pointer"
    on:click={handlePostClick}
    role="button"
    tabindex="0"
  >
    <MarkdownContent content={post.content} />
  </div>
  
  <div class="post-actions p-4 pt-2 flex items-center gap-4 border-t border-gray-100">
    <button 
      class="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition"
      on:click={likePost}
      aria-label={post.has_liked ? 'Unlike' : 'Like'}
    >
      <span class={post.has_liked ? 'text-red-500' : ''}>
        {post.has_liked ? '❤️' : '♡'}
      </span>
      <span>{post.like_count || 0}</span>
    </button>
    
    <button 
      class="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition"
      on:click={toggleComments}
    >
      <span>💬</span>
      <span>Comments</span>
    </button>
  </div>
</div>

<style>
  .post-card-inner {
    width: 100%;
  }
  
  .category-pill {
    transition: background-color 0.2s;
  }
  
  .category-pill:hover {
    background-color: #dbeafe;
  }

  /* Add styles for post content links */
  :global(.post-content a) {
    color: #2563eb !important; /* Bright blue */
    text-decoration: underline !important;
    font-weight: 500 !important;
  }

  :global(.post-content a:hover) {
    color: #1d4ed8 !important; /* Darker blue on hover */
    text-decoration: none !important;
  }
</style> 