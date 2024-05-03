import { join, resolve } from 'node:path'
import { promises as fsp } from 'node:fs'
import { globby } from 'globby'

const r = (...path: string[]) => resolve(join(__dirname, '..', ...path))

async function main () {
  const templates = await globby(r('dist/templates/*.js'))
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
