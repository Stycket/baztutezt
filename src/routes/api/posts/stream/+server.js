import { postStore } from '$lib/stores/postStore';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      postStore.addConnection(controller, 'posts');
      
      return () => {
        postStore.removeConnection(controller, 'posts');
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