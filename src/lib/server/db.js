import pg from 'pg';
import { env } from '$env/dynamic/private';
import { logError, ErrorSeverity } from '$lib/server/error-handler';
import { setTimeout } from 'node:timers/promises';
const { Pool } = pg;

// Add validation regex constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

// Improve pool configuration with better defaults
const pool = new Pool({
  user: env.POSTGRES_USER || 'postgres',
  host: env.POSTGRES_HOST || 'localhost',
  database: env.POSTGRES_DB || 'bastudb',
  password: env.POSTGRES_PASSWORD || 'bastupassword',
  port: parseInt(env.POSTGRES_PORT || '5433'),
  ssl: env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(env.POSTGRES_MAX_CONNECTIONS || '15'),
  idleTimeoutMillis: parseInt(env.POSTGRES_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(env.POSTGRES_CONNECTION_TIMEOUT || '2000'),
  // Add statement timeout to prevent long-running queries
  statement_timeout: 10000 // 10 seconds
});

// Handle connection events
pool.on('connect', (client) => {
  console.log('🔌 Connected to PostgreSQL');
  client.on('error', (err) => {
    logError('client-error', err, {}, ErrorSeverity.HIGH);
  });
});

pool.on('error', (err) => {
  logError('pool-error', err, {}, ErrorSeverity.CRITICAL);
});

// Add at the top of the file
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Safe query function with error handling
 */
export async function query(text, params) {
  const client = await pool.connect();
  const queryId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  try {
    const start = Date.now();
    console.log(`🔍 [${queryId}] Executing query:`, { text, params });
    
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    console.log(`⚡ [${queryId}] Query completed in ${duration}ms`);
    return result;
  } catch (err) {
    console.error(`❌ [${queryId}] Query error:`, err);
    logError('query-error', err, { 
      query: text, 
      params,
      queryId 
    }, ErrorSeverity.MEDIUM);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize variables for database initialization control
let initializationInProgress = false;
let initialized = false;
let initializeError = null;
let initializePromise = null;

/**
 * Initialize the database with necessary tables and extensions
 */
export async function initializeDatabase() {
  // If already initializing, wait for completion
  if (initializationInProgress) {
    if (initializePromise) {
      try {
        await initializePromise;
        return;
      } catch (err) {
        throw err;
      }
    }
    if (initializeError) {
      throw initializeError;
    }
    return;
  }
  
  if (initialized) return;
  
  initializationInProgress = true;
  initializeError = null;
  
  initializePromise = (async () => {
    try {
      console.log('🛠️ Initializing database...');
      
      // Test connection first
      await query('SELECT 1');
      console.log('✅ Database connection successful');
      
      // Create extensions
      await query('CREATE EXTENSION IF NOT EXISTS ltree');
      await query('CREATE EXTENSION IF NOT EXISTS citext'); // For case-insensitive text fields
      
      // First, create the profiles table
      await query(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          email CITEXT UNIQUE NOT NULL CHECK (email ~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
          username CITEXT UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_-]{3,20}$'),
          role TEXT DEFAULT 'free' CHECK (role IN ('free', 'premium', 'admin')),
          privilege_role TEXT DEFAULT 'user' CHECK (privilege_role IN ('user', 'moderator', 'admin')),
          custom_roles JSONB DEFAULT '{}'::jsonb,
          bio TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true
        );
      `);

      // Verify the table exists and has the is_active column
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'is_active'
          ) THEN
            ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
          END IF;
        END $$;
      `);

      // Now create each index separately
      await query(`CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_profiles_privilege_role ON profiles(privilege_role);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;`);

      // Add trigger for updated_at
      await query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
        CREATE TRIGGER update_profiles_updated_at
          BEFORE UPDATE ON profiles
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      // Step 2: Create posts table
      await query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          author_id TEXT NOT NULL REFERENCES profiles(id),
          content TEXT NOT NULL,
          post_type VARCHAR(20) DEFAULT 'public',
          category_id TEXT,
          approval_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active',
          deleted_at TIMESTAMPTZ,
          metadata JSONB DEFAULT '{}'::jsonb
        );
        
        CREATE INDEX IF NOT EXISTS idx_posts_created_idx ON posts(created_at);
      `);
  
      // Step 4: Create comments table and triggers
      await query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          author_id TEXT NOT NULL REFERENCES profiles(id),
          content TEXT NOT NULL,
          parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
          path LTREE,               -- Hierarchical path (ltree)
          path_array INTEGER[],     -- Alternative for environments without ltree
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          is_live BOOLEAN DEFAULT TRUE
        );
        
        CREATE INDEX IF NOT EXISTS idx_comments_post_idx ON comments(post_id);
        CREATE INDEX IF NOT EXISTS idx_comments_path_idx ON comments USING GIST(path);
        CREATE INDEX IF NOT EXISTS idx_comments_path_array_idx ON comments USING GIN(path_array);
        CREATE INDEX IF NOT EXISTS idx_comments_live_idx ON comments(is_live) WHERE is_live = true;
      `);
  
      // Step 5: Create comment triggers
      await query(`
        CREATE OR REPLACE FUNCTION notify_comment_change()
        RETURNS TRIGGER AS $$
        BEGIN
          PERFORM pg_notify('comment_updates', json_build_object(
            'event', TG_OP,
            'id', NEW.id,
            'post_id', NEW.post_id
          )::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
  
        DROP TRIGGER IF EXISTS comment_notify_trigger ON comments;
        CREATE TRIGGER comment_notify_trigger
        AFTER INSERT OR UPDATE ON comments
        FOR EACH ROW EXECUTE FUNCTION notify_comment_change();
      `);
  
      // Update bookings table with improved constraints (remove problematic constraint)
      await query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES profiles(id),
          booking_date DATE NOT NULL CHECK (booking_date >= CURRENT_DATE),
          hours INTEGER[] NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
          admin_booking BOOLEAN DEFAULT FALSE,
          CONSTRAINT max_hours_check CHECK (admin_booking = true OR array_length(hours, 1) <= 3),
          CONSTRAINT unique_user_booking_date UNIQUE (user_id, booking_date, status)
        );

        -- Improve indexes for bookings
        CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
        CREATE INDEX IF NOT EXISTS idx_bookings_active_date ON bookings(booking_date) 
          WHERE status = 'active';
      `);

      // Create hour validation function
      await query(`
        -- Create function for hour range validation
        CREATE OR REPLACE FUNCTION validate_booking_hours()
        RETURNS TRIGGER AS $$
        DECLARE
          invalid_hours BOOLEAN;
        BEGIN
          -- Check if any hour is outside valid range
          SELECT EXISTS (
            SELECT 1 FROM unnest(NEW.hours) AS hour 
            WHERE hour < 0 OR hour > 23
          ) INTO invalid_hours;
          
          IF invalid_hours THEN
            RAISE EXCEPTION 'Hours must be between 0 and 23';
          END IF;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger for hour validation
        DROP TRIGGER IF EXISTS validate_booking_hours_trigger ON bookings;
        CREATE TRIGGER validate_booking_hours_trigger
        BEFORE INSERT OR UPDATE ON bookings
        FOR EACH ROW
        EXECUTE FUNCTION validate_booking_hours();
      `);

      // Add trigger for bookings updated_at
      await query(`
        DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
        CREATE TRIGGER update_bookings_updated_at
          BEFORE UPDATE ON bookings
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
  
      // Step 6: Create community_info table
      await query(`
        CREATE TABLE IF NOT EXISTS community_info (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          dropdown_options JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          visible_to_logged_out BOOLEAN DEFAULT false
        );
      `);
  
      console.log('✅ Database schema initialized successfully');
      initialized = true;
      retryCount = 0;
    } catch (err) {
      console.error('❌ Database initialization failed:', err);
      initializeError = err;
      
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff with 10s max
        console.log(`🔄 Retrying database initialization in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})...`);
        initializationInProgress = false;
        await setTimeout(delay);
        return initializeDatabase();
      }
      
      throw err;
    } finally {
      initializationInProgress = false;
    }
  })();
  
  return initializePromise;
}

/**
 * Get comment tree for a post
 */
export async function getCommentTree(postId) {
  try {
    // Try with ltree approach first
    try {
      const { rows } = await query(`
        WITH RECURSIVE comment_tree AS (
          SELECT id, content, author_id, path, created_at
          FROM comments
          WHERE post_id = $1 AND (path IS NULL OR nlevel(path) = 1)
          
          UNION ALL
          
          SELECT c.id, c.content, c.author_id, c.path, c.created_at
          FROM comments c
          JOIN comment_tree ct ON c.path <@ ct.path
        )
        SELECT * FROM comment_tree ORDER BY path
      `, [postId]);
      return rows;
    } catch {
      // Fallback to array approach if ltree is missing
      const { rows } = await query(`
        SELECT id, content, author_id, created_at, 
               array_length(path_array, 1) as depth
        FROM comments
        WHERE post_id = $1
        ORDER BY path_array, created_at
      `, [postId]);
      return rows;
    }
  } catch (error) {
    logError('get-comments-error', error, { postId }, ErrorSeverity.LOW);
    throw error;
  }
}

/**
 * Create a new comment with support for both ltree and array path
 */
export async function createComment(commentData) {
  const { postId, authorId, content, parentId } = commentData;
  
  return query(`
    WITH inserted AS (
      INSERT INTO comments (post_id, author_id, content, parent_id, path, path_array)
      VALUES (
        $1, $2, $3, $4,
        (SELECT CASE 
           WHEN $4 IS NULL THEN text2ltree($5::text)
           ELSE (SELECT path FROM comments WHERE id = $4) || $5::text
         END),
        (SELECT CASE 
           WHEN $4 IS NULL THEN ARRAY[$5::integer]
           ELSE (SELECT path_array FROM comments WHERE id = $4) || $5::integer
         END)
      )
      RETURNING *
    )
    SELECT * FROM inserted
  `, [postId, authorId, content, parentId || null, Date.now()]);
}

/**
 * Close all connections
 */
export async function closePool() {
  try {
    await pool.end();
    console.log('♨️ Connection pool closed');
  } catch (err) {
    logError('pool-close-error', err, {}, ErrorSeverity.LOW);
  }
}

/**
 * Ensure database is initialized
 */
export async function ensureInitialized() {
  if (initialized) return;
  
  try {
    await initializeDatabase();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw err;
  }
}

async function createAdminBooking() {
  if (!selectedDate || selectedHours.length === 0) {
    error = 'Please select a date and time slots';
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

export async function POST({ request, locals }) {
  // Check if user is admin
  if (locals.session?.user?.privilege_role !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Drop everything
    await query(`
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS comments CASCADE;
      DROP TABLE IF EXISTS posts CASCADE;
      DROP TABLE IF EXISTS profiles CASCADE;
      DROP EXTENSION IF EXISTS ltree CASCADE;
      DROP FUNCTION IF EXISTS check_booking_overlap CASCADE;
      DROP FUNCTION IF EXISTS prevent_booking_overlap CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    `);

    // After dropping everything, create necessary extensions
    await query(`
      CREATE EXTENSION IF NOT EXISTS citext;
      CREATE EXTENSION IF NOT EXISTS ltree;
    `);

    console.log('Tables dropped successfully');

    // Create updated_at trigger function first
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Step 2: Manually create tables in the correct order
    try {
      // First create the profiles table
      await query(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          email CITEXT UNIQUE NOT NULL CHECK (email ~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
          username CITEXT UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_-]{3,20}$'),
          role TEXT DEFAULT 'free' CHECK (role IN ('free', 'premium', 'admin')),
          privilege_role TEXT DEFAULT 'user' CHECK (privilege_role IN ('user', 'moderator', 'admin')),
          custom_roles JSONB DEFAULT '{}'::jsonb,
          bio TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true
        );

        CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
        CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
        CREATE INDEX IF NOT EXISTS idx_profiles_privilege_role ON profiles(privilege_role);
        CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;

        DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
        CREATE TRIGGER update_profiles_updated_at
          BEFORE UPDATE ON profiles
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
      
      console.log('Profiles table created');
      
      // Step 3: Insert admin user with proper email and username
      if (locals.session?.user) {
        const userId = locals.session.user.id;
        const userEmail = locals.session.user.email;
        const username = locals.session.user.user_metadata?.username || locals.session.user.email?.split('@')[0] || 'admin';
        
        await query(`
          INSERT INTO profiles (id, email, username, role, privilege_role)
          VALUES ($1, $2, $3, 'admin', 'admin')
          ON CONFLICT (id) DO UPDATE 
          SET email = EXCLUDED.email,
              username = EXCLUDED.username,
              role = 'admin',
              privilege_role = 'admin'
        `, [userId, userEmail, username]);
        
        console.log(`Admin user created/updated: ${userId}, ${username}, ${userEmail}`);
      }
      
      // Step 4: Create posts table
      await query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          author_id TEXT NOT NULL REFERENCES profiles(id),
          content TEXT NOT NULL,
          post_type VARCHAR(20) DEFAULT 'public',
          category_id TEXT,
          approval_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active',
          deleted_at TIMESTAMPTZ,
          metadata JSONB DEFAULT '{}'::jsonb
        );
        
        CREATE INDEX IF NOT EXISTS idx_posts_created_idx ON posts(created_at);

        DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
        CREATE TRIGGER update_posts_updated_at
          BEFORE UPDATE ON posts
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
      
      console.log('Posts table created');
      
      // Step 5: Create comments table
      await query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          author_id TEXT NOT NULL REFERENCES profiles(id),
          content TEXT NOT NULL,
          parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
          path LTREE,
          path_array INTEGER[],
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          is_live BOOLEAN DEFAULT TRUE
        );
        
        CREATE INDEX IF NOT EXISTS idx_comments_post_idx ON comments(post_id);
        CREATE INDEX IF NOT EXISTS idx_comments_path_idx ON comments USING GIST(path);
        CREATE INDEX IF NOT EXISTS idx_comments_path_array_idx ON comments USING GIN(path_array);
        CREATE INDEX IF NOT EXISTS idx_comments_live_idx ON comments(is_live) WHERE is_live = true;

        DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
        CREATE TRIGGER update_comments_updated_at
          BEFORE UPDATE ON comments
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
      
      console.log('Comments table created');
      
      // Create comment notify trigger
      await query(`
        CREATE OR REPLACE FUNCTION notify_comment_change()
        RETURNS TRIGGER AS $$
        BEGIN
          PERFORM pg_notify('comment_updates', json_build_object(
            'event', TG_OP,
            'id', NEW.id,
            'post_id', NEW.post_id
          )::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS comment_notify_trigger ON comments;
        CREATE TRIGGER comment_notify_trigger
        AFTER INSERT OR UPDATE ON comments
        FOR EACH ROW EXECUTE FUNCTION notify_comment_change();
      `);
      
      // Step 6: Create bookings table - FIX THE PROBLEMATIC CONSTRAINTS
      await query(`
        -- Create the bookings table with fixed constraints
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES profiles(id),
          booking_date DATE NOT NULL CHECK (booking_date >= CURRENT_DATE),
          hours INTEGER[] NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
          admin_booking BOOLEAN DEFAULT FALSE,
          CONSTRAINT max_hours_check CHECK (admin_booking = true OR array_length(hours, 1) <= 3),
          CONSTRAINT unique_user_booking_date UNIQUE (user_id, booking_date, status)
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
        CREATE INDEX IF NOT EXISTS idx_bookings_active_date ON bookings(booking_date) 
          WHERE status = 'active';
      `);

      // Fix: Create hours validation function and trigger separately
      await query(`
        -- Create function for hour range validation
        CREATE OR REPLACE FUNCTION validate_booking_hours()
        RETURNS TRIGGER AS $$
        DECLARE
          invalid_hours BOOLEAN;
        BEGIN
          -- Check if any hour is outside valid range
          SELECT EXISTS (
            SELECT 1 FROM unnest(NEW.hours) AS hour 
            WHERE hour < 0 OR hour > 23
          ) INTO invalid_hours;
          
          IF invalid_hours THEN
            RAISE EXCEPTION 'Hours must be between 0 and 23';
          END IF;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger for hour validation
        DROP TRIGGER IF EXISTS validate_booking_hours_trigger ON bookings;
        CREATE TRIGGER validate_booking_hours_trigger
        BEFORE INSERT OR UPDATE ON bookings
        FOR EACH ROW
        EXECUTE FUNCTION validate_booking_hours();

        -- Create overlap check function
        CREATE OR REPLACE FUNCTION check_booking_overlap(
          p_date DATE,
          p_hours INTEGER[],
          p_booking_id INTEGER DEFAULT NULL
        ) RETURNS BOOLEAN AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1
            FROM bookings b,
            LATERAL unnest(b.hours) h
            WHERE b.booking_date = p_date
            AND b.status = 'active'
            AND (p_booking_id IS NULL OR b.id != p_booking_id)
            AND h = ANY(p_hours)
          );
        END;
        $$ LANGUAGE plpgsql;

        -- Create overlap prevention trigger function
        CREATE OR REPLACE FUNCTION prevent_booking_overlap()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Check for overlaps
          IF check_booking_overlap(NEW.booking_date, NEW.hours, NEW.id) THEN
            RAISE EXCEPTION 'Booking overlaps with existing booking';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create overlap trigger
        DROP TRIGGER IF EXISTS check_booking_overlap_trigger ON bookings;
        CREATE TRIGGER check_booking_overlap_trigger
        BEFORE INSERT OR UPDATE ON bookings
        FOR EACH ROW
        EXECUTE FUNCTION prevent_booking_overlap();

        -- Add updated_at trigger
        DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
        CREATE TRIGGER update_bookings_updated_at
          BEFORE UPDATE ON bookings
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      console.log('Bookings table and functions created');
      
      console.log('Database reset completed successfully!');
      global.dbInitialized = true;
      
    } catch (initError) {
      console.error('Failed to initialize database after reset:', initError);
      return json({ error: initError.message }, { status: 500 });
    }
    
    return json({ 
      success: true,
      message: 'Database reset successful' 
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    return json({ error: error.message }, { status: 500 });
  }
}