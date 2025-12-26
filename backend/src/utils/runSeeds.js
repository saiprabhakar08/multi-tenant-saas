const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const run = async () => {
  const seedSQL = fs.readFileSync(
    path.join(__dirname, '../../seeds/seed_data.sql'),
    'utf8'
  );
  await pool.query(seedSQL);
};

module.exports = { run };
