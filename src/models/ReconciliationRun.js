const mongoose = require('mongoose');

const resultEntrySchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['matched', 'conflicting', 'unmatched_user', 'unmatched_exchange'],
    required: true
  },
  reason: { type: String, required: true },
  userTransaction: { type: mongoose.Schema.Types.Mixed, default: null },
  exchangeTransaction: { type: mongoose.Schema.Types.Mixed, default: null },
  differences: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false });

const reconciliationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  config: {
    timestampToleranceSec: Number,
    quantityTolerancePct: Number
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  results: [resultEntrySchema],
  summary: {
    matched: { type: Number, default: 0 },
    conflicting: { type: Number, default: 0 },
    unmatchedUser: { type: Number, default: 0 },
    unmatchedExchange: { type: Number, default: 0 },
    flaggedRows: { type: Number, default: 0 }
  },
  error: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('ReconciliationRun', reconciliationRunSchema);
