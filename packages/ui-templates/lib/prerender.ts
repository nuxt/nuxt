import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import { fdir } from 'fdir'

const templatesRoot = fileURLToPath(new URL('..', import.meta.url))

async function main () {
  const templates = new fdir().glob('*.js').crawl(join(templatesRoot, 'dist/templates')).sync()
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
