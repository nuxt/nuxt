#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('fs-extra')
const { resolve } = require('path')
const { spawnSync } = require('child_process')

// paths
const packagePath = resolve(__dirname, '..', 'package.json')

// Read original contents of package.json
const originalPackage = readFileSync(packagePath, 'utf-8')

// Write to backup file
// writeFileSync(packagePath + '.backup', originalPackage)

// Parse package.json
const p = JSON.parse(originalPackage)

// Change package name
// p.name = 'nuxt-next'

// Get latest git commit id
const gitCommit = String(spawnSync('git', 'rev-parse --short HEAD'.split(' ')).stdout).trim()

// Version with latest git commit id
p.version = p.version.split('-')[0] + '-gh-' + gitCommit

// Write package.json
writeFileSync(packagePath, JSON.stringify(p, null, 2) + '\r\n')

// Log
console.log(p.name + '@' + p.version) // eslint-disable-line no-console
