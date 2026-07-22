import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { consola } from 'consola'
import { loadWorkspace } from './_utils'

async function main () {
  const workspace = await loadWorkspace(process.cwd())

  const newVersion = process.argv[2]
  if (!newVersion) {
    throw new Error('Please provide version!')
  }

  for (const pkg of workspace.packages.filter(p => !p.data.private)) {
    workspace.setVersion(pkg.data.name, newVersion!)
  }

  await workspace.save()

  // The committed ui-templates output bakes in the nuxt package version,
  // so it must be regenerated whenever versions are bumped.
  execFileSync('pnpm', ['--filter', '@nuxt/ui-templates', 'build'], { stdio: 'inherit' })
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
