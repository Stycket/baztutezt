import { writable } from 'svelte/store';

// Store connections by postId
const connectionsByPost = new Map();

export const commentStore = {
  subscribe: writable(connectionsByPost).subscribe,
  
  addConnection: (controller, postId) => {
    if (!connectionsByPost.has(postId)) {
      connectionsByPost.set(postId, new Set());
    }
    connectionsByPost.get(postId).add(controller);
    console.log(`Added connection for post ${postId}. Total connections:`, connectionsByPost.get(postId).size);
  },
  
  removeConnection: (controller, postId) => {
    if (connectionsByPost.has(postId)) {
      connectionsByPost.get(postId).delete(controller);
      console.log(`Removed connection for post ${postId}. Remaining connections:`, connectionsByPost.get(postId).size);
      if (connectionsByPost.get(postId).size === 0) {
        connectionsByPost.delete(postId);
      }
    }
  },
  
  broadcast: (message) => {
    const postId = message.postId.toString();
    const connections = connectionsByPost.get(postId);
    
    if (!connections) {
      console.log(`No connections found for post ${postId}`);
      return;
    }

    console.log(`Broadcasting to ${connections.size} connections for post ${postId}`);
    const closedControllers = new Set();
    const messageString = `data: ${JSON.stringify({
      type: message.type,
      postId: parseInt(postId),
      parentId: message.parentId ? parseInt(message.parentId) : null,
      likeCount: message.likeCount,
      hasLiked: message.hasLiked,
      userId: message.userId,
      timestamp: Date.now()
    })}\n\n`;
    
    connections.forEach(controller => {
      try {
        controller.enqueue(messageString);
      } catch (error) {
        if (error.code === 'ERR_INVALID_STATE') {
          closedControllers.add(controller);
        } else {
          console.error('Broadcast error:', error);
        }
      }
    });

    closedControllers.forEach(controller => {
      connections.delete(controller);
    });
  },

  addDebugging: (event) => {
    console.log('Broadcasting event:', event);
    commentStore.clients.forEach(client => {
      client.send(`data: ${JSON.stringify(event)}\n\n`);
    });
  }
}; 