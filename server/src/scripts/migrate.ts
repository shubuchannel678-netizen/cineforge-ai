import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load server .env
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpjkyfiehwpzxqavtdtm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '';

// Resolve migration file path
const MIGRATION_FILE = path.resolve(process.cwd(), '..', 'supabase', 'migrations', '001_initial_schema.sql');

async function runMigration() {
  console.log('================================================================');
  console.log('⚡ CINEFORGE AI: SUPABASE CLOUD DATABASE MIGRATION RUNNER');
  console.log('================================================================');
  console.log(`🌐 Supabase Project URL: ${SUPABASE_URL}`);

  // Extract project ref
  const projectRefMatch = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = projectRefMatch ? projectRefMatch[1] : 'dpjkyfiehwpzxqavtdtm';
  console.log(`🔑 Project Reference:   ${projectRef}`);

  if (!fs.existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration SQL file not found at: ${MIGRATION_FILE}`);
  }

  const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf-8');
  console.log(`📄 Migration File:      001_initial_schema.sql (${(sqlContent.length / 1024).toFixed(1)} KB)`);

  let migrationSuccess = false;

  // --------------------------------------------------------------------------
  // Method 1: Direct PostgreSQL Connection via pg (node-postgres)
  // --------------------------------------------------------------------------
  let connectionString = DATABASE_URL;
  if (!connectionString && DB_PASSWORD) {
    // Standard Supabase direct and pooler connection strings
    connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  }

  if (connectionString) {
    console.log('\n[1/2] Connecting directly to Supabase PostgreSQL via connection string...');
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      statement_timeout: 60000,
    });

    try {
      await client.connect();
      console.log('✓ Successfully connected to Supabase PostgreSQL database.');
      console.log('⏳ Executing 001_initial_schema.sql (Tables, Enums, RLS, Indexes, Seed Data)...');

      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');

      console.log('🎉 Migration executed and committed successfully via PostgreSQL connection!');
      migrationSuccess = true;
      await client.end();
    } catch (err: any) {
      console.warn(`⚠️ Direct PostgreSQL query failed: ${err.message}`);
      try { await client.query('ROLLBACK'); } catch {}
      await client.end();
    }
  }

  // --------------------------------------------------------------------------
  // Method 2: Supabase Management / SQL REST API via Service Role Key
  // --------------------------------------------------------------------------
  if (!migrationSuccess && SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n[2/2] Attempting execution via Supabase SQL Management Endpoint...');
    try {
      const response = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sqlContent }),
      });

      if (response.ok) {
        console.log('🎉 Migration applied successfully via Supabase SQL endpoint!');
        migrationSuccess = true;
      } else {
        const errText = await response.text();
        console.warn(`ℹ️ SQL endpoint returned status ${response.status}: ${errText.slice(0, 150)}`);
      }
    } catch (apiErr: any) {
      console.warn(`ℹ️ SQL API call failed: ${apiErr.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // Verification & Status Check with Supabase Client
  // --------------------------------------------------------------------------
  console.log('\n--- VERIFYING SUPABASE DATABASE SCHEMA STATUS ---');
  if (SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tables = ['profiles', 'projects', 'character_bibles', 'style_bibles', 'scenes', 'shots', 'audio_tracks', 'subtitle_tracks', 'generation_jobs'];

    console.log('Inspecting table accessibility with Service Role Key:');
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (error) {
        console.log(`  ❌ public.${table.padEnd(20)}: Not yet created or permission denied (${error.message})`);
      } else {
        console.log(`  ✅ public.${table.padEnd(20)}: Accessible & Ready`);
      }
    }
  } else {
    console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY is currently empty in server/.env.');
    console.log('   Please add your Supabase Service Role Key to server/.env to enable automated verification.');
  }

  console.log('\n================================================================');
  console.log('📋 SUPABASE SQL EDITOR DIRECT APPLY INSTRUCTION');
  console.log('================================================================');
  console.log('You can also apply this migration in 1 click in the Supabase Dashboard:');
  console.log(`1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log(`2. Copy all contents of: supabase/migrations/001_initial_schema.sql`);
  console.log('3. Paste into the SQL Editor and click "RUN".');
  console.log('================================================================\n');
}

runMigration().catch((err) => {
  console.error('Migration Runner Exception:', err);
  process.exit(1);
});
