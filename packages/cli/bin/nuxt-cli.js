#!/usr/bin/env node

require('../dist/cli.js').run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
