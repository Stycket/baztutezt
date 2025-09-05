import { json } from '@sveltejs/kit';
import { query, initializeDatabase, closePool, ensureInitialized } from '$lib/server/db';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import fs from 'fs';
import path from 'path';

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
      DROP TABLE IF EXISTS community_info CASCADE;
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
      
      // Insert admin user
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
      }
      
      // Create posts table
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
      
      // Create comments table
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
      
      // Create bookings table
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

        CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
        CREATE INDEX IF NOT EXISTS idx_bookings_active_date ON bookings(booking_date) 
          WHERE status = 'active';

        DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
        CREATE TRIGGER update_bookings_updated_at
          BEFORE UPDATE ON bookings
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      // Create hours validation function and trigger
      await query(`
        CREATE OR REPLACE FUNCTION validate_booking_hours()
        RETURNS TRIGGER AS $$
        DECLARE
          invalid_hours BOOLEAN;
        BEGIN
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

        DROP TRIGGER IF EXISTS validate_booking_hours_trigger ON bookings;
        CREATE TRIGGER validate_booking_hours_trigger
        BEFORE INSERT OR UPDATE ON bookings
        FOR EACH ROW
        EXECUTE FUNCTION validate_booking_hours();

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

        CREATE OR REPLACE FUNCTION prevent_booking_overlap()
        RETURNS TRIGGER AS $$
        BEGIN
          IF check_booking_overlap(NEW.booking_date, NEW.hours, NEW.id) THEN
            RAISE EXCEPTION 'Booking overlaps with existing booking';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS check_booking_overlap_trigger ON bookings;
        CREATE TRIGGER check_booking_overlap_trigger
        BEFORE INSERT OR UPDATE ON bookings
        FOR EACH ROW
        EXECUTE FUNCTION prevent_booking_overlap();
      `);

      // Create community_info table with all required columns
      await query(`
        CREATE TABLE IF NOT EXISTS community_info (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          dropdown_options JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          visible_to_logged_out BOOLEAN DEFAULT false,
          content_type TEXT DEFAULT 'loggedIn' CHECK (content_type IN ('loggedIn', 'loggedOut'))
        );

        DROP TRIGGER IF EXISTS update_community_info_updated_at ON community_info;
        CREATE TRIGGER update_community_info_updated_at
          BEFORE UPDATE ON community_info
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      console.log('Database tables created successfully');
      
      // Initialize any remaining database components
      await initializeDatabase();
      
      return json({ 
        success: true,
        message: 'Database reset successful' 
      });
    } catch (initError) {
      console.error('Failed to initialize database after reset:', initError);
      return json({ error: initError.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Error resetting database:', error);
    return json({ error: error.message }, { status: 500 });
  }
}