#!/usr/bin/env node

// Globally indicate we are running in ts mode
process.env.NUXT_TS = 'true'

// rootDir should be set by a CLI helper to handle cases like `nuxt-ts path/to/project`
const rootDir = process.cwd()

const { generateTsConfigIfMissing, registerTsNode } = require('..')

generateTsConfigIfMissing(rootDir).then(() => {
  registerTsNode()
  const suffix = require('../package.json').name.includes('-edge') ? '-edge' : ''
  require('@nuxt/cli' + suffix).run()
    .catch((error) => {
      require('consola').fatal(error)
      process.exit(2)
    })
})
