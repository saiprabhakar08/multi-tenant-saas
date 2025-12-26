const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@database:5432/saas_db'
  });

  try {
    // Read all migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    
    console.log('Running migrations...');
    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
      }
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

module.exports = { run };
