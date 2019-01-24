#!/usr/bin/env node

// Globally indicate we are running in ts mode
process.env.NUXT_TS = 'true'

const nuxtCommands = ['dev', 'build', 'generate', 'start']
const rootDir = (process.argv[2] && !nuxtCommands.includes(process.argv[2])) ? process.argv[2] : process.cwd()

const suffix = require('../package.json').name.includes('-edge') ? '-edge' : ''

require('@nuxt/typescript' + suffix).setup(rootDir).then(() => {
  require('@nuxt/cli' + suffix).run()
}).catch((error) => {
  require('consola').fatal(error)
  process.exit(2)
})
