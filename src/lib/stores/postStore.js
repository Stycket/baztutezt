import { writable } from 'svelte/store';

const connectionsByPage = new Map();

export const postStore = {
  subscribe: writable(connectionsByPage).subscribe,
  
  addConnection: (controller, page) => {
    if (!connectionsByPage.has(page)) {
      connectionsByPage.set(page, new Set());
    }
    connectionsByPage.get(page).add(controller);
    console.log(`Added post connection for page ${page}. Total connections:`, connectionsByPage.get(page).size);
  },
  
  removeConnection: (controller, page) => {
    if (connectionsByPage.has(page)) {
      connectionsByPage.get(page).delete(controller);
      console.log(`Removed post connection for page ${page}. Remaining:`, connectionsByPage.get(page).size);
      if (connectionsByPage.get(page).size === 0) {
        connectionsByPage.delete(page);
      }
    }
  },
  
  broadcast: (message) => {
    const connections = connectionsByPage.get('posts');
    if (!connections) {
      console.log('No post connections found');
      return;
    }

    console.log(`Broadcasting to ${connections.size} post connections:`, message);
    const closedControllers = new Set();
    
    // Format the message based on its type
    let messageData;
    if (message.type === 'post_added' || message.type === 'post_updated') {
      messageData = {
        type: message.type,
        post: message.post,
        timestamp: Date.now()
      };
    } else if (message.type === 'post_deleted') {
      messageData = {
        type: message.type,
        postId: message.postId,
        timestamp: Date.now()
      };
    } else if (message.type === 'post_liked' || message.type === 'post_unliked') {
      messageData = {
        type: message.type,
        postId: message.postId,
        likeCount: message.likeCount,
        hasLiked: message.hasLiked,
        userId: message.userId,
        timestamp: Date.now()
      };
    } else {
      messageData = {
        ...message,
        timestamp: Date.now()
      };
    }
    
    const messageString = `data: ${JSON.stringify(messageData)}\n\n`;
    
    connections.forEach(controller => {
      try {
        controller.enqueue(messageString);
        console.log('Successfully sent post update to client');
      } catch (error) {
        if (error.code === 'ERR_INVALID_STATE') {
          closedControllers.add(controller);
        } else {
          console.error('Post broadcast error:', error);
        }
      }
    });

    closedControllers.forEach(controller => {
      postStore.removeConnection(controller, 'posts');
    });
  }
}; 