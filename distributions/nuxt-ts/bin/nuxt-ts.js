#!/usr/bin/env node

const { register } = require('ts-node')

// globally indicate we are running in ts mode
process.env.NUXT_TS = 'true'

// https://github.com/TypeStrong/ts-node
register()

require('@nuxt/cli').run()
