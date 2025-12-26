const { Pool } = require('pg');
const path = require('path');
const { exec } = require('child_process');

const run = () => {
  return new Promise((resolve, reject) => {
    exec(
      `npx pg-migrate up -m ${path.join(__dirname, '../../migrations')}`,
      { env: process.env },
      (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(stdout);
      }
    );
  });
};

module.exports = run;
