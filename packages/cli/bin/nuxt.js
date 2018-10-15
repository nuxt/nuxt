#!/usr/bin/env node

const consola = require('consola')
const cli = require('../dist/cli.js')
const _nuxt = require('./_nuxt.js')

_nuxt(cli, consola)
