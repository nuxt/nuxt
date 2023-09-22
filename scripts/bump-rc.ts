import { inc } from 'semver'
import { consola } from 'consola'
import { loadWorkspace } from './_utils'

async function main () {
  const workspace = await loadWorkspace(process.cwd())

  for (const pkg of workspace.packages.filter(p => !p.data.private)) {
    // TODO: Set release type based on changelog after 3.0.0
    const newVersion = inc(pkg.data.version, 'prerelease', 'rc')
    workspace.setVersion(pkg.data.name, newVersion!)
  }

  await workspace.save()
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
