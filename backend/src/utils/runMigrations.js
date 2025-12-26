const { Pool } = require('pg');
const path = require('path');
const { exec } = require('child_process');

const run = () => {
  return new Promise((resolve, reject) => {
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:password@database:5432/saas_db';
    exec(
      `npx pg-migrate up -m ${path.join(__dirname, '../../migrations')} -u "${dbUrl}"`,
      { env: process.env },
      (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(stdout);
      }
    );
  });
};

module.exports = run;
