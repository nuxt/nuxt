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
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
