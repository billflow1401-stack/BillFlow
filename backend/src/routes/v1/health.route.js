const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  let dbStatusText = 'Disconnected';
  
  if (dbStatus === 1) dbStatusText = 'Connected';
  else if (dbStatus === 2) dbStatusText = 'Connecting';
  else if (dbStatus === 3) dbStatusText = 'Disconnecting';

  res.status(200).json({
    success: true,
    message: 'BillFlow-Pro API is running',
    timestamp: new Date().toISOString(),
    database: dbStatusText
  });
});

module.exports = router;
