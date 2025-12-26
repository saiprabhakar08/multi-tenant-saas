const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { checkDbConnection } = require('./config/db');
const { run: runMigrations } = require('./utils/runMigrations');
const { run: runSeeds } = require('./utils/runSeeds');
const { sendSuccess, sendError } = require('./utils/responseHelper');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/tenants', require('./routes/tenant.routes'));
app.use('/api', require('./routes/user.routes'));
app.use('/api', require('./routes/project.routes'));
app.use('/api', require('./routes/task.routes'));

app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDbConnection();

  if (!dbStatus) {
    return sendError(res, 500, 'Database connection failed', { database: 'disconnected' });
  }

  return sendSuccess(res, 200, {
    status: 'ok',
    database: 'connected'
  });
});

(async () => {
  try {
    console.log('Starting database initialization...');
    await runMigrations();
    console.log('Migrations completed successfully');
    await runSeeds();
    console.log('Seeds completed successfully');
    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('DB init failed:', err);
    // Don't exit, let the server start anyway
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
