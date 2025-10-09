import { execSync } from 'node:child_process'
import { inc } from 'semver'
import { determineBumpType, loadWorkspace } from './_utils.ts'

const nightlyPackages = {
  // nitro: 'nitro-nightly',
  // h3: 'h3-nightly',
  'nuxi': 'nuxi-nightly',
  '@nuxt/cli': '@nuxt/cli-nightly',
}

export async function bumpNightly () {
  const workspace = await loadWorkspace(process.cwd())

  const commit = execSync('git rev-parse --short HEAD').toString('utf-8').trim().slice(0, 8)
  const date = Math.round(Date.now() / (1000 * 60))

  const bumpType = await determineBumpType()

  for (const pkg of workspace.packages.filter(p => !p.data.private)) {
    const newVersion = inc(pkg.data.version, bumpType || 'patch')
    if (!newVersion) {
      throw new Error(`Failed to increment version for package ${pkg.data.name} with version ${pkg.data.version}`)
    }

    workspace.setVersion(pkg.data.name, `${newVersion}-${date}.${commit}`, {
      updateDeps: true,
    })
    for (const [name, nightlyName] of Object.entries(nightlyPackages)) {
      if (pkg.data.dependencies && name in pkg.data.dependencies) {
        pkg.data.dependencies[name] = `npm:${nightlyName}@latest`
      }
    }
    const newname = pkg.data.name + '-nightly'
    workspace.rename(pkg.data.name, newname)
  }

  await workspace.save()
}
