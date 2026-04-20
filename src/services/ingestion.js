const path = require('path');
const Transaction = require('../models/Transaction');
const { parseCSV } = require('../utils/csvParser');
const { normalizeAsset } = require('../utils/normalization');
const { validateRow, isValidTimestamp } = require('../utils/validation');

const DATA_DIR = path.join(__dirname, '../../public');

function buildTransaction(row, source, runId, flags) {
  const type = row.type ? row.type.toUpperCase().trim() : null;
  const rawAsset = row.asset ? row.asset.trim() : null;
  const ts = isValidTimestamp(row.timestamp) ? new Date(row.timestamp) : null;

  return {
    transactionId: row.transaction_id,
    timestamp: ts,
    type,
    asset: rawAsset,
    normalizedAsset: normalizeAsset(rawAsset),
    quantity: parseFloat(row.quantity) || null,
    priceUsd: parseFloat(row.price_usd) || null,
    fee: parseFloat(row.fee) || null,
    note: row.note || '',
    source,
    runId,
    flags,
    valid: flags.length === 0
  };
}

async function ingestFile(filename, source, runId) {
  const filePath = path.join(DATA_DIR, filename);
  const rows = await parseCSV(filePath);
  const transactions = [];
  const seenIds = new Set();

  for (const row of rows) {
    const flags = validateRow(row);

    if (seenIds.has(row.transaction_id)) {
      flags.push({
        field: 'transaction_id',
        issue: 'Duplicate transaction ID within same source',
        originalValue: row.transaction_id
      });
    }
    seenIds.add(row.transaction_id);

    const txn = buildTransaction(row, source, runId, flags);
    if (flags.some(f => f.issue.includes('Duplicate'))) {
      txn.valid = false;
    }

    transactions.push(txn);
  }

  await Transaction.insertMany(transactions);
  return transactions;
}

async function ingestAll(runId) {
  const userTxns = await ingestFile('user_transactions.csv', 'user', runId);
  const exchangeTxns = await ingestFile('exchange_transactions.csv', 'exchange', runId);

  const flaggedCount = [...userTxns, ...exchangeTxns].filter(t => t.flags.length > 0).length;

  return {
    userCount: userTxns.length,
    exchangeCount: exchangeTxns.length,
    flaggedCount
  };
}

module.exports = { ingestAll };
