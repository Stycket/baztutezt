import { env } from '$env/dynamic/private';
import { PUBLIC_CONFIG } from '$lib/constants';

export const PRIVATE_CONFIG = {
  FORUM_CATEGORIES: {},
  
  // Feature flags
  FEATURES: {
    SUBSCRIPTIONS_ENABLED: true,
    PRODUCTS_ENABLED: true,
    
    USERNAME_SETTINGS: {
      ENABLED: true,
      REQUIRED: true,
      MIN_LENGTH: 3,
      MAX_LENGTH: 20,
      ALLOWED_CHARACTERS: '^[a-zA-Z0-9_-]+$'
    },
    
    PRODUCT_SETTINGS: {
      USE_CART: true,
      CART_ROUTE: '/cart',
      CART_CONFIG: {
        showCartIcon: true,
        maxItems: 10
      }
    },
    
    SOCIAL_SETTINGS: {
      ENABLED: true,
      COMMENTS: {
        ENABLED: true,
        THREADED: true,
        MAX_NESTING: 5,
        MODERATION: {
          ENABLED: true,
          AUTO_APPROVE: false
        }
      }
    }
  }
};

export const PRIVATE_SECRETS = {
  // This section contains secrets that should not be committed to version control
};