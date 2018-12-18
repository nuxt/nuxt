#!/usr/bin/env node

require('../dist/cli.js').run()
  .catch(() => process.exit(1))
