<script>
  import { configStore } from '$lib/stores/configStore';
  import { session } from '$lib/stores';
  import CommentForm from './CommentForm.svelte';
  import CommentItem from './CommentItem.svelte';
  
  export let postId;
  export let comments = [];
  
  // Get social settings from the config store
  $: socialEnabled = $configStore.features?.social?.enabled ?? false;
  $: commentsEnabled = $configStore.features?.social?.comments?.enabled ?? false;
  $: threaded = $configStore.features?.social?.comments?.threaded ?? true;
  $: maxNesting = $configStore.features?.social?.comments?.maxNesting ?? 3;
  
  // Only show comments if both social and comments are enabled
  $: showComments = socialEnabled && commentsEnabled;
</script>

{#if showComments}
  <section class="comments-section">
    <h3>Comments</h3>
    
    {#if $session?.user}
      <CommentForm {postId} />
    {:else}
      <p>Please <a href="/login">log in</a> to leave a comment.</p>
    {/if}
    
    {#if comments.length > 0}
      <div class="comments-list">
        {#each comments.filter(c => !c.parent_id) as comment (comment.id)}
          <CommentItem 
            {comment} 
            {threaded} 
            {maxNesting} 
            allComments={comments} 
            level={0} 
          />
        {/each}
      </div>
    {:else}
      <p>No comments yet. Be the first to comment!</p>
    {/if}
  </section>
{/if} 