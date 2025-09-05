// This file should only contain truly public information
// that has no security implications if modified by users

export const PUBLIC_CONFIG = {
  // App name, version, etc. can stay here
  APP_NAME: 'Your App',
  VERSION: '1.0.0',
  
  // Any UI-only settings that have no security implications
  UI_SETTINGS: {
    THEME: 'light',
    DEFAULT_AVATAR: '/images/default-avatar.png'
  }
};

// Empty objects for backward compatibility
export const STRIPE_CONFIG = {};
export const APP_CONFIG = {};

// Helper functions that now use the config store
export function shouldShowRole(role) {
  // This is a placeholder - actual implementation should use configStore
  return true;
}

export function getDisplayName(role) {
  // This is a placeholder - actual implementation should use configStore
  return role;
}

export const PRODUCT_CONFIG = {
  PRODUCTS: {
    PRODUCT_ONE: {
      id: 'prod_RampyV4YzRg9PF',
      price_id: 'price_1QhbFWQFHJPjmmRTZX9kfPdD',
      name: 'Basic License',
      description: 'One-time purchase basic license',
      allowQuantity: false,
      image: '/images/product-1.jpg',
      product_to_role: {
        enabled: true,
        roles: {
          member_role: {
            sub_roles: ['user', 'poweruser']
          }
        }
      }
    },
    PRODUCT_TWO: {
      id: 'prod_RampAnlH5SieOT',
      price_id: 'price_1QhbGGQFHJPjmmRTIaUv88nq',
      name: 'Pro License',
      description: 'One-time purchase pro license',
      allowQuantity: true,
      maxQuantity: 5,
      image: '/images/product-2.jpg',
      product_to_role: {
        enabled: true,
        roles: {
          game_role: {
            sub_roles: ['pro']
          }
        }
      }
    },
    PRODUCT_THREE: {
      id: 'prod_RamrBo9Yt30X9U',
      price_id: 'price_1QhbHfQFHJPjmmRTEMxoQJ7Y',
      name: 'Enterprise License',
      description: 'One-time purchase enterprise license',
      allowQuantity: true,
      maxQuantity: 10,
      image: '/images/product-3.jpg',
      product_to_role: {
        enabled: false,
        roles: {}
      }
    }
  }
};

console.log('🔧 Product Config Loaded:', PRODUCT_CONFIG);

async function handlePaymentSuccess(paymentIntent) {
  try {
    const session = await stripe.checkout.sessions.retrieve(paymentIntent.metadata.sessionId);
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product']
    });

    for (const item of lineItems.data) {
      const productConfig = Object.values(PRODUCT_CONFIG.PRODUCTS)
        .find(p => p.id === item.price.product.id);

      if (productConfig?.product_to_role?.enabled) {
        const { data: userData } = await supabaseAdmin
          .from('profiles')
          .select('custom_roles')
          .eq('id', session.metadata.userId)
          .single();

        const currentCustomRoles = userData?.custom_roles || {};

        // Process all configured roles and their sub-roles
        Object.entries(productConfig.product_to_role.roles).forEach(([roleName, roleConfig]) => {
          // Get existing sub-roles for this role
          const existingSubRoles = Array.isArray(currentCustomRoles[roleName]) 
            ? currentCustomRoles[roleName] 
            : currentCustomRoles[roleName] ? [currentCustomRoles[roleName]] : [];

          // Add new sub-roles while preventing duplicates
          currentCustomRoles[roleName] = [...new Set([...existingSubRoles, ...roleConfig.sub_roles])];
        });

        // Update user's custom roles
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            custom_roles: currentCustomRoles,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.metadata.userId);

        if (updateError) throw updateError;

        // Log successful role assignment
        console.log('Custom roles assigned:', currentCustomRoles);
      }
    }
  } catch (error) {
    console.error('Error in handlePaymentSuccess:', error);
    throw error;
  }
} 