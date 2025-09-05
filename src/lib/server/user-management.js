import { supabaseAdmin } from './supabase-admin';

export const updateUserRole = async (userId, tier, stripeData = {}) => {
  try {
    // Get current privilege role to preserve it
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('privilege_role')
      .eq('id', userId)
      .single();

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        role: tier, // subscription role
        privilege_role: currentProfile?.privilege_role || 'user', // preserve privilege
        stripe_customer_id: stripeData.customerId,
        subscription_id: stripeData.subscriptionId,
        subscription_status: stripeData.status || 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const updatePrivilegeRole = async (userId, privilegeRole) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ privilege_role: privilegeRole })
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating privilege role:', error);
    throw error;
  }
};

export const initializeNewUser = async (userId, email) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        role: 'free',
        privilege_role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error initializing user:', error);
    throw error;
  }
};

export const assignProductRoles = async (userId, productId) => {
  try {
    const productConfig = Object.values(PRODUCT_CONFIG.PRODUCTS)
      .find(p => p.id === productId);

    if (!productConfig?.product_to_role?.enabled) {
      return { success: true, message: 'No roles to assign' };
    }

    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('custom_roles')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const currentCustomRoles = userData?.custom_roles || {};

    // Process role assignments
    Object.entries(productConfig.product_to_role.roles).forEach(([roleName, roleConfig]) => {
      currentCustomRoles[roleName] = roleConfig.sub_roles[0];
    });

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        custom_roles: currentCustomRoles,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;
    return { success: true };
  } catch (error) {
    console.error('Error assigning product roles:', error);
    throw error;
  }
};

export const handleProductPurchaseRoles = async (userId, productId) => {
  try {
    // Get product configuration
    const product = Object.values(PRODUCT_CONFIG.PRODUCTS).find(p => p.id === productId);
    if (!product?.product_to_role?.enabled) return;

    // Get current user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('custom_roles')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Update custom roles based on product configuration
    const custom_roles = { ...userData.custom_roles };
    
    Object.entries(product.product_to_role.roles).forEach(([roleName, roleConfig]) => {
      // If user already has some sub-roles for this role, merge them
      const existingSubRoles = custom_roles[roleName] || [];
      const newSubRoles = Array.isArray(existingSubRoles) ? existingSubRoles : [existingSubRoles];
      
      roleConfig.sub_roles.forEach(subRole => {
        if (!newSubRoles.includes(subRole)) {
          newSubRoles.push(subRole);
        }
      });
      
      custom_roles[roleName] = newSubRoles;
    });

    // Update the profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ custom_roles })
      .eq('id', userId);

    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error) {
    console.error('Error handling product purchase roles:', error);
    throw error;
  }
};