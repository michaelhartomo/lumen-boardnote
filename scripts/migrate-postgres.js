#!/usr/bin/env node
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run_migration() {
  const custom_url = process.argv[2];
  const db_url = (custom_url || process.env.DATABASE_URL || '').trim();

  if (!db_url || db_url.includes('•') || db_url.includes('*') || db_url.includes('<password>')) {
    console.error(`
[DigitalOcean PostgreSQL Migration Error]
Valid DATABASE_URL is required to run the migration against PostgreSQL.
Usage:
  node scripts/migrate-postgres.js "postgresql://doadmin:pass@app-do-user-xxx.b.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
or set DATABASE_URL in your environment.
`);
    process.exit(1);
  }

  let connection_str = db_url;
  try {
    const url_obj = new URL(db_url);
    if (url_obj.searchParams.has('sslmode')) {
      url_obj.searchParams.delete('sslmode');
    }
    connection_str = url_obj.toString();
  } catch (_) {
    connection_str = db_url.replace(/([?&])sslmode=[^&]*(&|$)/g, '$1').replace(/[?&]$/, '');
  }

  const is_local = connection_str.includes('localhost') || connection_str.includes('127.0.0.1');
  const ssl_config = (process.env.DATABASE_SSL === 'false' || is_local) ? false : { rejectUnauthorized: false };

  const pool = new pg.Pool({
    connectionString: connection_str,
    ssl: ssl_config,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  let client = null;
  try {
    console.log('[PostgreSQL Migration] Connecting to PostgreSQL database...');
    client = await pool.connect();
    console.log('[PostgreSQL Migration] Connected successfully.');

    const sql_path = path.join(__dirname, 'migrate_boards_table.sql');
    const sql_content = fs.readFileSync(sql_path, 'utf8');

    console.log('[PostgreSQL Migration] Executing lm_* schema & data migration...');
    await client.query(sql_content);
    console.log('[PostgreSQL Migration] Schema & data migration executed successfully.');

    // Verify new lm_* tables
    const res = await client.query(`
      SELECT 
        table_name,
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public'
        AND table_name IN (
          'lm_board',
          'lm_board_card',
          'lm_board_activity',
          'lm_card_comment',
          'lm_file_storage',
          'lm_ai_usage',
          'lm_bandwidth_usage',
          'lm_user_setting'
        )
      ORDER BY table_name, ordinal_position;
    `);

    console.log('\n[PostgreSQL Migration] Verified lm_* tables structure:');
    console.table(res.rows);

    client.release();
    client = null;
    await pool.end();
    console.log('[PostgreSQL Migration] Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[PostgreSQL Migration Failed]:', err.message);
    if (client) {
      try { client.release(true); } catch (_) {}
      client = null;
    }
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

run_migration();
