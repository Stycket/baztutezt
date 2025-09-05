<script>
  import { onMount } from 'svelte';
  import { session } from '$lib/stores';
  import { api } from '$lib/utils/api';
  import CommunityInfo from './CommunityInfo.svelte'; // Adjust the path as necessary
  
  // State variables
  let bookings = [];
  let filteredBookings = [];
  export let data;
  let users = data?.users || [];
  let loading = true;
  let error = null;
  let success = null;
  let selectedYear = new Date().getFullYear();
  let showBookingSystem = false; // Changed from true to false
  let expandedMonths = new Set();
  let loadingBookings = false;
  let selectedDate = null;
  let selectedHours = [];
  let selectedUserId = null;
  let bookedHours = [];
  let adminBookedHours = [];
  let loadingTimeSlots = false;
  let showUserList = false; // Already false
  let showBookingForm = false; // Changed from true to false
  let showAnnouncements = false; // Changed from true to false
  let showCommunityInfo = false;
  let communityTitle = '';
  let communityContent = '';
  let dropdownOptions = [];
  
  // Poster variables
  let userInput = '';
  let posterLoading = false;
  let userPosts = [];
  
  // Dropdown options
  const years = Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Check if user has admin privileges
  $: isAdmin = $session?.user?.privilege_role === 'admin';
  $: isModerator = $session?.user?.privilege_role === 'moderator';
  $: hasAccess = isAdmin || isModerator;
  
  // Debug log to help diagnose permission issues
  $: console.log('Session user:', $session?.user);
  $: console.log('Admin permissions:', { 
    isAdmin, 
    isModerator, 
    hasAccess, 
    privilege_role: $session?.user?.privilege_role 
  });
  
  // Initialize data on mount
  onMount(async () => {
    // Wait for session to be fully loaded before proceeding
    if (!$session?.user?.id || !$session?.csrf_token) {
      await new Promise(resolve => {
        const unsubscribe = session.subscribe(value => {
          if (value?.user?.id && value?.csrf_token) {
            console.log('Session fully loaded for admin page');
            unsubscribe();
            resolve();
          }
        });
      });
    }
    
    // Now check permissions with loaded session
    if (!$session?.user) {
      error = "You must be logged in to access this page";
      loading = false;
      return;
    }
    
    if (!hasAccess) {
      error = "You don't have permission to access this page";
      loading = false;
      return;
    }
    
    try {
      // Load posts first since they're more likely to succeed
      await loadUserPosts();
      
      // Then try to load bookings
      await loadBookings();
    } catch (err) {
      console.error("Error loading admin data:", err);
      error = err.message;
    } finally {
      loading = false;
    }
  });
  
  // Filter bookings when year changes
  $: {
    if (bookings && bookings.length > 0) {
      filterBookingsByYear(selectedYear);
    }
  }
  
  // Load all bookings from the API
  async function loadBookings() {
    loadingBookings = true;
    try {
      const response = await api.get('/api/bookingapi?admin=true');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load bookings');
      }
      
      const data = await response.json();
      console.log("Raw booking data:", data);
      
      bookings = data;
      console.log("Processed bookings:", bookings);
      
      filterBookingsByYear(selectedYear);
      console.log("Filtered bookings:", filteredBookings);
    } catch (err) {
      console.error('Error loading bookings:', err);
      error = err.message;
      bookings = [];
      filteredBookings = [];
    } finally {
      loadingBookings = false;
    }
  }
  
  // In GET handler where admin=true:

  export async function GET({ url, locals }) {
    if (url.searchParams.get('admin') === 'true') {
      const queryText = `
        SELECT 
          b.*,
          p.username,
          p.email
        FROM bookings b
        LEFT JOIN profiles p ON b.user_id = p.id
        ORDER BY b.booking_date DESC, b.hours ASC
      `;
      const result = await query(queryText);
      console.log('Admin bookings query result:', result.rows);
      return json(result.rows);
    }
    // ...existing code...
  }
  
  // Filter bookings by selected year
  function filterBookingsByYear(year) {
    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      filteredBookings = [];
      return;
    }
    
    filteredBookings = bookings.filter(booking => {
      if (!booking.booking_date) return false;
      const bookingDate = new Date(booking.booking_date);
      return bookingDate.getFullYear() === parseInt(year);
    });
    
    console.log(`Filtered bookings for ${year}:`, filteredBookings);
  }
  
  // Helper function to format date for API requests
  function formatDateForAPI(date) {
    // Ensure we're using local date (Sweden time)
    const [year, month, day] = date.split('-');
    // Create date in local timezone
    const localDate = new Date(year, month - 1, day);
    // Format as YYYY-MM-DD
    return localDate.toLocaleDateString('sv-SE'); // Swedish locale for YYYY-MM-DD format
  }
  
  // Format date for display
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Replace existing getUserDetails function

  function getUserDetails(booking) {
    return {
      username: booking.username || 'Unknown',
      email: booking.email || 'Unknown'
    };
  }
  
  // Format time slots for display
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
  
  // Toggle month expansion
  function toggleMonth(month) {
    if (expandedMonths.has(month)) {
      expandedMonths.delete(month);
    } else {
      // Optional: close any other open months first for a cleaner UI
      expandedMonths = new Set([month]);
    }
    
    // Force UI update
    expandedMonths = new Set(expandedMonths);
  }
  
  // Toggle booking system section
  function toggleBookingSystem() {
    showBookingSystem = !showBookingSystem;
  }
  
  // Get bookings for a specific month
  function getBookingsForMonth(monthIndex) {
    return filteredBookings.filter(booking => {
      const bookingDate = new Date(booking.booking_date);
      return bookingDate.getMonth() === monthIndex;
    });
  }
  
  // Cancel a booking
  async function cancelBooking(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    
    try {
      loading = true;
      error = null;
      success = null;
      
      const response = await api.delete(`/api/bookingapi?id=${id}&admin=true`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel booking');
      }
      
      // Update local state
      bookings = bookings.map(booking => 
        booking.id === id 
          ? { ...booking, status: 'cancelled' } 
          : booking
      );
      
      // Refresh filtered bookings
      filterBookingsByYear(selectedYear);
      
      success = 'Booking cancelled successfully';
    } catch (err) {
      console.error('Error cancelling booking:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // Generate time slots
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i < 10 ? `0${i}` : `${i}`;
    return { 
      id: i,
      label: `${hour}:00 - ${i < 23 ? (i + 1 < 10 ? `0${i + 1}` : `${i + 1}`) : '00'}:00`,
      value: hour
    };
  });
  
  async function createAdminBooking() {
    if (!selectedDate || selectedHours.length === 0) {
      error = 'Please select a date and time slots';
      return;
    }

    if (!$session || !$session.user) {
      error = "User session is not available.";
      return;
    }

    try {
      loading = true;
      error = null;

      const formattedDate = formatDateForAPI(selectedDate);
      const sortedHours = [...selectedHours].sort((a, b) => a - b);

      const response = await api.post('/api/bookingapi', {
        booking_date: formattedDate,
        hours: sortedHours,
        user_id: $session.user.id, // Use the admin's user ID
        title: `Admin Booking on ${formattedDate}`,
        description: `Admin booking: ${sortedHours.map(h => `${h}:00-${h + 1}:00`).join(', ')}`,
        admin_booking: true // Indicate this is an admin booking
      });

      if (!response.ok) throw new Error('Booking failed');

      success = 'Booking created successfully';
      selectedDate = null;
      selectedHours = [];

      await loadBookings(); // Refresh bookings if needed
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Function to load booked hours for a date
  async function loadBookedHours(date) {
    try {
      if (!date) return;
      
      loadingTimeSlots = true;
      error = null;
      
      console.log('Loading booked hours for date:', date);
      
      const response = await api.get(`/api/bookingapi?date=${date}`);
      if (!response.ok) throw new Error('Failed to load booked hours');
      
      const data = await response.json();
      console.log('Booking data received:', data);
      
      // The API returns an object with booked_hours property
      if (data.booked_hours) {
        bookedHours = data.booked_hours;
        adminBookedHours = data.admin_booked_hours || [];
      } else {
        // Fallback if the format is different
        bookedHours = Array.isArray(data) ? 
          data.filter(b => b.status === 'active').map(b => parseInt(b.hour)) : 
          [];
        adminBookedHours = [];
      }
      
      console.log('Loaded booked hours:', bookedHours, 'and admin booked hours:', adminBookedHours);
    } catch (err) {
      console.error('Error loading booked hours:', err);
      error = 'Failed to load booked time slots';
      bookedHours = [];
      adminBookedHours = [];
    } finally {
      loadingTimeSlots = false;
    }
  }
  
  // Check if an hour is booked (regular booking)
  function isHourBooked(hour) {
    return bookedHours.includes(parseInt(hour)) && !adminBookedHours.includes(parseInt(hour));
  }
  
  // Check if an hour is an admin booking
  function isAdminBooking(hour) {
    return adminBookedHours.includes(parseInt(hour));
  }
  
  // Update the existing handleHourSelection function
  function handleHourSelection(hour) {
    if (isHourBooked(hour) || isAdminBooking(hour)) {
      // Don't allow selection of already booked hours unless they're your own
      return;
    }
    
    const hourIndex = selectedHours.indexOf(hour);
    
    if (hourIndex >= 0) {
      // If already selected, remove it
      selectedHours = selectedHours.filter(h => h !== hour);
    } else {
      // Remove the 3-hour limit for admins
      selectedHours = [...selectedHours, hour];
    }
  }
  
  // Add new function to select all available time slots
  function selectAllAvailableTimeSlots() {
    if (!selectedDate) {
      error = 'Please select a date first';
      return;
    }
    
    // Clear current selections
    selectedHours = [];
    
    // Add all hours that aren't already booked
    timeSlots.forEach(slot => {
      if (!isHourBooked(slot.id) && !isAdminBooking(slot.id)) {
        selectedHours = [...selectedHours, slot.id];
      }
    });
    
    success = `Selected ${selectedHours.length} available time slots`;
  }
  
  // Add a watch on selectedDate changes
  $: if (selectedDate) {
    selectedHours = []; // Clear selections when date changes
    loadBookedHours(selectedDate);
  }
  
  // Load user posts (announcements)
  async function loadUserPosts() {
    try {
      console.log('Loading user posts with session:', !!$session?.csrf_token);
      
      // The session should already be loaded from onMount,
      // but double-check to be safe
      if (!$session?.csrf_token) {
        console.log('Session not ready, waiting for CSRF token');
        return; // Skip loading if session isn't ready
      }
      
      const response = await api('/api/posts', {
        method: 'POST',
        headers: {
          'X-Post-Type': 'admin'
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error('Failed to load announcements: ' + (errorData.error || response.statusText));
      }
      
      userPosts = await response.json();
      console.log('Loaded posts:', userPosts.length);
      
      // Filter to only show admin posts
      userPosts = userPosts.filter(post => post.post_type === 'admin');
    } catch (error) {
      console.error('Error loading admin posts:', error);
    }
  }
  
  // Create/post announcement
  async function handleSubmit() {
    if (!userInput.trim() || posterLoading) return;
    
    posterLoading = true;
    error = null;
    
    try {
      // Verify user is admin or moderator
      if (!$session?.user?.privilege_role || 
          ($session.user.privilege_role !== 'admin' && 
           $session.user.privilege_role !== 'moderator')) {
        throw new Error('Only administrators and moderators can post announcements');
      }
      
      const saveResponse = await api('/api/posts/save', {
        method: 'POST',
        body: JSON.stringify({
          content: userInput,
          status: 'approved', // Automatically approve posts from admins/moderators
          approval_reason: 'Official announcement',
          post_type: 'admin', // Identifies admin/moderator posts
          username: $session?.user?.username || $session?.user?.user_metadata?.username || 'Anonymous'
        })
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.message || 'Failed to save announcement');
      }

      await loadUserPosts();
      userInput = '';
      success = 'Announcement posted successfully';
      
    } catch (err) {
      console.error('Error posting announcement:', err);
      error = err.message;
    } finally {
      posterLoading = false;
    }
  }

  // Add deletePost function after handleSubmit function
  async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      posterLoading = true;
      error = null;

      const response = await api.delete(`/api/posts/${postId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete announcement');
      }

      // Refresh posts after deletion
      await loadUserPosts();
      success = 'Announcement deleted successfully';
      
    } catch (err) {
      console.error('Error deleting announcement:', err);
      error = err.message;
    } finally {
      posterLoading = false;
    }
  }

  // For announcement history
  let showAllAnnouncements = false;

  function addOption() {
    dropdownOptions.push({ name: '', text: '' });
  }

  function removeOption(index) {
    dropdownOptions = dropdownOptions.filter((_, i) => i !== index);
  }

  let communityInfo = { title: '', content: '', dropdown_options: [] };
  let isEditing = false; // Track if we are editing existing content

  async function saveCommunityInfo() {
    const method = isEditing ? 'PUT' : 'POST';
    const response = await api('/api/infocms', {
      method,
      body: JSON.stringify(communityInfo),
    });

    if (response.ok) {
      const savedInfo = await response.json();
      communityInfo = savedInfo; // Update the local state with the saved info
      success = 'Community info saved successfully!';
      isEditing = true; // Set editing mode to true
    } else {
      error = 'Failed to save community info.';
    }
  }

  function addDropdownOption() {
    communityInfo.dropdown_options.push({ name: '', text: '' });
  }

  function removeDropdownOption(index) {
    communityInfo.dropdown_options.splice(index, 1);
  }

  function toggleCommunityInfo() {
    showCommunityInfo = !showCommunityInfo;
    if (!showCommunityInfo) {
      // Reset community info when hiding the section
      communityInfo = { title: '', content: '', dropdown_options: [] };
      isEditing = false; // Reset to create mode
    }
  }

  function handleCommunityInfoSubmit(event) {
    const { title, content, dropdowns, isEditing, visibleToLoggedOut } = event.detail;
    // Handle the submission logic here, e.g., save to the database
    console.log('Community Info Submitted:', { title, content, dropdowns, isEditing, visibleToLoggedOut });

    // Call your API to save the community info
    saveCommunityInfo({ title, content, dropdowns, isEditing, visibleToLoggedOut });
  }

  // Reactive variable to check if the user is logged in
  $: isLoggedIn = $session?.user !== undefined;

  // Add the new function to handle role changes
  async function changeUserRole(userId, newRole) {
    try {
      loading = true;
      error = null;
      success = null;
      
      const response = await api.put(`/api/users/${userId}/role`, {
        privilege_role: newRole
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change user role');
      }
      
      // Update local state
      users = users.map(user => 
        user.id === userId 
          ? { ...user, privilege_role: newRole } 
          : user
      );
      
      showTemporarySuccess('User role changed successfully');
    } catch (err) {
      console.error('Error changing user role:', err);
      showTemporaryError(err.message);
    } finally {
      loading = false;
    }
  }

  // Add this deleteUser function after changeUserRole function
  async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? All their bookings will be permanently deleted. This action cannot be undone.`)) {
      return;
    }
    
    try {
      loading = true;
      error = null;
      success = null;
      
      const response = await api.delete(`/api/users/delete?userId=${userId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      
      // Update local state
      users = users.filter(user => user.id !== userId);
      
      showTemporarySuccess(`User ${username} deleted successfully`);
    } catch (err) {
      console.error('Error deleting user:', err);
      showTemporaryError(err.message);
    } finally {
      loading = false;
    }
  }

  function showTemporarySuccess(message) {
    success = message;
    setTimeout(() => {
      success = null;
    }, 5000); // Clear after 5 seconds
  }

  function showTemporaryError(message) {
    error = message;
    setTimeout(() => {
      error = null;
    }, 5000); // Clear after 5 seconds
  }
</script>

<div class="admin-panel">
  <div class="background-image"></div>
  <div class="dark-overlay"></div>
  
  <!-- Add notification banners -->
  {#if error}
    <div class="notification error-notification">
      <div class="notification-content">
        <span class="notification-icon">❌</span>
        <span class="notification-message">{error}</span>
      </div>
      <button class="notification-close" on:click={() => error = null}>×</button>
    </div>
  {/if}
  
  {#if success}
    <div class="notification success-notification">
      <div class="notification-content">
        <span class="notification-icon">✅</span>
        <span class="notification-message">{success}</span>
      </div>
      <button class="notification-close" on:click={() => success = null}>×</button>
    </div>
  {/if}
  
  {#if loading}
    <div class="loading">Loading admin panel...</div>
  {:else if !hasAccess}
    <div class="error-message">
      You don't have permission to access this page.
      <div class="debug-info">
        Current privilege role: {$session?.user?.privilege_role || 'none'}
      </div>
    </div>
  {:else}
    <h1>Moderator Inställningar</h1>
    
    <div class="admin-sections">
      <!-- Section 1: Booking System -->
      <div class="admin-section">
        <button 
          class="section-header {showBookingSystem ? 'active' : ''}"
          on:click={toggleBookingSystem}
        >
          <span class="section-title">
            <span class="section-icon-left">📅</span>
            Bokningar
          </span>
          <span class="section-icon">{showBookingSystem ? '▼' : '▶'}</span>
        </button>
        
        {#if showBookingSystem}
          <div class="section-content">
            <div class="year-selector">
              <label for="year-select" class="selector-label">Year:</label>
              <div class="custom-select">
                <select 
                  id="year-select"
                  bind:value={selectedYear}
                  class="styled-select"
                >
                  {#each years as year}
                    <option value={year}>{year}</option>
                  {/each}
                </select>
                <div class="select-arrow">▼</div>
              </div>
            </div>
            
            <div class="bookings-container">
              {#if loadingBookings}
                <div class="loading-indicator">
                  <div class="spinner"></div>
                  <span>Loading bookings...</span>
                </div>
              {:else if filteredBookings.length === 0}
                <div class="empty-state">
                  <div class="empty-icon">📅</div>
                  <p class="empty-message">
                    No bookings found for {selectedYear}.
                    {#if bookings.length > 0}
                      <span>Try selecting a different year.</span>
                    {:else}
                      <span>There are no bookings in the system yet.</span>
                    {/if}
                  </p>
                </div>
              {:else}
                <!-- Group bookings by month -->
                <div class="months-grid">
                  {#each months as month, monthIndex}
                    <!-- Only show months with bookings -->
                    {@const monthBookings = getBookingsForMonth(monthIndex)}
                    {#if monthBookings.length > 0}
                      <div class="month-card {expandedMonths.has(monthIndex) ? 'expanded' : ''}">
                        <div 
                          class="month-header {expandedMonths.has(monthIndex) ? 'active' : ''}"
                          on:click={() => toggleMonth(monthIndex)}
                        >
                          <div class="month-header-left">
                            <span class="month-icon">{expandedMonths.has(monthIndex) ? '📂' : '📁'}</span>
                            <span class="month-name">{month} {selectedYear}</span>
                          </div>
                          <div class="month-header-right">
                            <span class="booking-count">
                              {monthBookings.length}
                            </span>
                            <span class="toggle-icon">{expandedMonths.has(monthIndex) ? '▼' : '▶'}</span>
                          </div>
                        </div>
                        
                        {#if expandedMonths.has(monthIndex)}
                          <div class="month-content">
                            <div class="table-responsive">
                              <table class="bookings-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {#each monthBookings as booking}
                                    <tr class="{booking.status} {booking.admin_booking ? 'admin-row' : ''}">
                                      <td class="date-cell">
                                        {new Date(booking.booking_date).toLocaleDateString('en-US', {
                                          day: 'numeric',
                                          weekday: 'short'
                                        })}
                                      </td>
                                      <td class="time-cell">{formatTimeSlots(booking)}</td>
                                      <td class="user-cell">
                                        <div class="user-info">
                                          <span class="user-avatar">{(booking.username || 'U')[0].toUpperCase()}</span>
                                          <div class="user-details">
                                            <div class="user-name">{booking.username || 'Unknown'}</div>
                                            <div class="user-email">{booking.email || ''}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td class="type-cell">
                                        {#if booking.admin_booking}
                                          <span class="badge admin">Admin</span>
                                        {:else}
                                          <span class="badge regular">Regular</span>
                                        {/if}
                                      </td>
                                      <td class="status-cell">
                                        <span class="badge status {booking.status}">
                                          {booking.status}
                                        </span>
                                      </td>
                                      <td class="action-cell">
                                        {#if booking.status === 'active'}
                                          <button 
                                            on:click={() => cancelBooking(booking.id)} 
                                            class="action-icon-button cancel"
                                            title="Cancel this booking"
                                          >
                                            ✕
                                          </button>
                                        {:else}
                                          <span class="cancelled-indicator">—</span>
                                        {/if}
                                      </td>
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Section 2: User Management -->
      <div class="admin-section">
        <button 
          class="section-header {showUserList ? 'active' : ''}"
          on:click={() => {showUserList = !showUserList}}
        >
          <span class="section-title">
            <span class="section-icon-left">👥</span>
            Medlemmar
          </span>
          <span class="section-icon">{showUserList ? '▼' : '▶'}</span>
        </button>
        
        {#if showUserList}
          <div class="section-content">
            {#if users.length === 0}
              <p class="no-users">No users found.</p>
            {:else}
              <div class="user-table-container">
                <table class="admin-table users-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each users as user}
                      <tr>
                        <td>{user.username || user.email?.split('@')[0] || 'No username'}</td>
                        <td>{user.email || 'No email'}</td>
                        <td>{user.privilege_role || 'user'}</td>
                        <td>
                          {#if user.privilege_role !== 'admin'}
                            <div class="role-actions">
                              <select 
                                class="role-select" 
                                bind:value={user.privilege_role} 
                                on:change={() => changeUserRole(user.id, user.privilege_role)}
                              >
                                <option value="user">User</option>
                                <option value="moderator">Moderator</option>
                              </select>
                              
                              <button 
                                class="delete-user-button" 
                                on:click={() => deleteUser(user.id, user.username || user.email?.split('@')[0] || 'this user')}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          {:else}
                            <span class="admin-badge">Admin</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/if}
      </div>
      
      <!-- Section 3: Create Booking -->
      <div class="admin-section">
        <button 
          class="section-header {showBookingForm ? 'active' : ''}"
          on:click={() => {showBookingForm = !showBookingForm}}
        >
          <span class="section-title">
            <span class="section-icon-left">➕</span>
            Boka Tid
          </span>
          <span class="section-icon">{showBookingForm ? '▼' : '▶'}</span>
        </button>
        
        {#if showBookingForm}
          <div class="section-content">
            <div class="form-group">
              <div class="date-select-container">
                <button 
                  type="button" 
                  class="date-select-button" 
                  on:click={() => document.getElementById('date-select').showPicker()}
                >
                  {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }) : 'Select Date'}
                  <span class="button-icon">📅</span>
                </button>
                <input 
                  type="date" 
                  id="date-select" 
                  bind:value={selectedDate} 
                  on:change={() => loadBookedHours(selectedDate)}
                  class="form-input hidden-date-input"
                />
                {#if selectedDate}
                  <div class="selected-date-display">
                    Selected: {new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                {/if}
              </div>
            </div>
            
            <div class="form-group">
              <label>Select Time Slots:</label>
              
              {#if loadingTimeSlots}
                <div class="loading">Loading available time slots...</div>
              {:else}
                <div class="time-slots-grid">
                  {#each timeSlots as slot}
                    {@const isRegularBooked = isHourBooked(slot.id)}
                    {@const isAdminBooked = isAdminBooking(slot.id)}
                    {@const isSelected = selectedHours.includes(slot.id)}
                    
                    <button 
                      type="button"
                      class="time-slot"
                      class:booked={isRegularBooked}
                      class:admin-booked={isAdminBooked}
                      class:available={!isRegularBooked && !isAdminBooked}
                      class:selected={isSelected}
                      on:click={() => handleHourSelection(slot.id)}
                      disabled={isRegularBooked || isAdminBooked}
                    >
                      <span class="time-label">{slot.label}</span>
                      {#if isRegularBooked}
                        <span class="booked-indicator">Booked</span>
                      {/if}
                      {#if isAdminBooked}
                        <span class="booked-indicator admin-booking">Admin Booked</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
              
              <div class="selection-info">
                {#if selectedHours.length > 0}
                  <p>Selected slots: 
                    {selectedHours
                      .map(hour => timeSlots.find(slot => slot.id === hour).label)
                      .join(', ')}
                  </p>
                {:else}
                  <p>Please select at least one time slot</p>
                {/if}
              </div>
            </div>
            
            <div class="form-actions">
              <button 
                on:click={createAdminBooking} 
                class="action-button primary-button" 
                disabled={loading || !selectedDate || selectedHours.length === 0}
              >
                {loading ? 'Booking...' : 'Create Booking'}
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Section 4: Announcements -->
      <div class="admin-section">
        <button 
          class="section-header {showAnnouncements ? 'active' : ''}"
          on:click={() => {showAnnouncements = !showAnnouncements}}
        >
          <span class="section-title">
            <span class="section-icon-left">📢</span>
            Information
          </span>
          <span class="section-icon">{showAnnouncements ? '▼' : '▶'}</span>
        </button>
        
        {#if showAnnouncements}
          <div class="section-content">
            <div class="announcement-form">
              <h3>Medelanden</h3>
              <form on:submit|preventDefault={handleSubmit}>
                <div class="form-group">
                  <label for="announcement" class="form-label">
                    Skriv till medlemmar
                  </label>
                  <textarea
                    id="announcement"
                    bind:value={userInput}
                    placeholder="Skriv här..."
                    disabled={posterLoading}
                    class="form-textarea"
                    rows="6"
                  ></textarea>
                  <p class="form-help">
                    
                  </p>
                </div>
                <div class="form-actions">
                  <button
                    type="submit"
                    disabled={posterLoading || !userInput.trim()}
                    class="action-button primary-button"
                  >
                    {posterLoading ? 'Posting...' : 'Skapa Medelande'}
                  </button>
                </div>
              </form>
            </div>

            <div class="announcement-history">
              <h3>Tidigare</h3>
              {#if userPosts.length === 0}
                <p class="no-data-message">Inga medelanden än.</p>
              {:else}
                <div class="announcements-list">
                  {#each userPosts.slice(0, showAllAnnouncements ? userPosts.length : 2) as post}
                    <div class="announcement-card">
                      <div class="announcement-header">
                        <div class="avatar">
                          {(post.author_username || 'A')[0].toUpperCase()}
                        </div>
                        <div class="post-meta">
                          <span class="author">@{post.author_username || 'Anonymous'}</span>
                          <span class="date">{new Date(post.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <div class="announcement-content">
                        {post.content}
                      </div>
                      <div class="status-section">
                        <div class="status-badge {post.status === 'Approved' ? 'approved' : 'rejected'}">
                          {post.status}
                        </div>
                        <p class="status-reason">Reason: {post.approval_reason}</p>
                        <button 
                          class="delete-post-button"
                          on:click={() => deletePost(post.id)}
                          disabled={posterLoading}
                        >
                          🗑️ Ta bort
                        </button>
                      </div>
                    </div>
                  {/each}
                  
                  {#if userPosts.length > 2}
                    <button 
                      class="show-more-button" 
                      on:click={() => showAllAnnouncements = !showAllAnnouncements}
                    >
                      <span class="show-more-text">
                        {showAllAnnouncements ? 'Show Less' : `Show All (${userPosts.length - 2} more)`}
                      </span>
                      <span class="show-more-icon">{showAllAnnouncements ? '▲' : '▼'}</span>
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Section 5: Community Info -->
      <div class="admin-section">
        <button
          class="section-header {showCommunityInfo ? 'active' : ''}"
          on:click={() => showCommunityInfo = !showCommunityInfo}
        >
          <span class="section-title">
            <span class="section-icon-left">ℹ️</span>
            {showCommunityInfo ? 'Hide' : 'Visa'} Förening
          </span>
          <span class="section-icon">
            {showCommunityInfo ? '▼' : '▶'}
          </span>
        </button>

        {#if showCommunityInfo}
          <div class="section-content">
            <CommunityInfo on:submit={handleCommunityInfoSubmit} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-panel {
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    color: var(--text-color);
    z-index: 1;
  }

  .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('https://wallpapers.com/images/hd/blurred-white-abstract-zcrvqrpzzv1evyus.jpg');
    background-size: cover;
    background-position: center;
    z-index: -1;
  }

  .dark-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: -1;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 2rem;
    color: var(--text-color);
    text-align: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1rem;
  }
  
  .error-message {
    background-color: rgba(244, 67, 54, 0.1);
    color: var(--danger, #f44336);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border: 1px solid rgba(244, 67, 54, 0.3);
  }
  
  .success-message {
    background-color: rgba(76, 175, 80, 0.1);
    color: var(--success, #4caf50);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border: 1px solid rgba(76, 175, 80, 0.3);
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, var(--gray-600));
    font-size: 1.2rem;
  }
  
  .admin-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .admin-section {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1.25rem;
    background-color: rgba(255, 255, 255, 0.3);
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.5);
    color: var(--text-color);
    font-size: 1.25rem;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.2s ease;
  }
  
  .section-header:hover {
    background-color: rgba(255, 255, 255, 0.5);
  }
  
  .section-header.active {
    background-color: var(--primary-color);
    color: white;
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .section-icon {
    font-size: 1rem;
    transition: transform 0.2s ease;
  }
  
  .section-content {
    padding: 1.5rem;
  }
  
  /* Form elements */
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .form-input, .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background-color: var(--card-bg);
    color: var(--text-color);
    font-family: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .form-input:focus, .form-textarea:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 59, 130, 246), 0.25);
    outline: none;
  }
  
  .form-textarea {
    resize: vertical;
    min-height: 120px;
  }
  
  .form-help {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  
  /* Buttons */
  .action-button {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    border: 2px solid transparent;
    background-color: rgba(255, 255, 255, 0.2);
    color: var(--text-color);
  }
  
  .action-button:hover {
    background-color: rgba(255, 255, 255, 0.4);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .primary-button {
    color: white;
  }
  
  .primary-button:hover {
    background-color: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .primary-button:active:not(:disabled) {
    transform: translateY(0);
  }
  
  /* Tables */
  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .admin-table th {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.05);
    padding: 0.875rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .admin-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-color);
  }
  
  .admin-table tr:last-child td {
    border-bottom: none;
  }
  
  .admin-table tr:hover {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.03);
  }
  
  /* Time slots */
  .time-slots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0;
  }
  
  .time-slot {
    padding: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--card-bg);
    color: var(--text-color);
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }
  
  .time-slot.available:hover {
    border-color: var(--primary-color);
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.05);
  }
  
  .time-slot.selected {
    background-color: rgba(33, 150, 243, 0.15);
    border-color: #2196F3;
    color: #2196F3;
    font-weight: 600;
  }
  
  .time-slot.booked {
    background-color: rgba(244, 67, 54, 0.1);
    border-color: rgba(244, 67, 54, 0.3);
    color: #f44336;
    cursor: not-allowed;
  }
  
  .time-slot.admin-booked {
    background-color: rgba(33, 150, 243, 0.1);
    border-color: rgba(33, 150, 243, 0.3);
    color: #2196F3;
    cursor: not-allowed;
  }
  
  .booked-indicator {
    display: block;
    font-size: 0.75rem;
    margin-top: 0.25rem;
    font-weight: 500;
  }
  
  .booked-indicator.admin-booking {
    color: #2196F3;
  }
  
  /* Selection info */
  .selection-info {
    margin: 1rem 0;
    padding: 0.75rem;
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.05);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }
  
  /* Announcements */
  .announcement-form {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .announcements-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .announcement-card {
    background-color: var(--background-color);
    border-radius: 8px;
    padding: 1.25rem;
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
  }
  
  .announcement-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .announcement-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background-color: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }
  
  .post-meta {
    display: flex;
    flex-direction: column;
  }
  
  .author {
    font-weight: 600;
    color: var(--text-color);
  }
  
  .date {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  .announcement-content {
    padding: 1rem;
    background-color: var(--card-bg);
    border-radius: 6px;
    margin-bottom: 1rem;
    border: 1px solid var(--border-color);
    color: var(--text-color);
    line-height: 1.6;
  }
  
  .status-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid transparent;
  }
  
  .status-badge.approved {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
    border-color: rgba(76, 175, 80, 0.2);
  }
  
  .status-badge.rejected {
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border-color: rgba(244, 67, 54, 0.2);
  }
  
  .status-reason {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  /* No data messages */
  .no-data-message, .no-users, .no-bookings {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    background-color: var(--background-color);
    border-radius: 6px;
    border: 1px solid var(--border-color);
    font-style: italic;
  }
  
  /* Year selector styling */
  .year-selector {
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
    gap: 0.75rem;
  }
  
  .selector-label {
    font-weight: 600;
    color: var(--text-color);
  }
  
  .custom-select {
    position: relative;
    display: inline-block;
  }
  
  .styled-select {
    appearance: none;
    -webkit-appearance: none;
    padding: 0.5rem 2.5rem 0.5rem 1rem;
    font-size: 1rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background-color: var(--card-bg);
    color: var(--text-color);
    cursor: pointer;
    min-width: 120px;
  }
  
  .styled-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 59, 130, 246), 0.2);
  }
  
  .select-arrow {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  /* Loading state */
  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    color: var(--text-secondary);
    background-color: var(--background-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }
  
  .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 3px solid rgba(var(--primary-rgb, 59, 130, 246), 0.2);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    background-color: var(--background-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    text-align: center;
  }
  
  .empty-icon {
    font-size: 3rem;
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  .empty-message {
    color: var(--text-secondary);
    font-size: 1.1rem;
    max-width: 400px;
    line-height: 1.5;
  }
  
  /* Months grid */
  .months-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    position: relative;
  }
  
  .month-card {
    background-color: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    grid-column: auto; /* Default regular width */
  }
  
  /* Make expanded month cards take full width */
  .month-card.expanded {
    grid-column: 1 / -1; /* Span all columns */
    width: 100%;
    z-index: 2; /* Ensure it appears above other cards */
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
  
  .month-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .month-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background-color: var(--background-color);
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-bottom: 1px solid transparent;
  }
  
  .month-header:hover {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.05);
  }
  
  .month-header.active {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
    border-bottom-color: var(--border-color);
  }
  
  .month-header-left, .month-header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .month-icon {
    font-size: 1.25rem;
    color: var(--text-color);
  }
  
  .month-name {
    font-weight: 600;
    color: var(--text-color);
  }
  
  .booking-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-color);
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
    border-radius: 999px;
  }
  
  .month-content {
    padding: 0.5rem;
  }
  
  /* Table styles */
  .table-responsive {
    overflow-x: auto;
    border-radius: 6px;
  }
  
  .bookings-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    margin: 0;
  }
  
  .bookings-table th {
    position: sticky;
    top: 0;
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.05);
    color: var(--text-color);
    font-weight: 600;
    text-align: left;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .bookings-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-color);
  }
  
  .bookings-table tr:last-child td {
    border-bottom: none;
  }
  
  .bookings-table tr:hover {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.03);
  }
  
  .bookings-table tr.cancelled {
    opacity: 0.75;
  }
  
  .bookings-table tr.admin-row {
    background-color: rgba(33, 150, 243, 0.05);
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .user-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background-color: var(--primary-color);
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
  }
  
  .user-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .user-name {
    font-weight: 500;
    color: var(--text-color);
  }
  
  .user-email {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .badge.admin {
    background-color: rgba(33, 150, 243, 0.1);
    color: #2196F3;
    border: 1px solid rgba(33, 150, 243, 0.2);
  }
  
  .badge.regular {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
    color: var(--primary-color);
    border: 1px solid rgba(var(--primary-rgb, 59, 130, 246), 0.2);
  }
  
  .badge.status {
    border-radius: 999px;
  }
  
  .badge.active {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
    border: 1px solid rgba(76, 175, 80, 0.2);
  }
  
  .badge.cancelled {
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.2);
  }
  
  .action-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
    background-color: transparent;
  }
  
  .action-icon-button:hover {
    transform: translateY(-1px);
  }
  
  .action-icon-button.cancel {
    color: #f44336;
    background-color: rgba(244, 67, 54, 0.1);
  }
  
  .action-icon-button.cancel:hover {
    background-color: rgba(244, 67, 54, 0.2);
  }
  
  .cancelled-indicator {
    display: inline-block;
    width: 2rem;
    text-align: center;
    color: var(--text-secondary);
    opacity: 0.6;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .months-grid {
      grid-template-columns: 1fr;
    }
    
    .bookings-table th, 
    .bookings-table td {
      padding: 0.625rem 0.5rem;
    }
    
    .user-avatar {
      width: 1.75rem;
      height: 1.75rem;
      font-size: 0.8rem;
    }
  }
  
  /* Date selector button */
  .date-select-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .date-select-button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: auto;
    padding: 0.6rem 1rem;
    background-color: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-color);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    min-width: 180px;
  }
  
  .date-select-button:hover {
    border-color: var(--primary-color);
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.05);
    transform: translateY(-1px);
  }
  
  .date-select-button:active {
    transform: translateY(0);
  }
  
  .button-icon {
    font-size: 1rem;
    margin-left: 0.5rem;
  }
  
  .hidden-date-input {
    position: absolute;
    visibility: hidden;
    height: 0;
    width: 0;
    pointer-events: none;
    opacity: 0;
  }
  
  .selected-date-display {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  /* Community Info form */
  .community-info-form {
    margin-top: 1.5rem;
    padding: 1.5rem;
    background-color: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .community-info-form h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .community-info-form input,
  .community-info-form textarea {
    width: 100%;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background-color: var(--background-color);
    color: var(--text-color);
    font-family: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .community-info-form input:focus,
  .community-info-form textarea:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 59, 130, 246), 0.25);
    outline: none;
  }

  .community-info-form textarea {
    resize: vertical;
    min-height: 120px;
  }

  .community-info-form button {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    border: 2px solid transparent;
    background-color: var(--primary-color);
    color: white;
  }

  .community-info-form button:hover {
    background-color: rgba(var(--primary-rgb, 59, 130, 246), 0.8);
  }

  /* New CSS for button consistency */
  .button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    border: 2px solid transparent;
    background-color: rgba(255, 255, 255, 0.2);
    color: var(--text-color);
  }
  
  .button:hover {
    background-color: rgba(255, 255, 255, 0.4);
    border-color: rgba(255, 255, 255, 0.5);
  }

  /* New CSS for show-more-button */
  .show-more-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.75rem 1.5rem;
    margin: 1rem 0;
    background-color: white; /* White background */
    border: 1px solid #ddd; /* Light gray border */
    border-radius: 8px;
    color: #333; /* Dark text for contrast on white */
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); /* Subtle shadow for depth */
  }

  .show-more-button:hover {
    background-color: #f8f8f8; /* Slightly off-white on hover */
    border-color: #ccc;
    transform: translateY(-1px);
  }

  .show-more-text {
    margin-right: 0.5rem;
  }

  .show-more-icon {
    font-size: 0.85rem;
    font-weight: bold;
  }

  :global(:root[data-theme="dark"]) .show-more-button {
    background-color: white; /* Keep white even in dark mode */
    border-color: #ccc;
    color: #333; /* Dark text on white background */
  }

  :global(:root[data-theme="dark"]) .show-more-button:hover {
    background-color: #f8f8f8;
  }

  /* Updated CSS for the user table layout */
  .user-table-container {
    overflow-x: auto; /* Add horizontal scrolling for small screens */
    margin-bottom: 1rem;
  }
  
  .users-table td {
    white-space: nowrap; /* Prevent text wrapping in cells */
  }
  
  .role-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap; /* Allow wrapping on very small screens */
    gap: 0.5rem; /* Add space between items when they wrap */
  }
  
  /* Make delete button more visible */
  .delete-user-button {
    background-color: #d32f2f; /* Brighter red */
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    margin-left: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    min-width: 80px; /* Ensure minimum width */
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .delete-user-button:hover {
    background-color: #b71c1c;
    transform: translateY(-1px);
  }
  
  /* Make role select more compact */
  .role-select {
    padding: 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background-color: var(--card-bg);
    max-width: 120px;
  }
  
  /* Admin badge styling */
  .admin-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background-color: rgba(33, 150, 243, 0.1);
    color: #2196F3;
    border: 1px solid rgba(33, 150, 243, 0.2);
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  /* Notification styling */
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 300px;
    max-width: 500px;
    animation: slideIn 0.3s ease-out;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .notification-content {
    display: flex;
    align-items: center;
    flex: 1;
  }
  
  .notification-icon {
    margin-right: 12px;
    font-size: 1.25rem;
  }
  
  .notification-message {
    font-size: 0.95rem;
    line-height: 1.4;
  }
  
  .notification-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
    margin-left: 8px;
    padding: 0;
    color: inherit;
    opacity: 0.6;
  }
  
  .notification-close:hover {
    opacity: 1;
  }
  
  .error-notification {
    background-color: rgba(211, 47, 47, 0.95);
    color: white;
    border-left: 4px solid #b71c1c;
  }
  
  .success-notification {
    background-color: rgba(56, 142, 60, 0.95);
    color: white;
    border-left: 4px solid #1b5e20;
  }

  /* Add this to the style section */
  .delete-post-button {
    background-color: #d32f2f;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    margin-left: auto;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    min-width: 80px;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .delete-post-button:hover {
    background-color: #b71c1c;
    transform: translateY(-1px);
  }
  
  .delete-post-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
</style>
