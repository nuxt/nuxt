#!/usr/bin/env node
const { name } = require('../package.json')
const isEdge = name.indexOf('-edge') !== -1
const cli = require(isEdge ? '@nuxt/cli-edge' : '@nuxt/cli')
if (process.argv[2] !== 'start') {
  process.argv.splice(2, 0, 'start')
}
cli.run()
