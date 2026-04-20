const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const config = require('../config');
const ReconciliationRun = require('../models/ReconciliationRun');
const { ingestAll } = require('../services/ingestion');
const { matchTransactions } = require('../services/matcher');
const { getFullReport, getSummary, getUnmatched } = require('../services/reporter');

router.post('/reconcile', async (req, res, next) => {
  try {
    const runId = uuidv4();
    const runConfig = {
      timestampToleranceSec: req.body.timestampToleranceSec || config.timestampToleranceSec,
      quantityTolerancePct: req.body.quantityTolerancePct || config.quantityTolerancePct
    };

    const run = await ReconciliationRun.create({
      runId,
      config: runConfig,
      status: 'processing'
    });

    const ingestionStats = await ingestAll(runId);
    const { results, summary } = await matchTransactions(runId, runConfig);

    run.results = results;
    run.summary = summary;
    run.status = 'completed';
    await run.save();

    res.status(201).json({
      runId,
      status: 'completed',
      ingestion: ingestionStats,
      summary
    });
  } catch (err) {
    next(err);
  }
});

router.get('/report/:runId', async (req, res, next) => {
  try {
    const report = await getFullReport(req.params.runId);
    if (!report) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.get('/report/:runId/summary', async (req, res, next) => {
  try {
    const summary = await getSummary(req.params.runId);
    if (!summary) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/report/:runId/unmatched', async (req, res, next) => {
  try {
    const unmatched = await getUnmatched(req.params.runId);
    if (!unmatched) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(unmatched);
  } catch (err) {
    next(err);
  }
});

router.get('/report/:runId/download', async (req, res, next) => {
  try {
    const report = await getFullReport(req.params.runId);
    if (!report) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report-${req.params.runId}.csv"`);
    res.send(report.csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
