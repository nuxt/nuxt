#!/usr/bin/env node

require('..').run().catch((error) => {
  console.error(error) // eslint-disable-line no-console
  process.exit(2)
})
