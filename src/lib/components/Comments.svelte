<script>
  import { session } from '$lib/stores';
  import { configStore, loadConfig } from '$lib/stores/configStore';
  import { onMount, onDestroy } from 'svelte';
  import { commentStore } from '$lib/stores/commentStore';
  import { browser } from '$app/environment';
  import { api } from '$lib/utils/api';
  
  export let postId;
  export let expanded = false;
  export let inThread = false;
  export let threaded = true; // Default to true for threaded comments
  export let parentId = null;
  export let depth = 0;
  export let comments = [];
  
  let loading = false;
  let newComment = '';
  let replyComment = '';
  let replyingTo = null;
  let eventSource;
  let autoUpdate = true;
  let errorMessage = '';
  
  // Get social settings from the config store
  $: socialEnabled = $configStore.features?.social?.enabled ?? false;
  $: commentsEnabled = $configStore.features?.social?.comments?.enabled ?? false;
  $: maxNesting = $configStore.features?.social?.comments?.maxNesting ?? 3;
  $: showComments = socialEnabled && commentsEnabled;
  
  async function submitComment(parentCommentId = null) {
    if (!showComments || !postId) return;
    
    const commentText = parentCommentId ? replyComment : newComment;
    if (!commentText.trim()) return;
    
    try {
      const response = await api('/comments', {
        method: 'POST',
        body: JSON.stringify({
          postId,
          content: commentText,
          parentId: parentCommentId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit comment');
      }
      
      // Clear input fields
      if (parentCommentId) {
        replyComment = '';
        replyingTo = null;
      } else {
        newComment = '';
      }

      // If we're at a nested level, dispatch an event to notify parent
      if (depth > 0) {
        const event = new CustomEvent('commentAdded', {
          bubbles: true,
          detail: { parentId: parentCommentId }
        });
        document.dispatchEvent(event);
      }
      
      // Always refresh current level
      await loadComments();

      // Notify all connected clients
      commentStore.broadcast({
        type: 'comment_added',
        postId,
        parentId: parentCommentId
      });

    } catch (error) {
      console.error('Error submitting comment:', error);
      errorMessage = error.message || 'Failed to submit comment';
    }
  }

  async function loadComments() {
    if (!showComments || !postId) return;
    
    loading = true;
    try {
      const response = await fetch(`/api/comments/${postId}`);
      const rawComments = await response.json();
      
      function buildCommentTree(comments, parentId = null) {
        const result = comments
          .filter(comment => comment.parent_id === parentId)
          .map(comment => ({
            ...comment,
            replies: buildCommentTree(comments, comment.id)
          }));
        return result;
      }

      if (depth === 0) {
        // Root level - build complete tree
        comments = buildCommentTree(rawComments);
      } else {
        // Nested level - only get relevant branch
        const parentComment = rawComments.find(c => c.id === parentId);
        if (parentComment) {
          comments = buildCommentTree(rawComments, parentId);
        }
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      loading = false;
    }
  }

  function setupSSE() {
    if (!showComments || !postId || !browser || !autoUpdate) return;
    
    eventSource?.close();
    eventSource = new EventSource(`/api/comments/stream?postId=${postId}`);
    
    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'comment_added' && data.postId === postId) {
          await loadComments();
        }
      } catch (error) {
        console.error('SSE message error:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      setTimeout(setupSSE, 5000);
    };
  }

  onMount(() => {
    if (showComments) {
      loadComments();
      setupSSE();
    }
  });

  onDestroy(() => {
    eventSource?.close();
  });

  $: if (showComments && postId && (expanded || inThread) && depth === 0) {
    loadComments();
  }
</script>

{#if showComments}
  <div class="comments-section" class:expanded class:in-thread={inThread}>
    {#if expanded || inThread || depth > 0}
      {#if !depth && loading}
        <div class="loading">Loading comments...</div>
      {:else if !depth && comments.length === 0}
        <div class="no-comments">No comments yet</div>
      {:else}
        <div class="comments-list">
          {#each comments as comment (comment.id)}
            <div class="comment" style="margin-left: {depth * 20}px">
              <div class="comment-header">
                <a href="/user/{comment.author_username}" class="avatar-link">
                  <div class="avatar">{comment.author_username[0].toUpperCase()}</div>
                </a>
                <div class="comment-meta">
                  <a href="/user/{comment.author_username}" class="author-link">
                    <span class="author">@{comment.author_username}</span>
                  </a>
                  <span class="date">{new Date(comment.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div class="comment-content">{comment.content}</div>
              
              {#if threaded && depth < maxNesting}
                <button 
                  class="reply-button"
                  on:click={() => replyingTo = replyingTo === comment.id ? null : comment.id}
                >
                  Reply
                </button>
                
                {#if replyingTo === comment.id}
                  <div class="reply-form">
                    <textarea
                      bind:value={replyComment}
                      placeholder="Write a reply..."
                      rows="2"
                    ></textarea>
                    <button on:click={() => submitComment(comment.id)}>Reply</button>
                  </div>
                {/if}

                {#if comment.replies?.length > 0}
                  <div class="nested-comments">
                    <svelte:self
                      {postId}
                      comments={comment.replies}
                      depth={depth + 1}
                      parentId={comment.id}
                      {threaded}
                      {inThread}
                      expanded={true}
                    />
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      
      {#if !depth && $session?.user}
        <div class="comment-form">
          <textarea
            bind:value={newComment}
            placeholder="Write a comment..."
            rows="3"
          ></textarea>
          <button on:click={() => submitComment(null)}>Post Comment</button>
        </div>
      {:else if !$session?.user}
        <div class="login-prompt">
          <a href="/login">Log in</a> to post a comment.
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .nested-comments {
    margin-left: 20px;
    border-left: 2px solid var(--border-color);
    padding-left: 10px;
    margin-top: 10px;
  }

  .comments-section {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background-color: var(--comment-bg, #f0f2f5);
    color: var(--text-color, #212529);
  }

  .comment {
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background: var(--comment-item-bg, #f8f9fa);
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .avatar {
    width: 30px;
    height: 30px;
    background-color: var(--primary-color, #4a76a8);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  
  .avatar-link {
    text-decoration: none;
  }
  
  .comment-meta {
    display: flex;
    flex-direction: column;
    font-size: 0.9rem;
  }

  .author {
    font-weight: 600;
    color: var(--primary-color, #4a76a8);
  }
  
  .author-link {
    text-decoration: none;
    color: inherit;
  }
  
  .author-link:hover {
    text-decoration: underline;
  }

  .date {
    color: var(--gray-500);
    font-size: 0.875rem;
  }

  .comment-content {
    margin-bottom: 0.5rem;
    white-space: pre-wrap;
  }

  .reply-button {
    font-size: 0.875rem;
    color: var(--primary-color, #4a76a8);
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .reply-form {
    margin-top: 0.5rem;
  }

  textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
    resize: vertical;
    background-color: var(--input-bg, white);
    color: var(--input-text, #212529);
  }

  button {
    padding: 0.5rem 1rem;
    background: var(--primary-color, #4a76a8);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  button:hover {
    opacity: 0.9;
  }

  .comments-section:not(.expanded):not(.in-thread) {
    display: none;
  }
  
  .loading, .no-comments, .login-prompt {
    padding: 1rem;
    text-align: center;
    color: var(--gray-600, #6c757d);
  }
  
  .login-prompt a {
    color: var(--primary-color, #4a76a8);
    text-decoration: none;
  }
  
  .login-prompt a:hover {
    text-decoration: underline;
  }
  
  /* Dark mode overrides */
  @media (prefers-color-scheme: dark) {
    .comments-section {
      background-color: var(--comment-bg, #2a2d31);
      color: var(--text-color, #f8f9fa);
    }
    
    .comment {
      background-color: var(--comment-item-bg, #343a40);
    }
    
    textarea {
      background-color: var(--input-bg, #343a40);
      color: var(--input-text, #f8f9fa);
      border-color: var(--border-color, #495057);
    }
    
    .author {
      color: var(--primary-light, #6c94c2);
    }
    
    .reply-button {
      color: var(--primary-light, #6c94c2);
    }
    
    .loading, .no-comments, .login-prompt {
      color: var(--gray-400, #ced4da);
    }
    
    .login-prompt a {
      color: var(--primary-light, #6c94c2);
    }
  }
</style> 
