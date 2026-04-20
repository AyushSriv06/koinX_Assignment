const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true },
  timestamp: { type: Date, default: null },
  type: { type: String, default: null },
  asset: { type: String, default: null },
  normalizedAsset: { type: String, default: null },
  quantity: { type: Number, default: null },
  priceUsd: { type: Number, default: null },
  fee: { type: Number, default: null },
  note: { type: String, default: '' },
  source: { type: String, enum: ['user', 'exchange'], required: true },
  runId: { type: String, required: true },
  flags: [{
    field: String,
    issue: String,
    originalValue: String
  }],
  valid: { type: Boolean, default: true }
}, { timestamps: true });

transactionSchema.index({ runId: 1, source: 1 });
transactionSchema.index({ runId: 1, normalizedAsset: 1, type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
