const Transaction = require('../models/Transaction');
const { typesMatch } = require('../utils/normalization');

function isWithinTimeTolerance(ts1, ts2, toleranceSec) {
  if (!ts1 || !ts2) return false;
  const diffMs = Math.abs(ts1.getTime() - ts2.getTime());
  return diffMs <= toleranceSec * 1000;
}

function isWithinQtyTolerance(q1, q2, tolerancePct) {
  if (q1 == null || q2 == null) return false;
  if (q1 === 0 && q2 === 0) return true;
  const base = Math.max(Math.abs(q1), Math.abs(q2));
  const diff = Math.abs(q1 - q2);
  return (diff / base) * 100 <= tolerancePct;
}

function findDifferences(userTxn, exchTxn) {
  const diffs = {};

  if (userTxn.priceUsd != null && exchTxn.priceUsd != null && userTxn.priceUsd !== exchTxn.priceUsd) {
    diffs.priceUsd = {
      user: userTxn.priceUsd,
      exchange: exchTxn.priceUsd,
      diff: Math.abs(userTxn.priceUsd - exchTxn.priceUsd)
    };
  }

  if (userTxn.fee != null && exchTxn.fee != null && userTxn.fee !== exchTxn.fee) {
    diffs.fee = {
      user: userTxn.fee,
      exchange: exchTxn.fee,
      diff: Math.abs(userTxn.fee - exchTxn.fee)
    };
  }

  if (userTxn.quantity != null && exchTxn.quantity != null && userTxn.quantity !== exchTxn.quantity) {
    const base = Math.max(Math.abs(userTxn.quantity), Math.abs(exchTxn.quantity));
    const pctDiff = base > 0 ? (Math.abs(userTxn.quantity - exchTxn.quantity) / base) * 100 : 0;
    diffs.quantity = {
      user: userTxn.quantity,
      exchange: exchTxn.quantity,
      pctDiff: parseFloat(pctDiff.toFixed(6))
    };
  }

  if (userTxn.timestamp && exchTxn.timestamp) {
    const tsDiff = Math.abs(new Date(userTxn.timestamp) - new Date(exchTxn.timestamp));
    if (tsDiff > 0) {
      diffs.timestampOffsetMs = tsDiff;
    }
  }

  return Object.keys(diffs).length > 0 ? diffs : null;
}

function txnToReportObj(txn) {
  return {
    transactionId: txn.transactionId,
    timestamp: txn.timestamp,
    type: txn.type,
    asset: txn.asset,
    quantity: txn.quantity,
    priceUsd: txn.priceUsd,
    fee: txn.fee,
    note: txn.note,
    flags: txn.flags
  };
}

async function matchTransactions(runId, config) {
  const userTxns = await Transaction.find({ runId, source: 'user' }).lean();
  const exchTxns = await Transaction.find({ runId, source: 'exchange' }).lean();

  const results = [];
  const matchedExchangeIds = new Set();

  const validUserTxns = userTxns.filter(t => {
    if (!t.valid) {
      results.push({
        category: 'unmatched_user',
        reason: `Flagged during ingestion: ${t.flags.map(f => f.issue).join('; ')}`,
        userTransaction: txnToReportObj(t),
        exchangeTransaction: null,
        differences: null
      });
      return false;
    }
    return true;
  });

  const exchByAssetType = {};
  for (const etxn of exchTxns) {
    if (!etxn.valid) continue;
    const key = etxn.normalizedAsset;
    if (!exchByAssetType[key]) exchByAssetType[key] = [];
    exchByAssetType[key].push(etxn);
  }

  for (let i = 0; i < validUserTxns.length; i++) {
    const utxn = validUserTxns[i];
    const candidates = exchByAssetType[utxn.normalizedAsset] || [];

    let bestMatch = null;
    let bestTimeDiff = Infinity;

    for (const etxn of candidates) {
      if (matchedExchangeIds.has(etxn._id.toString())) continue;
      if (!typesMatch(utxn.type, etxn.type)) continue;
      if (!isWithinTimeTolerance(utxn.timestamp, etxn.timestamp, config.timestampToleranceSec)) continue;
      if (!isWithinQtyTolerance(utxn.quantity, etxn.quantity, config.quantityTolerancePct)) continue;

      const timeDiff = Math.abs(utxn.timestamp.getTime() - etxn.timestamp.getTime());
      if (timeDiff < bestTimeDiff) {
        bestTimeDiff = timeDiff;
        bestMatch = etxn;
      }
    }

    if (bestMatch) {
      matchedExchangeIds.add(bestMatch._id.toString());
      const diffs = findDifferences(utxn, bestMatch);

      if (diffs) {
        const diffFields = Object.keys(diffs).join(', ');
        results.push({
          category: 'conflicting',
          reason: `Matched by proximity but differs in: ${diffFields}`,
          userTransaction: txnToReportObj(utxn),
          exchangeTransaction: txnToReportObj(bestMatch),
          differences: diffs
        });
      } else {
        results.push({
          category: 'matched',
          reason: 'Matched within configured tolerances',
          userTransaction: txnToReportObj(utxn),
          exchangeTransaction: txnToReportObj(bestMatch),
          differences: null
        });
      }
    } else {
      results.push({
        category: 'unmatched_user',
        reason: 'No matching exchange transaction found within tolerances',
        userTransaction: txnToReportObj(utxn),
        exchangeTransaction: null,
        differences: null
      });
    }
  }

  for (const etxn of exchTxns) {
    if (matchedExchangeIds.has(etxn._id.toString())) continue;

    if (!etxn.valid) {
      results.push({
        category: 'unmatched_exchange',
        reason: `Flagged during ingestion: ${etxn.flags.map(f => f.issue).join('; ')}`,
        userTransaction: null,
        exchangeTransaction: txnToReportObj(etxn),
        differences: null
      });
    } else {
      results.push({
        category: 'unmatched_exchange',
        reason: 'No matching user transaction found within tolerances',
        userTransaction: null,
        exchangeTransaction: txnToReportObj(etxn),
        differences: null
      });
    }
  }

  const summary = results.reduce((acc, r) => {
    if (r.category === 'matched') acc.matched++;
    else if (r.category === 'conflicting') acc.conflicting++;
    else if (r.category === 'unmatched_user') acc.unmatchedUser++;
    else if (r.category === 'unmatched_exchange') acc.unmatchedExchange++;
    return acc;
  }, { matched: 0, conflicting: 0, unmatchedUser: 0, unmatchedExchange: 0 });
  summary.flaggedRows = userTxns.filter(t => t.flags.length > 0).length + exchTxns.filter(t => t.flags.length > 0).length;

  return { results, summary };
}

module.exports = { matchTransactions };
