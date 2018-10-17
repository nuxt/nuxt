#!/usr/bin/env node

const register = require('@babel/register')

require('@babel/polyfill')

register({
  presets: [
    [ '@babel/env', { targets: { node: 'current' } } ]
  ],
  ignore: [
    (path) => {
      // Transpile known packages
      if (/(@nuxt|@nuxtjs)[\\/]/.test(path)) {
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

require('@nuxt/cli/bin/nuxt.js')
