#!/usr/bin/env node

require('../dist/cli.js').run()
  .catch((error) => {
    require('consola').fatal(error)
  })
