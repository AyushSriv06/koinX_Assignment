const fs = require('fs');
const { parse } = require('csv-parse');

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      })
    );

    parser.on('data', (row) => rows.push(row));
    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve(rows));
  });
}

module.exports = { parseCSV };
