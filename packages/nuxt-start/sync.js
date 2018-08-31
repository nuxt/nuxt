#!/usr/bin/env node

const path = require('path')
const Package = require('../../build/package')

// Read nuxt package
const nuxt = new Package({ rootDir: path.resolve(__dirname, '../..') })

// Construct start package
const start = new Package({ rootDir: __dirname })

// Copy fields from nuxt package
start.copyFieldsFrom(nuxt, [
  'version',
  'contributors',
  'license',
  'repository',
  'keywords',
  'homepage',
  'engines'
])

// Copy files from nuxt package
start.copyFilesFrom(nuxt, [
  'LICENSE.md',
  'bin/common',
  'bin/nuxt-start'
])

// Sync dependencies
start.updateDependencies({
  dist: 'dist/nuxt-start.js',
  sources: [
    nuxt,
    start
  ],
  extras: [
    'minimist'
  ],
  exclude: [
    'jsdom'
  ]
})

// Update package.json for start package
start.writePackage()
