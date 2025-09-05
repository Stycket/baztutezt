<script>
  export let content = '';
  
  // Function to parse markdown content
  function parseMarkdown(text) {
    if (!text) return '';
    
    // Parse image markdown: ![alt text](url)
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    
    // Replace image markdown with HTML img tags
    const htmlContent = text.replace(imageRegex, '<img src="$2" alt="$1" class="post-image">');
    
    return htmlContent;
  }
  
  $: parsedContent = parseMarkdown(content);
</script>

<div class="markdown-content">
  {@html parsedContent}
</div>

<style>
  .markdown-content {
    word-break: break-word;
  }
  
  :global(.post-image) {
    max-width: 100%;
    border-radius: 0.5rem;
    margin: 0.5rem 0;
    display: block;
  }
</style> 