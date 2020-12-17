#!/usr/bin/env node

process.__NUXT_PATHS__ = (process.__NUXT_PATHS__ || []).concat(__dirname)

const suffix = require('../package.json').name.includes('-edge') ? '-edge' : ''
require('@nuxt/cli' + suffix).run()
  .catch((error) => {
    require('consola').fatal(error)
    process.exit(2)
  })
