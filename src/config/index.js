require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/koinx_reconciliation',
  timestampToleranceSec: parseInt(process.env.TIMESTAMP_TOLERANCE_SECONDS, 10) || 300,
  quantityTolerancePct: parseFloat(process.env.QUANTITY_TOLERANCE_PCT) || 0.01,
};

module.exports = config;
