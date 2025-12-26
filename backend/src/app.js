const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { checkDbConnection } = require('./config/db');
const runMigrations = require('./utils/runMigrations');
const runSeeds = require('./utils/runSeeds');
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
    await runMigrations();
    await runSeeds();
    console.log('Migrations & seeds completed');
  } catch (err) {
    console.error('DB init failed:', err);
    process.exit(1);
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
