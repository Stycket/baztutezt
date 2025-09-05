import { commentStore } from '$lib/stores/commentStore';

export async function GET({ url }) {
  const postId = url.searchParams.get('postId');
  
  if (!postId) {
    return new Response('Post ID is required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      commentStore.addConnection(controller, postId);
      
      return () => {
        commentStore.removeConnection(controller, postId);
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
} 