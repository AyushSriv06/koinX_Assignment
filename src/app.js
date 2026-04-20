const express = require('express');
const routes = require('./routes/reconcile');

const app = express();

app.use(express.json());
app.use('/', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
