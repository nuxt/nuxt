import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from 'playwright-core'
import { createLargeApp } from '../../test/bench/large-app.ts'

export interface Interaction {
  name: string
  run: (page: Page) => Promise<unknown>
  /** Serialised and polled in the page every frame after the first input event, until it returns `true`. */
  done: () => boolean
}

export interface Fixture {
  id: string
  description: string
  /** Routes requested by the `dev` and `render` suites, each with a string the response must contain. */
  routes: { path: string, match: string }[]
  /** Component edited by the `hmr` suite, relative to the fixture, and the text it renders. */
  hmr?: { file: string, text: string, route: string }
  /** Interactions performed in order by the `browser` suite on the first route. */
  interactions?: Interaction[]
  /** Suites that use this fixture unless `--fixture` is passed. Defaults to all suites. */
  suites?: string[]
  create: (dir: string) => Promise<void>
}

const uiFixture = fileURLToPath(new URL('../fixtures/ui', import.meta.url))

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
  {
    id: 'ui',
    description: 'Nuxt UI landing page and blog index with ~690 component instances',
    routes: [
      { path: '/', match: 'Ship beautiful products faster' },
      { path: '/blog', match: 'Introducing Acme 2.0' },
    ],
    hmr: { file: 'app/pages/index.vue', text: 'Ship beautiful products faster', route: '/' },
    interactions: [
      {
        name: 'open accordion item',
        run: page => page.locator('[data-slot="trigger"]').nth(1).click(),
        done: () => document.querySelectorAll('[data-slot="trigger"]')[1]?.getAttribute('aria-expanded') === 'true',
      },
      {
        name: 'close accordion item',
        run: page => page.locator('[data-slot="trigger"]').nth(1).click(),
        done: () => document.querySelectorAll('[data-slot="trigger"]')[1]?.getAttribute('aria-expanded') === 'false',
      },
      {
        name: 'switch to dark mode',
        run: page => page.locator('button[aria-label^="Switch to"]').first().click(),
        done: () => document.documentElement.classList.contains('dark'),
      },
      {
        name: 'switch to light mode',
        run: page => page.locator('button[aria-label^="Switch to"]').first().click(),
        done: () => !document.documentElement.classList.contains('dark'),
      },
      {
        name: 'open mobile menu',
        run: page => page.locator('button[aria-label="Open menu"]').click(),
        done: () => !!document.querySelector('[role="dialog"] a[href="/blog"]'),
      },
      {
        name: 'navigate to `/blog`',
        run: page => page.locator('[role="dialog"] a[href="/blog"]').click(),
        done: () => document.querySelector('h1')?.textContent?.trim() === 'Blog' && document.querySelectorAll('article').length >= 12,
      },
      {
        name: 'type in newsletter input',
        run: page => page.locator('input[type="email"]').press('a'),
        done: () => document.querySelector<HTMLInputElement>('input[type="email"]')?.value === 'a',
      },
      {
        name: 'navigate to `/`',
        run: page => page.locator('header a[href="/"]').first().click(),
        done: () => !!document.querySelector('h1')?.textContent?.includes('Ship beautiful products') && document.querySelectorAll('[data-slot="trigger"]').length >= 6,
      },
    ],
    suites: ['client', 'browser'],
    async create (dir) {
      await rm(dir, { recursive: true, force: true })
      await cp(uiFixture, dir, { recursive: true })
    },
  },
]
