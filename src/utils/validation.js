const { isValidType } = require('./normalization');

function isValidTimestamp(ts) {
  if (!ts) return false;
  const d = new Date(ts);
  return !isNaN(d.getTime());
}

function createFlag(field, issue, originalValue) {
  return { field, issue, originalValue: originalValue || '' };
}

function validateRow(row) {
  const flags = [];

  if (!isValidTimestamp(row.timestamp)) {
    flags.push(createFlag(
      'timestamp',
      row.timestamp ? 'Malformed timestamp' : 'Missing timestamp',
      row.timestamp
    ));
  }

  if (!row.type || !isValidType(row.type.toUpperCase())) {
    flags.push(createFlag(
      'type',
      row.type ? `Unknown transaction type: ${row.type}` : 'Missing transaction type',
      row.type
    ));
  }

  if (!row.asset) {
    flags.push(createFlag('asset', 'Missing asset', ''));
  }

  const qty = parseFloat(row.quantity);
  if (isNaN(qty)) {
    flags.push(createFlag('quantity', 'Non-numeric quantity', row.quantity));
  } else if (qty < 0) {
    flags.push(createFlag('quantity', 'Negative quantity', row.quantity));
  }

  return flags;
}

module.exports = { validateRow, isValidTimestamp };
