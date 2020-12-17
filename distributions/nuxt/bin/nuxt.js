#!/usr/bin/env node

require('../dist/nuxt').run()
  .catch((error) => {
    require('consola').fatal(error)
    process.exit(2)
  })
