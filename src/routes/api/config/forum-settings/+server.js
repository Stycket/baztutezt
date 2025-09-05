import { json } from '@sveltejs/kit';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

export async function GET({ locals }) {
  // Check if user is logged in
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const isAdmin = locals.session.user.privilege_role === 'admin';
    const actualSettingValue = 
      PRIVATE_CONFIG.FEATURES.SOCIAL_SETTINGS.FORUM_SETTINGS?.USER_CATEGORY_CREATION || false;
    
    return json({
      userCategoryCreationAllowed: isAdmin || actualSettingValue,
      actualSettingValue: actualSettingValue
    });
  } catch (err) {
    console.error('Error fetching forum settings:', err);
    return json({ error: err.message }, { status: 500 });
  }
} 