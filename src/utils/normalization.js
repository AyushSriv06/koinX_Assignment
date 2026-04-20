const ASSET_ALIASES = {
  'bitcoin': 'BTC',
  'btc': 'BTC',
  'ethereum': 'ETH',
  'eth': 'ETH',
  'solana': 'SOL',
  'sol': 'SOL',
  'polygon': 'MATIC',
  'matic': 'MATIC',
  'chainlink': 'LINK',
  'link': 'LINK',
  'tether': 'USDT',
  'usdt': 'USDT',
};

const TYPE_PERSPECTIVE_MAP = {
  'TRANSFER_IN': 'TRANSFER_OUT',
  'TRANSFER_OUT': 'TRANSFER_IN',
};

const VALID_TYPES = ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'];

function normalizeAsset(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return ASSET_ALIASES[lower] || raw.trim().toUpperCase();
}

function typesMatch(userType, exchangeType) {
  if (!userType || !exchangeType) return false;
  if (userType === exchangeType) return true;
  return TYPE_PERSPECTIVE_MAP[userType] === exchangeType;
}

function isValidType(type) {
  return VALID_TYPES.includes(type);
}

module.exports = {
  normalizeAsset,
  typesMatch,
  isValidType,
  VALID_TYPES,
  TYPE_PERSPECTIVE_MAP,
  ASSET_ALIASES
};
