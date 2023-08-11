import { execSync } from 'node:child_process'
import { $fetch } from 'ofetch'
import { inc } from 'semver'
import { determineBumpType, loadWorkspace } from './_utils'

const nightlyPackages = {
  nitropack: 'nitropack-edge',
  h3: 'h3-nightly',
  nuxi: 'nuxi-ng'
}

async function main () {
  const workspace = await loadWorkspace(process.cwd())

  const commit = execSync('git rev-parse --short HEAD').toString('utf-8').trim().slice(0, 8)
  const date = Math.round(Date.now() / (1000 * 60))

  const nuxtPkg = workspace.find('nuxt')
  for (const [pkg, name] of Object.entries(nightlyPackages)) {
    const { version: latest } = await $fetch<{ version: string }>(`https://registry.npmjs.org/${name}/latest`)
    nuxtPkg.data.dependencies[pkg] = `npm:${name}@^${latest}`
  }

  const bumpType = await determineBumpType()

  for (const pkg of workspace.packages.filter(p => !p.data.private)) {
    const newVersion = inc(pkg.data.version, bumpType || 'patch')
    workspace.setVersion(pkg.data.name, `${newVersion}-${date}.${commit}`, {
      updateDeps: true
    })
    const newname = pkg.data.name === 'nuxt' ? 'nuxt3' : (pkg.data.name + '-edge')
    workspace.rename(pkg.data.name, newname)
  }

  await workspace.save()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
