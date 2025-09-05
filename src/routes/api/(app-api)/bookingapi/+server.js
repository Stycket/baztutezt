import { json } from '@sveltejs/kit';
import { query, ensureInitialized, initializeDatabase } from '$lib/server/db';

// Get bookings for the calendar or for a specific user
export async function GET({ url, locals }) {
  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await ensureInitialized();

    const date = url.searchParams.get('date');
    const userId = url.searchParams.get('userId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const id = url.searchParams.get('id');
    const isAdmin = url.searchParams.get('admin') === 'true';
    
    let queryText = '';
    let params = [];
    
    // Only admins and moderators can access all bookings
    if (isAdmin) {
      // Verify admin/moderator role
      if (!locals.session?.user?.privilege_role || 
          (locals.session.user.privilege_role !== 'admin' && 
           locals.session.user.privilege_role !== 'moderator')) {
        return json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      // Get all bookings for admin view
      queryText = `
        SELECT b.*, p.username, p.email
        FROM bookings b
        LEFT JOIN profiles p ON b.user_id = p.id
        ORDER BY b.booking_date DESC, b.hours ASC
      `;
      
      const result = await query(queryText, params);
      return json(result.rows);
    }
    
    if (userId) {
      // Get user's bookings
      queryText = `
        SELECT b.*, p.username, p.email
        FROM bookings b
        JOIN profiles p ON b.user_id = p.id
        WHERE b.user_id = $1 AND b.status = 'active'
        ORDER BY b.booking_date ASC, b.hours ASC
      `;
      params = [userId];
    } 
    else if (date) {
      // Get all booked hours for a specific date
      queryText = `
        SELECT DISTINCT unnest(hours) as booked_hour, 
               MAX(admin_booking::int) as is_admin_booking
        FROM bookings
        WHERE booking_date = $1::date 
        AND status = 'active'
        GROUP BY booked_hour
        ORDER BY booked_hour
      `;
      params = [date];
      
      console.log('Checking bookings for date:', date); // Debug log
      
      const result = await query(queryText, params);
      console.log('Found booked hours:', result.rows); // Debug log
      
      const bookedHours = [];
      const adminBookedHours = [];
      
      result.rows.forEach(row => {
        const hour = parseInt(row.booked_hour);
        bookedHours.push(hour);
        if (row.is_admin_booking === 1) {
          adminBookedHours.push(hour);
        }
      });
      
      return json({
        date,
        booked_hours: bookedHours,
        admin_booked_hours: adminBookedHours
      });
    }
    else {
      // Get all active bookings with user info
      queryText = `
        SELECT b.*, p.username, p.email
        FROM bookings b
        JOIN profiles p ON b.user_id = p.id
        WHERE b.status = 'active'
        ORDER BY b.booking_date ASC, b.hours ASC
      `;
    }
    
    const result = await query(queryText, params);
    
    return json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

// Create a new booking
export async function POST({ request, locals }) {
  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await ensureInitialized();

    const { booking_date, hours, title = "", description = "", admin_booking = false } = await request.json();
    const userId = locals.session.user.id;
    
    // Check if user is admin for admin_booking
    const isAdmin = locals.session.user.privilege_role === 'admin' || 
                    locals.session.user.privilege_role === 'moderator';
    
    // Only allow admins to create admin bookings
    if (admin_booking && !isAdmin) {
      return json({ error: 'Only admins can create admin bookings' }, { status: 403 });
    }
    
    console.log('Creating booking for date:', booking_date, 'hours:', hours, 'admin_booking:', admin_booking); // Debug log
    
    // Validate booking date is within allowed range (today to 2 months ahead)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);
    maxDate.setHours(23, 59, 59, 999);
    
    const bookingDate = new Date(booking_date);
    bookingDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    
    // Skip date range validation for admin bookings
    if (!admin_booking && (bookingDate < today || bookingDate > maxDate)) {
      return json({ 
        error: 'Booking date must be between today and 2 months from now' 
      }, { status: 400 });
    }
    
    // Validate hours - MODIFIED to allow unlimited hours for admin bookings
    if (!Array.isArray(hours) || hours.length === 0) {
      return json({ error: 'Invalid hours selection' }, { status: 400 });
    }
    
    // Only limit regular user bookings to 3 hours
    if (!admin_booking && hours.length > 3) {
      return json({ error: 'Regular users can book a maximum of 3 hours' }, { status: 400 });
    }
    
    for (const hour of hours) {
      if (hour < 0 || hour > 23) {
        return json({ error: 'Invalid hour' }, { status: 400 });
      }
    }
    
    // Check if user exists in profiles table, if not create profile
    const userEmail = locals.session.user.email;
    const username = locals.session.user.user_metadata?.username || 
                    userEmail?.split('@')[0] || 
                    `user_${userId.substring(0, 8)}`;

    try {
      // Check if user exists and update their info if needed
      await query(
        `INSERT INTO profiles (id, email, username, role, privilege_role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE 
         SET email = EXCLUDED.email,
             username = EXCLUDED.username,
             updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          userEmail || '',
          username,
          locals.session.user.role || 'free',
          locals.session.user.privilege_role || 'user'
        ]
      );
      console.log(`User profile created/updated for ${userId} (${username})`);
    } catch (userError) {
      console.error('Error updating user profile:', userError);
      return json({ error: 'Database error: Cannot update user profile' }, { status: 500 });
    }
    
    // Make sure bookings table exists and check active bookings count for regular users
    if (!admin_booking) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayFormatted = today.toISOString().split('T')[0];
        
        const activeBookingsResult = await query(
          `SELECT COUNT(*) FROM bookings 
           WHERE user_id = $1 
           AND status = 'active' 
           AND admin_booking = false
           AND booking_date >= $2::date`,  // Only count bookings from today forward
          [userId, todayFormatted]
        );
        
        const activeBookingsCount = parseInt(activeBookingsResult.rows[0].count);
        if (activeBookingsCount >= 2) {
          return json({ 
            error: 'You can only have 2 active future bookings at a time' 
          }, { status: 400 });
        }
      } catch (tableError) {
        // If bookings table doesn't exist, create it
        if (tableError.code === '42P01') {
          try {
            console.log('Bookings table does not exist, creating it');
            await query(`
              CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES profiles(id),
                booking_date DATE NOT NULL,
                hours INTEGER[] NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                admin_booking BOOLEAN DEFAULT FALSE
              );
              
              CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
              CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
              CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
            `);
          } catch (createError) {
            console.error('Failed to create bookings table:', createError);
            return json({ error: 'Database error: Cannot create bookings table' }, { status: 500 });
          }
        } else {
          console.error('Error checking active bookings:', tableError);
          return json({ error: 'Database error: Cannot check active bookings' }, { status: 500 });
        }
      }
    }
    
    // Check if any of the time slots are already booked
    try {
      const existingBookingResult = await query(
        `SELECT * FROM bookings 
         WHERE booking_date = $1 
         AND status = 'active'
         AND (SELECT COUNT(*) FROM unnest(hours) h WHERE h = ANY($2)) > 0`,
        [booking_date, hours]
      );
      
      if (existingBookingResult.rows.length > 0) {
        return json({ 
          error: 'One or more time slots are already booked' 
        }, { status: 400 });
      }
    } catch (checkError) {
      console.error('Error checking existing bookings:', checkError);
      return json({ error: 'Database error: Cannot check existing bookings' }, { status: 500 });
    }
    
    // Create the booking with all hours
    try {
      const result = await query(
        `INSERT INTO bookings (user_id, booking_date, hours, title, description, status, admin_booking)
         VALUES ($1, $2, $3, $4, $5, 'active', $6)
         RETURNING *`,
        [userId, booking_date, hours, title, description, admin_booking]
      );
      
      // Get full booking info with user details
      const fullBookingResult = await query(
        `SELECT b.*, p.username, p.email 
         FROM bookings b 
         JOIN profiles p ON b.user_id = p.id 
         WHERE b.id = $1`,
        [result.rows[0].id]
      );
      
      return json(fullBookingResult.rows[0]);
    } catch (createError) {
      console.error('Error creating booking:', createError);
      return json({ error: 'Database error: Cannot create booking' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

// Cancel a booking - fix the cancellation logic to handle constraint errors
export async function DELETE({ url, locals }) {
  if (!locals.session?.user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await ensureInitialized();

    const id = url.searchParams.get('id');
    const isAdmin = url.searchParams.get('admin') === 'true';
    
    if (!id) {
      return json({ error: 'Booking ID is required' }, { status: 400 });
    }
    
    // Get the booking to check ownership
    const bookingResult = await query(
      `SELECT * FROM bookings WHERE id = $1`,
      [id]
    );
    
    if (bookingResult.rows.length === 0) {
      return json({ error: 'Booking not found' }, { status: 404 });
    }
    
    const booking = bookingResult.rows[0];
    
    // Check if user is owner or admin
    const isOwner = booking.user_id === locals.session.user.id;
    const isAdminRole = locals.session.user.privilege_role === 'admin' || 
                        locals.session.user.privilege_role === 'moderator';
                        
    if (!isOwner && !(isAdmin && isAdminRole)) {
      return json({ error: 'Unauthorized to cancel this booking' }, { status: 403 });
    }
    
    // First, check if there's already a cancelled booking with the same details
    // to handle the unique constraint issue
    const existingCancelled = await query(
      `SELECT * FROM bookings 
       WHERE user_id = $1 AND booking_date = $2 AND status = 'cancelled'`,
      [booking.user_id, booking.booking_date]
    );
    
    if (existingCancelled.rows.length > 0) {
      // If we already have a cancelled booking for this date, just delete this one
      await query(
        `DELETE FROM bookings WHERE id = $1`,
        [id]
      );
      
      return json({ 
        message: 'Booking removed successfully', 
        booking: { ...booking, status: 'cancelled' } 
      });
    }
    
    // Update the booking status to cancelled (this is the normal path)
    const result = await query(
      `UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return json({ error: 'Failed to cancel booking' }, { status: 500 });
    }
    
    return json({ message: 'Booking cancelled successfully', booking: result.rows[0] });
  } catch (error) {
    // Handle constraint errors specifically with a better error message
    if (error.code === '23505' && error.constraint === 'unique_user_booking_date') {
      // Try to delete the booking directly as a fallback
      try {
        await query(`DELETE FROM bookings WHERE id = $1`, [url.searchParams.get('id')]);
        return json({ message: 'Booking removed successfully' });
      } catch (deleteError) {
        console.error('Error removing booking after constraint error:', deleteError);
        return json({ error: 'Could not cancel booking due to a database constraint' }, { status: 400 });
      }
    }
    
    console.error('Error cancelling booking:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
