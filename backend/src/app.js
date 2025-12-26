const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { checkDbConnection } = require('./config/db');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDbConnection();

  if (!dbStatus) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected'
    });
  }

  res.status(200).json({
    status: 'ok',
    database: 'connected'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
