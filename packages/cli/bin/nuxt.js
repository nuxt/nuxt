#!/usr/bin/env node
const consola = require('consola')

const cli = require('..')

// Global error handler
process.on('unhandledRejection', (err) => {
  consola.error(err)
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

cli[cmd]().then(m => m.default()).catch((error) => {
  consola.fatal(error)
})
