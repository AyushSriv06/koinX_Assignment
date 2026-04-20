# Transaction Reconciliation Engine

A Node.js service that ingests crypto transaction data from two sources (user-reported and exchange-exported), matches them using configurable tolerances, and produces a categorized reconciliation report.

## Setup

### Prerequisites
- Node.js v18+
- MongoDB running locally on port 27017

### Installation

```bash
git clone <repo-url>
cd koinX_Assignment
npm install
```

### Environment Variables

Copy and adjust `.env` as needed:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/koinx_reconciliation
TIMESTAMP_TOLERANCE_SECONDS=300
QUANTITY_TOLERANCE_PCT=0.01
```

### Start the server

```bash
npm start
```

## API Endpoints

### POST /reconcile

Triggers a full reconciliation run. Accepts optional tolerance overrides in the request body.

```bash
curl -X POST http://localhost:3000/reconcile \
  -H "Content-Type: application/json" \
  -d '{"timestampToleranceSec": 300, "quantityTolerancePct": 0.01}'
```

Response:
```json
{
  "runId": "uuid-string",
  "status": "completed",
  "ingestion": {
    "userCount": 26,
    "exchangeCount": 25,
    "flaggedCount": 5
  },
  "summary": {
    "matched": 15,
    "conflicting": 4,
    "unmatchedUser": 5,
    "unmatchedExchange": 2
  }
}
```

### GET /report/:runId

Returns the full reconciliation report including all matched, conflicting, and unmatched entries with a CSV export.

```bash
curl http://localhost:3000/report/<runId>
```

### GET /report/:runId/summary

Returns only the counts.

```bash
curl http://localhost:3000/report/<runId>/summary
```

### GET /report/:runId/unmatched

Returns only the unmatched rows with reasons for why they could not be matched.

```bash
curl http://localhost:3000/report/<runId>/unmatched
```

## Data Quality Handling

The engine does not silently drop bad rows. Instead, it flags issues and keeps the rows in the database for full traceability.

Issues detected:
- **Malformed/missing timestamps** — rows like `2024-03-09T` or empty timestamp fields
- **Negative quantities** — flagged as invalid (e.g., a BUY with quantity -0.1)
- **Missing required fields** — type, asset, or transaction ID
- **Duplicate IDs** — second occurrence within the same source is flagged, marked invalid
- **Asset aliases** — `bitcoin` is normalized to `BTC`, `ethereum` to `ETH`, etc.

## Matching Logic

The engine matches transactions across the two sources using:

1. **Asset** — case-insensitive with alias resolution
2. **Type** — exact match, with perspective mapping (`TRANSFER_OUT` on user side maps to `TRANSFER_IN` on exchange side)
3. **Timestamp** — within ± configurable window (default 300 seconds)
4. **Quantity** — within ± configurable percentage tolerance (default 0.01%)

When multiple candidates match, the closest by timestamp is selected.

Matched pairs are then checked for conflicts in price, fee, or quantity. If any field differs, the pair is categorized as "conflicting" with the specific differences noted.

## Report Categories

| Category | Meaning |
|----------|---------|
| matched | Paired across both sources within tolerances, no field conflicts |
| conflicting | Paired by proximity, but price/fee/quantity differ beyond tolerance |
| unmatched_user | Present in user file only, or flagged as invalid during ingestion |
| unmatched_exchange | Present in exchange file only |

## Project Structure

```
├── server.js                  # Entry point
├── src/
│   ├── app.js                 # Express setup
│   ├── config/index.js        # Tolerance defaults from env
│   ├── models/
│   │   ├── Transaction.js     # Ingested transaction schema
│   │   └── ReconciliationRun.js  # Run results + summary
│   ├── services/
│   │   ├── ingestion.js       # CSV parsing + validation
│   │   ├── matcher.js         # Matching engine
│   │   └── reporter.js        # Report queries + CSV export
│   ├── routes/
│   │   └── reconcile.js       # API endpoints
│   └── utils/
│       ├── csvParser.js       # CSV file reader
│       ├── normalization.js   # Asset aliases + type mapping
│       └── validation.js      # Row validation helpers
├── public/
│   ├── user_transactions.csv
│   └── exchange_transactions.csv
└── .env
```
