import consola from 'consola'

import Package from './package.js'

async function main () {
  // Read package at current directory
  const rootPackage = new Package()
  const workspacePackages = await rootPackage.getWorkspacePackages()

  const watch = process.argv.includes('--watch')

  if (watch) {
    consola.info('Watch mode')
  }

  // Universal linkedDependencies based on workspace
  const linkedDependencies = workspacePackages
    .map(p => p.pkg.name.replace(p.options.suffix, ''))

  for (const pkg of workspacePackages) {
    pkg.options.linkedDependencies = (pkg.options.linkedDependencies || [])
      .concat(linkedDependencies)
  }

  // Step 1: Apply suffixes
  for (const pkg of workspacePackages) {
    if (pkg.options.suffix && pkg.options.suffix.length) {
      pkg.suffixAndVersion()
      await pkg.writePackage()
    }
  }

  // Step 2: Build packages
  for (const pkg of workspacePackages) {
    if (pkg.options.build) {
      if (watch) {
        pkg.watch()
      } else {
        await pkg.build()
      }
    }
  }

  // Step 3: Link dependencies and Fix packages
  for (const pkg of workspacePackages) {
    pkg.syncLinkedDependencies()
    pkg.autoFix()
    pkg.writePackage()
  }
}

main().catch((error) => {
  consola.error(error)
  process.exit(1)
})
