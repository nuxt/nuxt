#!/usr/bin/env node

const consola = require('consola')
const cli = require('../dist/cli.js')

// Global error handler
process.on('unhandledRejection', (err) => {
  consola.error(err)
})

// Exit process on fatal errors
consola.add({
  log(logObj) {
    if (logObj.type === 'fatal') {
      process.stderr.write('Nuxt Fatal Error :(\n')
      process.exit(1)
    }
  }
})

const defaultCommand = 'dev'
const commands = new Set([
  defaultCommand,
  'build',
  'start',
  'generate'
])

let cmd = process.argv[2]

if (commands.has(cmd)) {
  process.argv.splice(2, 1)
} else {
  cmd = defaultCommand
}

// Apply default NODE_ENV if not provided
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = cmd === 'dev' ? 'development' : 'production'
}

cli[cmd]().then(m => m.default()).catch((error) => {
  consola.fatal(error)
})
