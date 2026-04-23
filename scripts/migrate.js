#!/usr/bin/env node
require('dotenv').config();
const { ensureSchema } = require('../db/ensureSchema');

(async () => {
  try {
    await ensureSchema();
    // eslint-disable-next-line no-console
    console.log('Schema OK');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
})();
