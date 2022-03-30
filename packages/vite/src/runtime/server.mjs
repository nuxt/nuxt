import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { ViteNodeRunner } from 'vite-node/client'
import { dirname, join } from 'pathe'

const url = process.env.NUXT_VITE_SERVER_FETCH
const entry = process.env.NUXT_VITE_SERVER_ENTRY
const base = process.env.NUXT_VITE_SERVER_BASE
const root = process.env.NUXT_VITE_SERVER_ROOT

const runner = new ViteNodeRunner({
  root,
  base,
  async fetchModule (id) {
    return await $fetch(url, {
      method: 'POST',
      body: { id }
    })
  }
})

const IS_CSS_RE = /\.(css|postcss|sass|scss|less|stylus|styl)(\?[^.]+)?$/
function isCSS (file) {
  return IS_CSS_RE.test(file)
}

async function writeManifest () {
  const dir = dirname(fileURLToPath(import.meta.url))

  const entries = [
    '@vite/client',
    'entry.mjs',
    ...Array.from(runner.moduleCache.keys())
      .filter(i => runner.moduleCache.get(i).exports && isCSS(i))
      .map(i => i.slice(1))
  ]

  const clientManifest = {
    publicPath: '',
    all: entries,
    initial: entries,
    async: [],
    modules: {}
  }

  await fs.writeFile(join(dir, 'client.manifest.json'), JSON.stringify(clientManifest, null, 2), 'utf8')
  await fs.writeFile(join(dir, 'client.manifest.mjs'), 'export default ' + JSON.stringify(clientManifest, null, 2), 'utf8')
}

let render

export default async (ssrContext) => {
  render = render || (await runner.executeFile(entry)).default
  const result = await render(ssrContext)
  await writeManifest()
  return result
}
