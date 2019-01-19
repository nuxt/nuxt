#!/usr/bin/env node

// Globally indicate we are running in ts mode
process.env.NUXT_TS = 'true'

// https://github.com/TypeStrong/ts-node
require('ts-node').register({
  compilerOptions: {
    module: 'commonjs'
  }
})

const suffix = require('../package.json').name.includes('-edge') ? '-edge' : ''
require('@nuxt/cli' + suffix).run()
  .catch((error) => {
    require('consola').fatal(error)
  })
