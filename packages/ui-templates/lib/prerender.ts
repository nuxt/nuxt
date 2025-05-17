import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import { glob } from 'tinyglobby'

const templatesRoot = fileURLToPath(new URL('..', import.meta.url))

async function main () {
  const templates = await glob(['dist/templates/*.js'], { cwd: templatesRoot })
  for (const file of templates) {
    const { template } = await import(file)
    const updated = template({
      // messages: {},
      name: '{{ name }}', // TODO
    })
    await fsp.mkdir(file.replace('.js', ''))
    await fsp.writeFile(file.replace('.js', '/index.html'), updated)
  }
}

main().catch(console.error)
