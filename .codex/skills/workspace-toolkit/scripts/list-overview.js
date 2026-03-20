const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'assets', 'mock-workspace');
const entries = fs.readdirSync(root, { withFileTypes: true });
const output = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => `${entry.name}/`)
  .join('\n');

process.stdout.write(output || '(empty)');
