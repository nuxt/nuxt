#!/usr/bin/env node -r esm
import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import Package from './package.js'

const useCjs = [
  '@nuxt/cli'
]

const stub = {
  es: 'export * from \'../src/index\'',
  cjs: `const _require = typeof jest === 'undefined' ? require('esm')(module) : require
  global.__NUXT_DEV__ = true
  module.exports = _require('../src/index')
`
}

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
