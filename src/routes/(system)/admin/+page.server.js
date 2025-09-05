import { redirect, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { PRIVATE_CONFIG } from '$lib/server/private-constants';

// Cache for shipping orders
/** @type {Array<any>|null} */
let cachedShippingOrders = null;
/** @type {number} */
let lastShippingFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches shipping orders from database
 * @returns {Promise<Array<any>>} Array of shipping orders
 */
async function getShippingOrders() {
  const now = Date.now();
  if (cachedShippingOrders && (now - lastShippingFetch) < CACHE_DURATION) {
    return cachedShippingOrders;
  }

  try {
    // First get all shipping statuses from Supabase
    const { data: shippingStatuses, error: shippingStatusError } = await supabaseAdmin
      .from('shipping_status')
      .select('*')
      .order('created_at', { ascending: false });

    if (shippingStatusError) {
      console.error('Error fetching shipping statuses:', shippingStatusError);
      return [];
    }

    // Get all product purchases
    const { data: productPurchases, error: purchasesError } = await supabaseAdmin
      .from('product_purchases')
      .select('*')
      .order('purchased_at', { ascending: false })
      .limit(100);

    if (purchasesError) {
      console.error('Error fetching product_purchases:', purchasesError);
      return [];
    }
    
    console.log(`Found ${productPurchases.length} product purchases`);

    // Get unique session IDs from product purchases
    const purchaseSessionIds = productPurchases
      .filter(purchase => purchase.session_id)
      .map(purchase => purchase.session_id);
    
    // Get unique session IDs from shipping statuses
    const shippingSessionIds = shippingStatuses
      .filter(status => status.session_id)
      .map(status => status.session_id);
    
    // Combine and remove duplicates
    const sessionIds = [...new Set([...shippingSessionIds, ...purchaseSessionIds])];
    
    console.log(`Found ${sessionIds.length} unique session IDs to process`);

    // Instead of fetching from Stripe, we'll just use data from our database
    console.log(`Processing ${sessionIds.length} total sessions`);

    // Map sessions to orders using only database data
    const orders = [];
    
    for (const sessionId of sessionIds) {
      // Find shipping status for this session
      const status = shippingStatuses.find(s => s.session_id === sessionId);
      
      // Find purchases for this session
      const purchases = productPurchases.filter(p => p.session_id === sessionId);
      
      if (purchases.length > 0) {
        // Construct order from database data
        const order = {
          id: sessionId,
          customer_name: purchases[0].customer_name || 'Anonymous',
          customer_email: purchases[0].customer_email || null,
          shipping_address: purchases[0].shipping_address || null,
          items: purchases.map(purchase => ({
            name: purchase.product_name || 'Product',
            quantity: purchase.quantity || 1,
            amount: purchase.price_amount || 0,
            product_id: purchase.product_id
          })),
          total_amount: purchases.reduce((sum, p) => sum + (p.price_amount || 0), 0),
          created_at: purchases[0].purchased_at,
          shipping_status: status?.status || 'pending',
          shipping_details: status?.shipping_details || null
        };
        
        orders.push(order);
      }
    }

    // Create shipping status records for sessions that don't have one
    for (const sessionId of sessionIds) {
      const status = shippingStatuses.find(s => s.session_id === sessionId);
      
      if (!status && productPurchases.some(p => p.session_id === sessionId)) {
        try {
          console.log(`Creating shipping status record for session ${sessionId}`);
          await supabaseAdmin
            .from('shipping_status')
            .insert({
              session_id: sessionId,
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        } catch (err) {
          console.error('Error inserting shipping status:', err);
        }
      }
    }
    
    // Sort orders by creation date (newest first)
    const sortedOrders = orders.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
    
    cachedShippingOrders = sortedOrders;
    lastShippingFetch = now;
    console.log(`Returning ${sortedOrders.length} orders for shipping panel`);
    return sortedOrders;
  } catch (err) {
    console.error('Error fetching shipping orders:', err);
    return [];
  }
}

/**
 * Format date to readable string
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, fetch }) {
  // @ts-ignore - The session property is added by hooks.server.js
  if (locals.session?.user?.privilege_role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    const usersWithDetails = await Promise.all(users.map(async (user) => {
      const { data: purchases, error: purchasesError } = await supabaseAdmin
        .from('product_purchases')
        .select('*')
        .eq('user_id', user.id);

      if (purchasesError) {
        console.error('Error fetching product purchases:', purchasesError);
        return { ...user, purchases: [] };
      }

      const uniquePurchases = [...new Map(purchases.map(p => 
        [`${p.product_id}_${p.price_amount}`, p]
      )).values()];

      return {
        ...user,
        purchases: uniquePurchases,
        created_at_formatted: formatDate(user.created_at)
      };
    }));

    const shippingOrders = await getShippingOrders();
    
    // Fetch custom roles
    const customRolesResponse = await fetch('/api/admin/get-custom-roles');
    const customRolesData = await customRolesResponse.json();
    const customRoles = customRolesData.roles || [];
    
    // Convert array to object for easier access
    const customRolesObj = customRoles.reduce(
      /**
       * @param {Record<string, any>} acc - Accumulator object
       * @param {any} role - Current role object
       * @returns {Record<string, any>} Updated accumulator
       */
      (acc, role) => {
        acc[role.name] = role;
        return acc;
      }, 
      /** @type {Record<string, any>} */
      ({})
    );

    return {
      users: usersWithDetails,
      shippingOrders,
      customRoles: customRolesObj
    };
  } catch (err) {
    console.error('Error in admin load function:', err);
    throw error(500, 'Error loading admin data');
  }
} 