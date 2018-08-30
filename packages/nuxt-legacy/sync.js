#!/usr/bin/env node

const path = require('path')
const Package = require('../../build/package')

// Read nuxt package
const nuxt = new Package({ rootDir: path.resolve(__dirname, '../..') })

// Construct legacy package
const legacy = new Package({ rootDir: __dirname })

// Copy fields from nuxt package
legacy.copyFieldsFrom(nuxt, [
  'version',
  'contributors',
  'license',
  'repository',
  'keywords',
  'homepage',
  'engines',
  'dependencies'
])

// Copy files from nuxt package
legacy.copyFilesFrom(nuxt, [
  'LICENSE.md',
  'bin'
])

// Update package.json for legacy package
legacy.writePakage()
