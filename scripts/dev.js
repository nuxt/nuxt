#!/usr/bin/env node -r esm
import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import Package from './package.js'

const useCjs = [
  '@nuxt/cli'
]

const stub = {
  es: `export * from '../src/index'`,
  cjs: `const esm = require('esm')

const _require = esm(module)

const execa = require('execa')

global.__NUXT = {}
Object.defineProperty(global.__NUXT, 'version', {
  enumerable: true,
  get() {
    try {
      const { stdout } = execa.sync('git', ['status', '-s', '-b', '--porcelain=2'])

      const status = { dirty: false }
      for (const line of stdout.split('\\n')) {
        if (line[0] === '#') {
          const match = line.match(/branch\\.([^\\s]+) (.*)$/)
          if (match && match.length) {
            status[match[1]] = match[2]
          }
        } else {
          status.dirty = true
          break
        }
      }

      return \`git<\${status.head}\${status.dirty ? '~' : '-'}\${(status.oid && status.oid.substr(0, 7)) || ''}>\` +
        (status.ab ? \` (\${status.ab})\` : '')
    } catch (err) {
      return 'source'
    }
  }
})

module.exports = _require('../src/index')
` }

async function main () {
  // Read package at current directory
  const rootPackage = new Package()
  const workspacePackages = await rootPackage.getWorkspacePackages()

  // Create a dev-only entrypoint to the src
  for (const pkg of workspacePackages) {
    if (!pkg.pkg.main || !pkg.options.build) {
      continue
    }
    consola.info(pkg.pkg.main)
    const distMain = pkg.resolvePath(pkg.pkg.main)
    await fs.mkdirp(path.dirname(distMain))
    await fs.writeFile(distMain, useCjs.includes(pkg.pkg.name) ? stub.cjs : stub.es)
  }
}

main().catch((error) => {
  consola.error(error)
  process.exit(1)
})
