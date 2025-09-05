import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Create a default configuration with safe values
const defaultConfig = {
  features: {
    subscriptionsEnabled: false,
    productsEnabled: false,
    username: { enabled: true },
    product: { useCart: false },
    social: { 
      enabled: true, 
      comments: { 
        enabled: true,
        threaded: true,
        maxNesting: 3
      } 
    }
  },
  roles: {
    subscriptionRoles: { free: { name: 'free', displayName: 'Free' } },
    privilegeRoles: { user: { name: 'user', displayName: 'User' } }
  },
  loaded: false
};

// Create the store with default values
export const configStore = writable(defaultConfig);

// Function to load configuration from the server
export async function loadConfig(section = null) {
  if (!browser) return defaultConfig;
  
  try {
    console.log(`Loading configuration${section ? ` (${section})` : ''}...`);
    
    // Add a timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = new URL('/api/config', window.location.origin);
    url.searchParams.append('t', timestamp);
    
    if (section) {
      url.searchParams.append('section', section);
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
    }
    
    const config = await response.json();
    console.log('Configuration loaded successfully', config);
    
    // Update the store with the loaded configuration
    if (section) {
      // Only update the specific section
      configStore.update(current => {
        if (section === 'social') {
          return { 
            ...current, 
            features: { 
              ...current.features, 
              social: config 
            },
            loaded: true 
          };
        } else if (section === 'comments') {
          return { 
            ...current, 
            features: { 
              ...current.features, 
              social: { 
                ...current.features.social, 
                comments: config 
              } 
            },
            loaded: true 
          };
        }
        return { ...current, loaded: true };
      });
    } else {
      // Update the entire config
      configStore.update(current => ({ 
        ...current, 
        ...config, 
        loaded: true 
      }));
    }
    
    return config;
  } catch (error) {
    console.error('Error loading configuration:', error);
    
    // Mark as loaded even on error, but keep default values
    configStore.update(current => ({ 
      ...current, 
      loaded: true,
      error: error.message
    }));
    
    return defaultConfig;
  }
}

// Initialize the configuration loading
if (browser) {
  loadConfig();
} 