import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLargeApp } from '../../test/bench/large-app.ts'

export interface Fixture {
  id: string
  description: string
  /** Routes requested by the `dev` and `render` suites, each with a string the response must contain. */
  routes: { path: string, match: string }[]
  /** Component edited by the `hmr` suite, relative to the fixture, and the text it renders. */
  hmr?: { file: string, text: string, route: string }
  create: (dir: string) => Promise<void>
}

export const fixtures: Fixture[] = [
  {
    id: 'minimal',
    description: 'a single `app.vue`',
    routes: [{ path: '/', match: 'bench-minimal' }],
    hmr: { file: 'app/app.vue', text: 'bench-minimal', route: '/' },
    async create (dir) {
      await rm(dir, { recursive: true, force: true })
      await mkdir(join(dir, 'app'), { recursive: true })
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'nuxt-bench-minimal', private: true, type: 'module' }))
      await writeFile(join(dir, 'nuxt.config.ts'), `export default defineNuxtConfig({\n  devtools: { enabled: false },\n  compatibilityDate: 'latest',\n})\n`)
      await writeFile(join(dir, 'app/app.vue'), '<template>\n  <div>bench-minimal</div>\n</template>\n')
    },
  },
  {
    id: 'large',
    description: 'generated app with ~170 pages, ~370 components, plugins, middleware, server routes and a layer',
    routes: [
      { path: '/', match: '<h1>home 0</h1>' },
      { path: '/catalog/3', match: '<h1>catalog 3</h1>' },
    ],
    hmr: { file: 'app/components/base/Item0.vue', text: 'BaseItem0', route: '/' },
    async create (dir) {
      await createLargeApp(dir)
    },
  },
]
