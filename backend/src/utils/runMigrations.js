const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const run = async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
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
        // Extract only the UP migration (before -- DOWN comment)
        const upSql = sql.split('-- DOWN')[0].replace(/-- UP\s*\n?/, '').trim();
        console.log(`Executing SQL: ${upSql.substring(0, 100)}...`);
        if (upSql) {
          await pool.query(upSql);
        }
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
