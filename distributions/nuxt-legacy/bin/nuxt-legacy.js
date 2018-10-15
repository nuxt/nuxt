#!/usr/bin/env node

const register = require('@babel/register')

require('@babel/polyfill')

register({
  presets: [
    [ '@babel/env', { targets: { node: 'current' } } ]
  ],
  ignore: [
    (path) => {
      const isNodeModules = path.indexOf('node_modules') !== -1
      if (!isNodeModules) {
        return false
      }
      return path.indexOf('@nuxtjs/') === -1
    }
  ]
})

require('@nuxtjs/cli/bin/nuxt.js')
