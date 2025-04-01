import { Pool } from 'pg';
import { env } from './env';

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection using async/await
const testConnection = async () => {
  let client;
  
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Connected to database:', result.rows[0].now);
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    // Release client back to pool if it exists
    if (client) client.release();
  }
};

// Run test connection
testConnection().catch(err => {
  console.error('Unexpected error during database connection test:', err);
});

export default pool;