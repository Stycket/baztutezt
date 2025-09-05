import { json } from '@sveltejs/kit';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function GET({ url }) {
  try {
    const section = url.searchParams.get('section');
    
    // Return specific section if requested
    if (section === 'social') {
      return json({
        enabled: PRIVATE_CONFIG?.FEATURES?.SOCIAL_SETTINGS?.ENABLED || false,
        comments: PRIVATE_CONFIG?.FEATURES?.SOCIAL_SETTINGS?.COMMENTS || {}
      });
    }
    
    if (section === 'comments') {
      return json({
        enabled: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.ENABLED && 
                 PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.ENABLED,
        threaded: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.THREADED,
        maxNesting: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.MAX_NESTING
      });
    }
    
    // Return full config by default
    return json({
      features: {
        subscriptionsEnabled: PRIVATE_CONFIG.FEATURES.SUBSCRIPTIONS_ENABLED,
        productsEnabled: PRIVATE_CONFIG.FEATURES.PRODUCTS_ENABLED,
        
        username: {
          enabled: PRIVATE_CONFIG.FEATURES.USERNAME_SETTINGS.ENABLED,
          required: PRIVATE_CONFIG.FEATURES.USERNAME_SETTINGS.REQUIRED,
          minLength: PRIVATE_CONFIG.FEATURES.USERNAME_SETTINGS.MIN_LENGTH,
          maxLength: PRIVATE_CONFIG.FEATURES.USERNAME_SETTINGS.MAX_LENGTH,
          allowedCharacters: PRIVATE_CONFIG.FEATURES.USERNAME_SETTINGS.ALLOWED_CHARACTERS
        },
        
        product: {
          useCart: PRIVATE_CONFIG.FEATURES.PRODUCT_SETTINGS.USE_CART,
          cartRoute: PRIVATE_CONFIG.FEATURES.PRODUCT_SETTINGS.CART_ROUTE,
          showCartIcon: PRIVATE_CONFIG.FEATURES.PRODUCT_SETTINGS.CART_CONFIG.SHOW_CART_ICON
        },
        
        social: {
          enabled: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.ENABLED,
          comments: {
            enabled: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.ENABLED,
            threaded: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.THREADED,
            maxNesting: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.MAX_NESTING
          }
        }
      },
      
      roles: {
        subscriptionRoles: Object.entries(PRIVATE_CONFIG?.ROLE_SETTINGS?.SUBSCRIPTION_ROLES || {}).reduce((acc, [key, role]) => {
          acc[key.toLowerCase()] = {
            name: role.name,
            displayName: role.display_name
          };
          return acc;
        }, {}),
        
        privilegeRoles: Object.entries(PRIVATE_CONFIG?.ROLE_SETTINGS?.PRIVILEGE_ROLES || {}).reduce((acc, [key, role]) => {
          acc[key.toLowerCase()] = {
            name: role.name,
            displayName: role.display_name
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error loading configuration:', error);
    // Return a minimal configuration to prevent client-side errors
    return json({
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
      }
    });
  }
} 