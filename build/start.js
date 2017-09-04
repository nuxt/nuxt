#!/usr/bin/env node

const now = Date.now()

const { readFileSync, readJSONSync, writeFileSync, copySync, removeSync } = require('fs-extra')
const { resolve, relative } = require('path')

// Dirs
const rootDir = resolve(__dirname, '..')
const startDir = resolve(rootDir, 'start')

// Read main package.json
const packageJSON = readJSONSync(resolve(rootDir, 'package.json'))

// Required and Excluded packages for start
let requires = [
  'source-map-support',
  'pretty-error',
  'minimist'
]

const excludes = [
  'path',
  'fs',
  'http',
  'module'
].concat(Object.keys(packageJSON.devDependencies))

// Parse dist/core.js for all external dependencies
const requireRegex = /require\('([-@/\w]+)'\)/g
const rawCore = readFileSync(resolve(rootDir, 'dist/core.js'))
let match = requireRegex.exec(rawCore)
while (match) {
  requires.push(match[1])
  match = requireRegex.exec(rawCore)
}

// Apply Excludes
requires = requires.filter(r => excludes.indexOf(r) === -1)

// Resolve version constrains
let dependencies = {}
requires.forEach(r => {
  if (!packageJSON.dependencies[r]) {
    console.warn('Cannot resolve dependency version for ' + r)
    return
  }
  dependencies[r] = packageJSON.dependencies[r]
})

// Drop fields
let drops = ['devDependencies', 'scripts', 'nyc', 'types']
drops.forEach(k => {
  delete packageJSON[k]
})

// Update dependencies
packageJSON.dependencies = dependencies

// Update package meta
packageJSON.name = 'nuxt-start'
packageJSON.description = 'runtime-only build for nuxt'
packageJSON.bin = {
  'nuxt-start': './bin/nuxt-start'
}

// Update package.json
writeFileSync(resolve(startDir, 'package.json'), JSON.stringify(packageJSON, null, 2))

// Copy required files
const excludeFiles = [
  'README.md',
  '.gitignore'
]
packageJSON.files.forEach(file => {
  if (excludeFiles.indexOf(file) !== -1) {
    return
  }
  let src = resolve(rootDir, file)
  let dst = resolve(startDir, file)
  // console.log(relative(rootDir, src), '~>', relative(rootDir, dst))
  removeSync(dst)
  copySync(src, dst)
})

// Remove extras
const extraFiles = [
  'bin/nuxt-build',
  'bin/nuxt-generate',
  'bin/nuxt-dev',
  'bin/nuxt',
  'dist/nuxt.js',
  'dist/nuxt.js.map'
]
extraFiles.forEach(file => {
  removeSync(resolve(startDir, file))
})

// Patch index.js
const startIndexjs = resolve(startDir, 'index.js')
writeFileSync(startIndexjs, String(readFileSync(startIndexjs)).replace('./dist/nuxt', './dist/core'))

// Patch bin/nuxt-start
const binStart = resolve(startDir, 'bin/nuxt-start')
writeFileSync(binStart, String(readFileSync(binStart)).replace(/nuxt start/g, 'nuxt-start'))

const ms = Date.now() - now
console.log(`Generated ${packageJSON.name}@${packageJSON.version} in ${ms}ms`)
