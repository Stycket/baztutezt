import { json } from '@sveltejs/kit';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function GET() {
  try {
    // Get the social configuration from private constants
    const socialConfig = {
      enabled: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.ENABLED,
      comments: {
        enabled: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.ENABLED,
        threaded: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.THREADED,
        maxNesting: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.MAX_NESTING,
        moderation: {
          enabled: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.MODERATION.ENABLED,
          autoApprove: PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.COMMENTS.MODERATION.AUTO_APPROVE
        }
      }
    };
    
    console.log('Server returning social config:', socialConfig);
    
    return json({ socialConfig });
  } catch (error) {
    console.error('Error getting social config:', error);
    return json({ 
      socialConfig: {
        enabled: false,
        comments: {
          enabled: false,
          threaded: false,
          maxNesting: 0,
          moderation: {
            enabled: false,
            autoApprove: false
          }
        }
      },
      error: 'Failed to get social configuration'
    }, { status: 500 });
  }
} 