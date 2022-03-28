import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { ViteNodeRunner } from 'vite-node/client'
import { dirname, join } from 'pathe'

const entry = '__NUXT_SERVER_ENTRY__'
const url = '__NUXT_SERVER_FETCH_URL__'
const base = '__NUXT_SERVER_BASE__'

const runner = new ViteNodeRunner({
  root: process.cwd(),
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

async function writeManifest (extraEntries) {
  const dir = dirname(fileURLToPath(import.meta.url))

  const entries = [
    '@vite/client',
    'entry.mjs',
    ...extraEntries
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

export default async (ssrContext) => {
  const { default: render } = await runner.executeFile(entry)
  const result = await render(ssrContext)
  const modules = Array.from(runner.moduleCache.keys())
  // Write CSS modules intro manifest to prevent FOUC
  await writeManifest(modules.filter(i => isCSS(i)).map(i => i.slice(1)))
  return result
}
