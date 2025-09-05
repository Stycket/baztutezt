import { json } from '@sveltejs/kit';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';
import { updateUserRole } from '$lib/server/user-management';
import { PRODUCT_CONFIG } from '$lib/constants';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Safely access PRICE_TO_ROLE with optional chaining
const PRICE_TO_ROLE = PRIVATE_CONFIG?.STRIPE?.PRICE_TO_ROLE || {};

export async function GET({ url }) {
  try {
    const sessionId = url.searchParams.get('session_id');
    
    if (!sessionId) {
      return json({ error: 'Missing session ID' }, { status: 400 });
    }
    
    console.log('🔍 Checking session status for:', sessionId);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('📊 Session mode:', session.mode, 'Status:', session.status);
    
    if (session.status === 'complete') {
      if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0].price.id;
        
        const role = PRICE_TO_ROLE[priceId];
        
        if (!role) {
          console.error('❌ No role mapping found for price ID:', priceId);
          return json({ error: `No role mapping found for price ID: ${priceId}` }, { status: 400 });
        }
        
        try {
          // Only update the role field which we know exists
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              role: role,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.metadata.userId);
          
          if (updateError) {
            console.error('❌ Direct profile update error:', updateError);
            throw updateError;
          }
          
          console.log('✅ Profile updated directly with role:', role);
          
          // Use updateUserRole but don't rely on it updating subscription fields
          try {
            await updateUserRole(session.metadata.userId, role);
            console.log('✅ User role updated via helper function');
          } catch (roleError) {
            console.warn('⚠️ Helper function error:', roleError);
            // Continue since we already updated the role directly
          }
        } catch (err) {
          console.error('❌ Error updating profile:', err);
          return json({ error: err.message }, { status: 500 });
        }

        return json({ 
          success: true, 
          mode: 'subscription',
          status: session.status,
          payment_status: session.payment_status
        });
      } else if (session.mode === 'payment') {
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
            expand: ['data.price.product']
          });

          for (const item of lineItems.data) {
            const productId = item.price.product.id;
            const productName = item.description || item.price.product.name;
            
            console.log(`📝 Recording purchase: ${productName} (${productId})`);
            
            // Insert into product_purchases table
            const { error: purchaseError } = await supabaseAdmin
              .from('product_purchases')
              .insert({
                user_id: session.metadata.userId,
                product_id: productId,
                product_name: productName,
                price_amount: item.amount_total,
                payment_status: 'completed',
                purchased_at: new Date().toISOString(),
                session_id: session.id
              });

            if (purchaseError) {
              console.error('❌ Purchase record error:', purchaseError);
              throw purchaseError;
            }
            
            // Also insert into purchases table for admin panel compatibility
            const { error: legacyPurchaseError } = await supabaseAdmin
              .from('purchases')
              .insert({
                user_id: session.metadata.userId,
                product_id: productId,
                product_name: productName,
                price_amount: item.amount_total,
                payment_status: 'completed',
                purchased_at: new Date().toISOString(),
                session_id: session.id
              });
              
            if (legacyPurchaseError) {
              console.warn('⚠️ Legacy purchase record warning:', legacyPurchaseError);
              // Continue even if this fails
            }

            // Process custom roles for this product
            const productConfig = Object.values(PRODUCT_CONFIG.PRODUCTS)
              .find(p => p.id === productId);

            if (productConfig?.product_to_role?.enabled) {
              // Get current profile with custom_roles
              const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('custom_roles')
                .eq('id', session.metadata.userId)
                .single();

              if (profileError) {
                console.error('❌ Error fetching profile:', profileError);
                throw profileError;
              }

              const currentCustomRoles = profile?.custom_roles || {};
              let rolesUpdated = false;

              Object.entries(productConfig.product_to_role.roles).forEach(([roleName, roleConfig]) => {
                if (!currentCustomRoles[roleName]) {
                  currentCustomRoles[roleName] = [];
                  rolesUpdated = true;
                }
                
                // Ensure currentCustomRoles[roleName] is an array
                if (!Array.isArray(currentCustomRoles[roleName])) {
                  currentCustomRoles[roleName] = [currentCustomRoles[roleName]];
                }
                
                roleConfig.sub_roles.forEach(subRole => {
                  if (!currentCustomRoles[roleName].includes(subRole)) {
                    currentCustomRoles[roleName].push(subRole);
                    rolesUpdated = true;
                  }
                });
              });

              if (rolesUpdated) {
                const { error: updateError } = await supabaseAdmin
                  .from('profiles')
                  .update({
                    custom_roles: currentCustomRoles,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', session.metadata.userId);
                
                if (updateError) {
                  console.error('❌ Custom roles update error:', updateError);
                  throw updateError;
                }
                
                console.log('✅ Custom roles updated successfully');
              }
            }
          }
          
          return json({ 
            success: true, 
            mode: 'payment',
            status: session.status,
            payment_status: session.payment_status
          });
        } catch (error) {
          console.error('❌ Error processing product purchase:', error);
          return json({ error: error.message }, { status: 500 });
        }
      }
    }
    
    return json({ 
      success: false,
      status: session.status,
      payment_status: session.payment_status
    });
  } catch (error) {
    console.error('❌ Session check error:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 