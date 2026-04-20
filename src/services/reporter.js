const ReconciliationRun = require('../models/ReconciliationRun');

function buildCSVReport(results) {
  const headers = [
    'category',
    'reason',
    'user_transaction_id',
    'user_timestamp',
    'user_type',
    'user_asset',
    'user_quantity',
    'user_price_usd',
    'user_fee',
    'exchange_transaction_id',
    'exchange_timestamp',
    'exchange_type',
    'exchange_asset',
    'exchange_quantity',
    'exchange_price_usd',
    'exchange_fee',
    'differences'
  ];

  const rows = results.map(r => {
    const u = r.userTransaction || {};
    const e = r.exchangeTransaction || {};
    return [
      r.category,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      u.transactionId || '',
      u.timestamp || '',
      u.type || '',
      u.asset || '',
      u.quantity ?? '',
      u.priceUsd ?? '',
      u.fee ?? '',
      e.transactionId || '',
      e.timestamp || '',
      e.type || '',
      e.asset || '',
      e.quantity ?? '',
      e.priceUsd ?? '',
      e.fee ?? '',
      r.differences ? `"${JSON.stringify(r.differences).replace(/"/g, '""')}"` : ''
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

async function getFullReport(runId) {
  const run = await ReconciliationRun.findOne({ runId });
  if (!run) return null;
  return {
    runId: run.runId,
    status: run.status,
    config: run.config,
    summary: run.summary,
    results: run.results,
    csv: buildCSVReport(run.results),
    createdAt: run.createdAt
  };
}

async function getSummary(runId) {
  const run = await ReconciliationRun.findOne({ runId }).select('runId status summary config createdAt');
  if (!run) return null;
  return {
    runId: run.runId,
    status: run.status,
    config: run.config,
    summary: run.summary,
    createdAt: run.createdAt
  };
}

async function getUnmatched(runId) {
  const run = await ReconciliationRun.findOne({ runId });
  if (!run) return null;

  const unmatched = run.results.filter(
    r => r.category === 'unmatched_user' || r.category === 'unmatched_exchange'
  );

  return {
    runId: run.runId,
    count: unmatched.length,
    entries: unmatched
  };
}

module.exports = { getFullReport, getSummary, getUnmatched, buildCSVReport };
