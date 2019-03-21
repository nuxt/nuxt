#!/usr/bin/env node

require('core-js')
require('regenerator-runtime/runtime')

require('@babel/register')({
  presets: [
    [ '@babel/env', { targets: { node: 'current' } } ]
  ],
  plugins: [
    '@babel/plugin-syntax-dynamic-import'
  ],
  ignore: [
    (path) => {
      // Transpile known packages
      if (/(@nuxt|@nuxtjs)[\\/]|proper-lockfile|webpack|vue-app/.test(path)) {
        return false
      }
      // Ignore everything else inside node_modules
      if (/node_modules/.test(path)) {
        return true
      }
      // Transpile project files
      return false
    }
  ]
})

const suffix = require('../package.json').name.includes('-edge') ? '-edge' : ''
require('@nuxt/cli' + suffix).run()
  .catch((error) => {
    require('consola').fatal(error)
    process.exit(2)
  })
