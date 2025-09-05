<script>
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  import { api } from '$lib/utils/api';
  
  let loading = true;
  let loadingBookings = false;
  let bookings = [];
  let userBookings = [];
  let selectedDate = null;
  let selectedHours = [];
  let bookedHours = [];
  let adminBookedHours = [];
  let error = null;
  let success = null;
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let calendar = [];
  let activeBookingsCount = 0; // Reactive variable for active bookings count

  // Add CSS variables for RGB values of colors for transparency
  let primaryRgb = "59, 130, 246"; // Default blue in RGB
  let dangerRgb = "244, 67, 54";   // Default red in RGB
  let warningRgb = "255, 152, 0";  // Default orange in RGB

  let selectedUserId = null;
  let users = [];
  
  $: isAdmin = $session?.user?.privilege_role === 'admin';
  
  // Update RGB values on component mount
  onMount(async () => {
    // Set default RGB values based on theme
    updateRgbValues();
    
    // Check if session is expired before proceeding
    if (session.isExpired()) {
      console.log('Session expired on page load, redirecting to login');
      window.location.href = '/login';
      return;
    }
    
    // Make sure session is fully loaded before fetching booking data
    if (!$session?.user?.id || !$session?.csrf_token) {
      try {
        console.log('Session not fully loaded, waiting for session');
        // Wait for session to be fully loaded
        await new Promise<void>(resolve => {
          const unsubscribe = session.subscribe(value => {
            if (value?.user?.id && value?.csrf_token) {
              console.log('Session fully loaded for booking page');
              unsubscribe();
              resolve();
            }
          });
          
          // Add a timeout to prevent infinite waiting
          setTimeout(() => {
            unsubscribe();
            resolve();
          }, 5000); // 5 second timeout
        });
        
        // Check again after waiting
        if (session.isExpired()) {
          console.log('Session expired after waiting, redirecting to login');
          window.location.href = '/login';
          return;
        }
      } catch (err) {
        console.error('Error waiting for session:', err);
        window.location.href = '/login';
        return;
      }
    }
    
    // Initialize the calendar
    try {
      await loadBookings();
    } catch (err) {
      console.error('Error loading bookings:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Session expired') || errorMessage.includes('401') || errorMessage.includes('403')) {
        window.location.href = '/login';
        return;
      }
    }
    
    // Explicitly load user bookings to make sure they're up to date
    if ($session?.user) {
      try {
        await loadUserBookings();
      } catch (err) {
        console.error('Error loading user bookings:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('Session expired') || errorMessage.includes('401') || errorMessage.includes('403')) {
          window.location.href = '/login';
          return;
        }
      }
    }
    
    // Add listener for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateRgbValues();
        }
      });
    });
    
    // Start observing theme changes on document root
    observer.observe(document.documentElement, { attributes: true });
    
    return () => {
      // Clean up observer on component destroy
      observer.disconnect();
    };
  });
  
  // Function to update RGB values based on current theme
  function updateRgbValues() {
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    
    // Try to convert the primary color to RGB
    if (primaryColor) {
      const rgb = hexToRgb(primaryColor);
      if (rgb) {
        primaryRgb = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        
        // Update CSS variables
        document.documentElement.style.setProperty('--primary-rgb', primaryRgb);
        document.documentElement.style.setProperty('--danger-rgb', dangerRgb);
        document.documentElement.style.setProperty('--warning-rgb', warningRgb);
      }
    }
  }
  
  // Helper function to convert hex to RGB
  function hexToRgb(hex) {
    // Remove the # if present
    hex = hex.replace(/^#/, '');
    
    // Handle shorthand hex
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const bigint = parseInt(hex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  // Generate time slots
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i < 10 ? `0${i}` : `${i}`;
    return { 
      id: i,
      label: hour,
      value: hour
    };
  });

  // Generate calendar days
  function generateCalendar(month, year) {
    // Create dates using UTC to avoid timezone issues
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const daysInMonth = lastDay.getUTCDate();
    const startingDayOfWeek = firstDay.getUTCDay();
    
    // Clear the calendar
    calendar = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendar.push({ day: null, date: null, isCurrentMonth: false });
    }
    
    // Get current date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Add days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date in UTC
      const date = new Date(Date.UTC(year, month, day));
      const dateString = date.toISOString().split('T')[0];
      
      // Get bookings for this day (ONLY ACTIVE BOOKINGS)
      const dayBookings = bookings.filter(booking => 
        booking.booking_date.split('T')[0] === dateString && 
        booking.status === 'active'
      );
      
      // Get booked hours for this day
      const bookedHours = dayBookings.map(booking => parseInt(booking.hour));
      
      // Create a map of which hours are booked and by whom
      const hourBookings = {};
      dayBookings.forEach(booking => {
        const hours = booking.hours || [booking.hour];
        hours.forEach(hour => {
          hourBookings[hour] = {
            id: booking.id,
            username: booking.username,
            isCurrentUser: booking.user_id === $session?.user?.id,
            status: booking.status,
            isAdmin: booking.admin_booking
          };
        });
      });
      
      // Check if user has ACTIVE regular bookings on this day (exclude admin bookings)
      const userBookingsOnDay = dayBookings.filter(
        booking => booking.user_id === $session?.user?.id && 
                   booking.status === 'active' && 
                   !booking.admin_booking
      );
      
      // Get today's date for comparison (without time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if this date is in the past
      const isPastDate = date < today;
      
      // Only allow selecting current or future dates
      const isSelectable = !isPastDate;
      
      calendar.push({
        day,
        date: dateString,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        isPastDate, // Add this flag to identify past dates
        bookedHours,
        hourBookings,
        hasUserBookings: userBookingsOnDay.length > 0,
        isSelectable,
        bookings: dayBookings
      });
    }
  }

  // Update active bookings count - modified to exclude past dates
  function updateActiveBookingsCount() {
    // Get current date in YYYY-MM-DD format for comparison
    const today = new Date().toISOString().split('T')[0];
    
    // Only count regular (non-admin) bookings that are active AND in the future
    const activeBookings = userBookings.filter(b => 
      b.status === 'active' && 
      !b.admin_booking && 
      b.booking_date.split('T')[0] >= today // This line excludes past bookings
    );
    
    activeBookingsCount = activeBookings.length;
    console.log('Updated active bookings count:', activeBookingsCount, 'from total user bookings:', userBookings.length);
  }

  // Helper function to format date for API requests
  function formatDateForAPI(date) {
    // The date string from the calendar is already in YYYY-MM-DD format
    // and was generated using UTC dates, so we can use it directly
    return date;
  }

  // Create a booking
  async function createBooking() {
    if (!selectedDate || selectedHours.length === 0) {
      error = 'Please select a date and time slots';
      return;
    }
    
    // Check if session is expired before creating booking
    if (session.isExpired()) {
      console.log('Session expired, redirecting to login');
      window.location.href = '/login';
      return;
    }
    
    try {
      loading = true;
      error = null;
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Count only regular (non-admin) bookings that are ACTIVE AND in the FUTURE
      const futureMeetingsCount = userBookings.filter(b => 
        b.status === 'active' && 
        !b.admin_booking && 
        b.booking_date.split('T')[0] >= today
      ).length;

      // Check limit for future bookings only
      if (futureMeetingsCount >= 2) {
        error = 'You can only have 2 active future bookings';
        loading = false;
        return;
      }
      
      const formattedDate = formatDateForAPI(selectedDate);
      const sortedHours = [...selectedHours].sort((a, b) => a - b);
      
      // Add a query parameter to indicate this is a regular booking
      const response = await api.post('/api/bookingapi', {
        booking_date: formattedDate,
        hours: sortedHours,
        title: `Booking on ${formattedDate}`,
        description: `Booking: ${sortedHours.map(h => `${h}:00-${h + 1}:00`).join(', ')}`,
        admin_booking: false, // Always false for bookings from the booking system page
        is_regular_booking: true // Add this flag to help backend distinguish
      });
      
      if (!response.ok) {
        const data = await response.json();
        
        // Check for authentication errors
        if (response.status === 401 || response.status === 403) {
          console.log('Authentication error during booking creation');
          window.location.href = '/login';
          return;
        }
        
        throw new Error(data.error || 'Booking failed');
      }
      
      success = 'Booking created successfully';
      selectedDate = null;
      selectedHours = [];
      
      // First reload calendar bookings
      await loadBookings();
      
      // Then explicitly reload user bookings to make sure they're up to date
      await loadUserBookings();
    } catch (err) {
      console.error('Error creating booking:', err);
      
      // Handle session expiration errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Session expired') || errorMessage.includes('401') || errorMessage.includes('403')) {
        window.location.href = '/login';
        return;
      }
      
      error = errorMessage;
    } finally {
      loading = false;
    }
  }

  // Helper function to format time slots
  function formatTimeSlots(booking) {
    if (!booking.hours) {
      // Handle legacy single-hour bookings
      return `${booking.hour}:00 - ${parseInt(booking.hour) + 1}:00`;
    }
    
    // Sort hours and find consecutive ranges
    const hours = booking.hours.sort((a, b) => a - b);
    let ranges = [];
    let start = hours[0];
    let prev = hours[0];
    
    for (let i = 1; i <= hours.length; i++) {
      if (i === hours.length || hours[i] !== prev + 1) {
        ranges.push(`${start}:00-${prev + 1}:00`);
        if (i < hours.length) {
          start = hours[i];
        }
      }
      if (i < hours.length) {
        prev = hours[i];
      }
    }
    
    return ranges.join(', ');
  }

  // Load all bookings for the current month
  async function loadBookings() {
    try {
      loadingBookings = true;
      error = null;
      
      // Calculate start and end dates for the query
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
      
      const [calendarResponse, userResponse] = await Promise.all([
        api.get(`/api/bookingapi?startDate=${startDate}&endDate=${endDate}`),
        $session?.user ? api.get(`/api/bookingapi?userId=${$session.user.id}`) : null
      ]);
      
      if (!calendarResponse.ok) {
        throw new Error('Failed to load bookings');
      }
      
      bookings = await calendarResponse.json();
      
      if (userResponse?.ok) {
        const userBookingsData = await userResponse.json();
        // Store all bookings but update count only for regular bookings
        userBookings = Array.isArray(userBookingsData) ? userBookingsData : [];
        updateActiveBookingsCount();
      } else {
        userBookings = [];
        activeBookingsCount = 0;
      }
      
      // Update calendar with new booking information
      generateCalendar(currentMonth, currentYear);
      loading = false;
    } catch (err) {
      console.error('Error loading bookings:', err);
      error = err.message;
      loading = false;
    } finally {
      loadingBookings = false;
    }
  }

  // Function to load booked hours for a date
  async function loadBookedHours(date) {
    try {
      if (!date) return;

      loading = true;
      console.log('Loading booked hours for date:', date); // Debug log

      const response = await api.get(`/api/bookingapi?date=${date}`);
      if (!response.ok) throw new Error('Failed to load booked hours');
      const data = await response.json();
      
      // The API returns an object with a booked_hours property for the date endpoint
      if (data.booked_hours) {
        bookedHours = data.booked_hours;
        adminBookedHours = data.admin_booked_hours || [];
      } else {
        // If we got a direct array of bookings (unlikely in this case)
        bookedHours = Array.isArray(data) ? 
          data.filter(b => b.status === 'active').map(b => parseInt(b.hour)) : 
          [];
        adminBookedHours = [];
      }
      
      console.log('Loaded booked hours:', bookedHours, 'and admin booked hours:', adminBookedHours, 'for date:', date);
    } catch (err) {
      console.error('Error loading booked hours:', err);
      error = 'Failed to load booked time slots';
      bookedHours = [];
      adminBookedHours = [];
    } finally {
      loading = false;
    }
  }

  // Update date selection handler
  async function selectDate(day) {
    if (!day.isSelectable) return;
    
    console.log('Selected date:', day.date); // Debug log
    selectedDate = day.date;
    selectedHours = [];
    error = null;
    success = null;
    
    await loadBookedHours(day.date);
  }
  
  // Toggle hour selection
  function toggleHourSelection(hour) {
    const hourIndex = selectedHours.indexOf(hour);
    
    if (hourIndex >= 0) {
      // If already selected, remove it
      selectedHours = [...selectedHours.slice(0, hourIndex), ...selectedHours.slice(hourIndex + 1)];
    } else {
      // If user already has 3 hours selected, prevent adding more
      if (selectedHours.length >= 3) {
        error = 'You can select a maximum of 3 hours per booking';
        return;
      }
      
      // Add hour to selection, keeping them sorted
      selectedHours = [...selectedHours, hour].sort((a, b) => a - b);
    }
  }

  // Check if an hour is available (not booked)
  function isHourAvailable(date, hour) {
    const calendarDay = calendar.find(day => day.date === date);
    if (!calendarDay) return false;
    
    return !calendarDay.bookedHours.includes(hour);
  }
  
  // Check if an hour is booked by current user or admin
  function isHourBookedByUser(date, hour) {
    const calendarDay = calendar.find(day => day.date === date);
    if (!calendarDay) return false;
    
    const booking = calendarDay.hourBookings[hour];
    return booking?.isCurrentUser || booking?.isAdmin;
  }

  // Check if an hour is booked by another user
  function isHourBookedByOthers(date, hour) {
    const calendarDay = calendar.find(day => day.date === date);
    if (!calendarDay) return false;
    
    const booking = calendarDay.hourBookings[hour];
    return booking && !booking.isCurrentUser;
  }

  // Cancel a booking
  async function cancelBooking(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    
    // Check if session is expired before cancelling booking
    if (session.isExpired()) {
      console.log('Session expired, redirecting to login');
      window.location.href = '/login';
      return;
    }
    
    try {
      loading = true;
      error = null;
      success = null;
      
      // Store booking details for UI update
      const bookingToCancel = userBookings.find(booking => booking.id === id);
      if (!bookingToCancel) {
        throw new Error('Booking not found');
      }
      
      // Immediately update UI to remove the cancelled booking
      userBookings = userBookings.filter(booking => booking.id !== id);
      updateActiveBookingsCount();
      
      // Make the API call
      const response = await api.delete(`/api/bookingapi?id=${id}`);
      
      if (!response.ok) {
        // Check for authentication errors
        if (response.status === 401 || response.status === 403) {
          console.log('Authentication error during booking cancellation');
          window.location.href = '/login';
          return;
        }
        
        // If API call fails, restore the booking in the UI
        const data = await response.json();
        console.error('Cancel booking API error:', data);
        
        // Restore the booking in UI only if it's a non-constraint error
        if (!data.error?.includes('unique constraint')) {
          userBookings = [...userBookings, bookingToCancel];
          updateActiveBookingsCount();
        }
        
        // Show a friendly error message
        if (data.error?.includes('unique constraint')) {
          throw new Error('This booking was already cancelled');
        } else {
          throw new Error(data.error || 'Failed to cancel booking');
        }
      }
      
      // If we also need to update the calendar view for the selected date
      if (selectedDate && bookingToCancel && 
          bookingToCancel.booking_date.split('T')[0] === selectedDate) {
        await loadBookedHours(selectedDate);
      }
      
      // Update calendar in background
      loadBookings().catch(err => {
        console.error('Error reloading bookings after cancel:', err);
      });
      
      success = 'Booking cancelled successfully';
    } catch (err) {
      console.error('Error cancelling booking:', err);
      
      // Handle session expiration errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Session expired') || errorMessage.includes('401') || errorMessage.includes('403')) {
        window.location.href = '/login';
        return;
      }
      
      error = errorMessage;
    } finally {
      loading = false;
    }
  }

  // Function to set month directly
  function setMonth(newMonth, newYear) {
    currentMonth = newMonth;
    currentYear = newYear;
    loadBookings();
  }

  // Get display date for month buttons
  function getDisplayDate(monthOffset) {
    // Always use the actual current date as base for month buttons
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate target month and year correctly
    let targetMonth = currentMonth + monthOffset;
    let targetYear = currentYear;
    
    // Handle year boundaries
    while (targetMonth > 11) {
      targetMonth -= 12;
      targetYear += 1;
    }
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }
    
    // Create date for the first day of the target month
    const date = new Date(targetYear, targetMonth, 1);
    
    return {
      month: targetMonth,
      year: targetYear,
      label: date.toLocaleDateString('sv-SE', { month: 'long' }) // Swedish locale, full month name
    };
  }

  // Format date for display
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Get month name
  function getMonthName(month) {
    return new Date(2000, month, 1).toLocaleDateString('en-US', { month: 'long' });
  }
  
  // Handle keyboard events for calendar days
  function handleKeyPress(event, day) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectDate(day);
    }
  }

  // Handle keyboard events for time slots
  function handleTimeSlotKeyPress(event, slot) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isHourBookedByUser(selectedDate, slot.id) && !isHourBookedByOthers(selectedDate, slot.id)) {
        toggleHourSelection(slot.id);
      }
    }
  }

  // Check if an hour is booked
  function isHourBooked(hour) {
    return bookedHours.includes(hour);
  }

  // Check if an hour is an admin booking
  function isAdminBooking(hour) {
    return adminBookedHours.includes(hour);
  }

  // Check if an hour can be selected
  function canSelectHour(hour) {
    // Can't select if already booked
    if (isHourBooked(hour)) return false;
    
    // Can always unselect current hour
    if (selectedHours.includes(hour)) return true;
    
    // Can't select more than 3 hours
    if (selectedHours.length >= 3) return false;
    
    // Can only select consecutive hours
    if (selectedHours.length > 0) {
      const min = Math.min(...selectedHours);
      const max = Math.max(...selectedHours);
      return hour === min - 1 || hour === max + 1;
    }
    
    return true;
  }

  // Handle hour selection
  function handleHourSelect(hour) {
    if (selectedHours.includes(hour)) {
      // Always allow deselection of any selected hour
      selectedHours = selectedHours.filter(h => h !== hour);
      
      // If this breaks continuity in the selection, keep only the larger group
      if (selectedHours.length > 1) {
        // Find gaps in the sequence
        const sortedHours = [...selectedHours].sort((a, b) => a - b);
        const groups = [];
        let currentGroup = [sortedHours[0]];
        
        for (let i = 1; i < sortedHours.length; i++) {
          if (sortedHours[i] === sortedHours[i-1] + 1) {
            // Add to current group if consecutive
            currentGroup.push(sortedHours[i]);
          } else {
            // Start a new group if not consecutive
            groups.push(currentGroup);
            currentGroup = [sortedHours[i]];
          }
        }
        groups.push(currentGroup);
        
        // Keep only the largest group to maintain consecutive selection
        if (groups.length > 1) {
          const largestGroup = groups.reduce((max, group) => 
            group.length > max.length ? group : max, groups[0]);
          selectedHours = largestGroup;
        }
      }
    } else if (canSelectHour(hour)) {
      // Add the hour if it can be selected
      selectedHours = [...selectedHours, hour].sort((a, b) => a - b);
    }
  }

  // Add a watch on calendar month changes to clear state
  $: if (currentMonth || currentYear) {
    // Clear booking state when month changes
    selectedDate = null;
    selectedHours = [];
    bookedHours = [];
  }

  // Explicitly load user bookings
  async function loadUserBookings() {
    try {
      if (!$session?.user?.id) return;
      
      const response = await api.get(`/api/bookingapi?userId=${$session.user.id}`);
      
      if (response.ok) {
        const userBookingsData = await response.json();
        userBookings = Array.isArray(userBookingsData) ? userBookingsData : [];
        console.log('User bookings loaded:', userBookings.length);
        updateActiveBookingsCount();
      }
    } catch (err) {
      console.error('Error loading user bookings:', err);
    }
  }
</script>

<div class="container">
  <div 
    class="background-image" 
    style="background-image: url('https://wallpapers.com/images/featured/white-gradient-background-o0tqqpgs66oz4rfr.jpg');"
  ></div>
  
  <div class="content-wrapper">
    <div class="booking-system">
      <h1>Bokning</h1>
      
      <!-- Debug info -->
      <div class="debug-info">
        Active bookings: {activeBookingsCount}
      </div>
      
      {#if error}
        <div class="error">
          {error}
        </div>
      {/if}
      
      {#if success}
        <div class="success">
          {success}
        </div>
      {/if}
      
      <div class="calendar-controls">
        {#if currentMonth !== getDisplayDate(0).month || currentYear !== getDisplayDate(0).year}
          <button on:click={() => setMonth(getDisplayDate(0).month, getDisplayDate(0).year)} class="control-button">
            {getDisplayDate(0).label}
          </button>
        {:else}
          <button class="control-button active">
            {getDisplayDate(0).label}
          </button>
        {/if}
        
        {#if currentMonth !== getDisplayDate(1).month || currentYear !== getDisplayDate(1).year}
          <button on:click={() => setMonth(getDisplayDate(1).month, getDisplayDate(1).year)} class="control-button">
            {getDisplayDate(1).label}
          </button>
        {:else}
          <button class="control-button active">
            {getDisplayDate(1).label}
          </button>
        {/if}
        
        {#if currentMonth !== getDisplayDate(2).month || currentYear !== getDisplayDate(2).year}
          <button on:click={() => setMonth(getDisplayDate(2).month, getDisplayDate(2).year)} class="control-button">
            {getDisplayDate(2).label}
          </button>
        {:else}
          <button class="control-button active">
            {getDisplayDate(2).label}
          </button>
        {/if}
      </div>
      
      <div class="calendar">
        <!-- Calendar header -->
        <div class="calendar-header">
          <div>Sön</div>
          <div>Mån</div>
          <div>Tis</div>
          <div>Ons</div>
          <div>Tor</div>
          <div>Fre</div>
          <div>Lör</div>
        </div>
        
        <!-- Calendar grid -->
        <div class="calendar-grid" role="grid">
          {#each calendar as day}
            {#if day.day === null}
              <div class="calendar-day empty" role="gridcell"></div>
            {:else}
              <button 
                type="button"
                class="calendar-day {day.isToday ? 'today' : ''} 
                                 {day.hasUserBookings ? 'has-user-bookings' : ''} 
                                 {day.isSelectable ? 'selectable' : ''} 
                                 {day.isPastDate ? 'isPastDate' : ''}
                                 {selectedDate === day.date ? 'selected' : ''}"
                on:click={() => selectDate(day)}
                on:keydown={e => handleKeyPress(e, day)}
                role="gridcell"
                aria-selected={selectedDate === day.date}
                aria-label={formatDate(day.date)}
                disabled={!day.isSelectable}
              >
                <div class="day-number">{day.day}</div>
                
                <!-- Small indicators for booked hours -->
                {#if day.bookedHours && day.bookedHours.length > 0}
                  <div class="hour-indicators" aria-hidden="true">
                    <!-- Dots for all bookings -->
                    {#each day.bookedHours as hour}
                      <div 
                        class="hour-indicator {day.hourBookings[hour]?.isAdmin ? 'admin-booking' : 'booked'}" 
                        title="{day.hourBookings[hour]?.username || 'Booked'} at {hour}:00 {day.hourBookings[hour]?.isAdmin ? '(Admin)' : ''}">
                      </div>
                    {/each}
                  </div>
                {/if}
                
                <!-- Add separate green dot only for user bookings -->
                {#if day.hasUserBookings}
                  <div class="hour-indicators user-indicators" aria-hidden="true">
                    <div 
                      class="hour-indicator user-booking"
                      title="You have a booking on this day">
                    </div>
                  </div>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      </div>
      
      {#if selectedDate}
        <div class="booking-form">
          <h3>Välj tid för {formatDate(selectedDate)}</h3>
          <p class="info-text">Bastun ligger just nu på flotte och du behöver ro</p>
          
          {#if loading}
            <div class="loading">Loading available time slots...</div>
          {:else}
            <div class="time-slots-grid" role="listbox" aria-label="Available time slots">
              {#each timeSlots as slot}
                {@const isBooked = isHourBooked(slot.id)}
                {@const isAdminBooked = isAdminBooking(slot.id)}
                {@const isSelected = selectedHours.includes(slot.id)}
                {@const canSelect = canSelectHour(slot.id)}
                
                <button 
                  type="button"
                  class="time-slot"
                  class:booked={isBooked && !isAdminBooked}
                  class:admin-booked={isAdminBooked}
                  class:available={!isBooked}
                  class:selected={selectedHours.includes(slot.id)}
                  on:click|preventDefault={() => handleHourSelect(slot.id)}
                  role="option"
                  aria-selected={selectedHours.includes(slot.id)}
                  aria-label={`Hour ${slot.label} - ${isBooked ? (isAdminBooked ? 'Admin Booked' : 'Booked') : selectedHours.includes(slot.id) ? 'Selected' : 'Available'}`}
                  disabled={isBooked || (!selectedHours.includes(slot.id) && !canSelect)}
                >
                  <span class="time-label">{slot.label}</span>
                </button>
              {/each}
            </div>
          {/if}
          
          <div class="selection-info">
            {#if selectedHours.length > 0}
              <p>Vald tid: 
                {(() => {
                  const sortedHours = [...selectedHours].sort((a, b) => a - b);
                  const start = sortedHours[0];
                  const end = sortedHours[sortedHours.length - 1] + 1;
                  return `${start}:00-${end}:00`;
                })()}
              </p>
            {:else}
              <p>Välj tid</p>
            {/if}
          </div>

          <div class="form-actions">
          
            <button 
              on:click={createBooking} 
              class="submit-button" 
              disabled={loading || selectedHours.length === 0}
            >
              {loading ? 'Bokar...' : 'Boka vald tid'}
            </button>
          </div>
        </div>
      {/if}
      
      <!-- My bookings section -->
      <div class="my-bookings">
        <h3>Mina Bokningar ({activeBookingsCount}/2)</h3>
        
        {#if userBookings.filter(b => 
          b.status === 'active' && 
          !b.admin_booking && 
          b.booking_date.split('T')[0] >= new Date().toISOString().split('T')[0]
        ).length === 0}
          <p>Du har inga aktiva bokningar</p>
        {:else}
          <div class="bookings-list">
            {#each userBookings.filter(b => 
              b.status === 'active' && 
              !b.admin_booking && 
              b.booking_date.split('T')[0] >= new Date().toISOString().split('T')[0]
            ) as booking}
              <div class="booking-card">
                <div class="booking-header">
                  <h4>{formatDate(booking.booking_date)}</h4>
                  <div class="booking-info">
                    <div class="booking-time">
                      {formatTimeSlots(booking)}
                    </div>
              
                  </div>
                </div>
                
                <div class="booking-actions">
                  <button on:click={() => cancelBooking(booking.id)} class="cancel-booking">
                    Cancel
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .container {
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: -2;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    box-sizing: border-box;
    position: relative;
    z-index: 1;
  }

  @media (min-width: 768px) {
    .content-wrapper {
      padding: 2rem;
    }
  }

  .booking-system {
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 1rem;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
  }

  @media (min-width: 768px) {
    .booking-system {
      padding: 2rem;
    }
  }

  /* Updated styles for title and calendar controls */
  h1 {
    font-size: 2rem;
    margin-bottom: 1.5rem;
    color: #2c3e50;
    text-align: left;
  }
  
  .calendar-controls {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 1.5rem;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  
  .control-button {
    background-color: rgba(255, 255, 255, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 0.25rem 0.35rem;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.2s;
    min-width: 70px;
    font-size: 0.8rem;
    text-align: center;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .control-button:hover {
    border-color: #2c3e50;
  }
  
  .control-button.active {
    background-color: #2c3e50;
    border-color: #2c3e50;
    color: white;
    font-weight: bold;
  }
  
  /* Adjust for very small screens */
  @media (max-width: 400px) {
    .control-button {
      min-width: 60px;
      padding: 0.2rem 0.3rem;
      font-size: 0.75rem;
      height: 22px;
    }
    
    .calendar-controls {
      gap: 0.2rem;
    }
  }
  
  /* Calendar */
  .calendar {
    margin-bottom: 2rem;
    border-radius: 8px;
    overflow: hidden;
  }
  
  @media (min-width: 768px) {
    .calendar {
      background-color: rgba(255, 255, 255, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
  }
  
  .calendar-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background-color: #2c3e50;
    color: white;
    padding: 0.75rem 0;
    font-weight: bold;
    text-align: center;
  }
  
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background-color: var(--border-color);
  }
  
  .calendar-day {
    min-height: 50px;
    padding: 0.35rem;
    font-size: 0.8rem;
  }
  
  @media (min-width: 768px) {
    .calendar-day {
      min-height: 60px;
      padding: 0.5rem;
      font-size: 0.85rem;
    }
  }
  
  .day-number {
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  
  .empty {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .today {
    background-color: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
  }
  
  .today.selected {
    background-color: rgba(59, 130, 246, 0.3);
    border: 2px solid rgba(59, 130, 246, 0.6);
  }
  
  .today .day-number {
    color: rgba(30, 64, 175, 0.9);
    font-weight: bold;
  }
  
  .has-user-bookings {
    background-color: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
  }
  
  .has-user-bookings.selected {
    background-color: rgba(16, 185, 129, 0.3);
    border: 2px solid rgba(16, 185, 129, 0.6);
  }
  
  .has-user-bookings .day-number {
    color: rgba(0, 0, 0, 0.8);
  }
  
  .selected {
    background-color: rgba(44, 62, 80, 0.25);
    border: 2px solid #2c3e50;
  }
  
  /* Hour indicators */
  .hour-indicators {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 0.25rem;
    justify-content: center;
  }
  
  .hour-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  
  .hour-indicator.booked {
    background-color: #f44336;
  }
  
  .hour-indicator.user-booking {
    background-color: #10b981;
    margin-left: 4px;
  }

  .hour-indicator.admin-booking {
    background-color: #2196F3;
  }
  
  /* Dark mode indicators */
  :global(:root[data-theme="dark"]) .hour-indicator.booked {
    background-color: #f44336;
    box-shadow: 0 0 2px rgba(244, 67, 54, 0.6);
  }
  
  :global(:root[data-theme="dark"]) .hour-indicator.user-booking {
    background-color: #10b981;
    box-shadow: 0 0 2px rgba(16, 185, 129, 0.6);
  }
  
  :global(:root[data-theme="dark"]) .hour-indicator.admin-booking {
    background-color: #2196F3;
    box-shadow: 0 0 2px rgba(33, 150, 243, 0.6);
  }
  
  /* Booking form */
  .booking-form {
    padding: 1rem 0;
    margin-top: 1rem;
  }
  
  @media (min-width: 768px) {
    .booking-form {
      background-color: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
  }
  
  .info-text {
    margin-bottom: 1rem;
    color: #155724;
    font-weight: 500;
    background-color: rgba(40, 167, 69, 0.1);
    border: 1px solid rgba(40, 167, 69, 0.2);
    border-radius: 4px;
    padding: 0.75rem 1rem;
  }
  
  /* Time slots */
  .time-slots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 1px;
    margin: 1rem 0;
  }
  
  @media (min-width: 768px) {
    .time-slots-grid {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    }
  }
  
  .time-slot {
    position: relative;
    padding: 0;
    aspect-ratio: 1/1;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.3);
    color: var(--text-color);
    font-size: 0.8rem;
    transition: all 0.15s ease-out;
    cursor: pointer;
    width: 100%;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    min-height: 50px;
  }

  @media (min-width: 768px) {
    .time-slot {
      min-height: 60px;
    }
  }

  /* Non-selectable slots */
  .time-slot:disabled {
    opacity: 0.6;
    background-color: rgba(100, 100, 100, 0.25) !important;
    color: rgba(100, 100, 100, 0.9) !important;
    cursor: not-allowed;
    border: 1px dashed rgba(100, 100, 100, 0.5) !important;
    transition: all 0.15s ease-out;
  }

  /* Booked slots */
  .time-slot.booked {
    background-color: rgba(123, 44, 44, 0.1) !important;
    border-color: rgba(123, 44, 44, 0.3) !important;
    color: #7b2c2c !important;
    cursor: not-allowed;
    transition: all 0.15s ease-out;
  }

  .time-slot.admin-booked {
    background-color: rgba(52, 73, 94, 0.1) !important;
    border-color: rgba(52, 73, 94, 0.3) !important;
    color: #34495e !important;
    cursor: not-allowed;
    transition: all 0.15s ease-out;
  }

  /* Selected state */
  .time-slot.selected {
    background-color: rgba(44, 62, 80, 0.2) !important;
    border: 2px solid #2c3e50 !important;
    color: #2c3e50 !important;
    font-weight: bold !important;
    transition: all 0.15s ease-out;
  }

  /* Available but not selectable (not consecutive) */
  .time-slot:not(:disabled):not(.selected):not(.booked):not(.admin-booked) {
    background: rgba(255, 255, 255, 0.3) !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    color: var(--text-color) !important;
    font-weight: normal !important;
    transition: all 0.15s ease-out;
  }

  /* Unselectable but available slots */
  .time-slot:not(:disabled):not(.selected):not(.booked):not(.admin-booked)[disabled] {
    background-color: rgba(100, 100, 100, 0.15) !important;
    border: 1px dashed rgba(100, 100, 100, 0.4) !important;
    color: rgba(100, 100, 100, 0.8) !important;
    cursor: not-allowed;
    transition: all 0.15s ease-out;
  }

  /* Hover effect only for available and selectable slots */
  .time-slot.available:not(:disabled):not([disabled]):hover {
    background-color: rgba(44, 62, 80, 0.1);
    border-color: #2c3e50;
    transition: all 0.15s ease-out;
  }
  
  .time-label {
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  @media (min-width: 768px) {
    .time-label {
      font-size: 1rem;
    }
  }
  
  .booked-indicator {
    font-size: 0.8em;
    color: #7b2c2c;
    font-weight: normal;
  }
  
  /* Form actions */
  .selection-info {
    margin: 1rem 0;
    font-size: 0.9rem;
    color: #2c3e50;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .submit-button {
    background-color: #2c3e50;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
  }
  
  .submit-button:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
  
  .submit-button:hover:not(:disabled) {
    background-color: #34495e;
  }
  
  .cancel-button {
    background-color: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.2s;
  }
  
  .cancel-button:hover {
    border-color: #7b2c2c;
    color: #7b2c2c;
  }
  
  /* My bookings */
  .my-bookings {
    padding: 1rem 0;
    margin-top: 2rem;
    width: 100%;
    box-sizing: border-box;
  }
  
  @media (min-width: 768px) {
    .my-bookings {
      background-color: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
  }
  
  .bookings-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
    width: 100%;
  }
  
  .booking-card {
    background-color: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    margin-bottom: 1rem;
    transition: transform 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.18);
    width: 100%;
    box-sizing: border-box;
  }
  
  .booking-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .booking-header {
    margin-bottom: 0.75rem;
  }
  
  .booking-header h4 {
    margin: 0;
    color: var(--text-color);
    font-size: 1.2rem;
  }
  
  .booking-info {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #2c3e50;
  }
  
  .booking-user,
  .booking-email {
    margin-top: 0.25rem;
  }
  
  .user-label {
    font-weight: 500;
    color: #333;
  }
  
  .booking-actions {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
  }
  
  .cancel-booking {
    background-color: #7b2c2c;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s ease;
  }
  
  .cancel-booking:hover {
    background-color: #5c2121;
  }

  .debug-info {
    background-color: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.8em;
    color: #2c3e50;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }

  .loading {
    text-align: center;
    padding: 1rem;
    color: var(--text-color);
  }

  .user-indicators {
    margin-top: 2px;
  }

  .user-select {
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-color);
    margin-top: 0.5rem;
  }
    
  .form-group {
    margin-bottom: 1rem;
  }

  .booked-indicator.admin-booking {
    color: #34495e;
  }

  .calendar-day.isPastDate {
    background-color: rgba(100, 100, 100, 0.3);
    color: rgba(100, 100, 100, 0.8);
    cursor: not-allowed;
  }

  /* Updated styles for title and headings */
  h3 {
    color: #2c3e50;
  }
  
  h4 {
    color: #2c3e50 !important;
  }

  .booking-info {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #2c3e50;
  }
  
  .selection-info {
    margin: 1rem 0;
    font-size: 0.9rem;
    color: #2c3e50;
  }

  .debug-info {
    background-color: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.8em;
    color: #2c3e50;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
</style>