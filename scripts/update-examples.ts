import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { resolve } from 'pathe'

async function run () {
  const examplesRoot = resolve(fileURLToPath(import.meta.url), '../../examples')

  const examples = await fs.readdir(examplesRoot)

  const data = await Promise.all(examples.map(async (name) => {
    const path = resolve(examplesRoot, name)
    if ((await fs.lstat(path)).isFile()) {
      return
    }

    const github = `https://github.com/nuxt/framework/tree/main/examples/${name}`
    const stackblitz = `https://stackblitz.com/github/nuxt/framework/tree/main/examples/${name}?file=app.vue&terminal=dev`
    return {
      name,
      path,
      github,
      stackblitz
    }
  }))

  const table = '| Example | Source | Playground |\n|---|---|---|\n' + data.filter(Boolean).map(i => `| \`${i.name}\` | [GitHub](${i.github}) | [Play Online](${i.stackblitz}) |`).join('\n')

  await fs.writeFile(resolve(examplesRoot, 'README.md'), `# Nuxt 3 Examples\n\n${table}\n`, 'utf-8')
}

run()
