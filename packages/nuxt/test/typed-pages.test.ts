import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it, onTestFinished } from 'vitest'
import { buildNuxt } from '@nuxt/kit'
import { loadNuxt } from '../src/index.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

describe('typed pages', () => {
  it('generates typed-router.d.ts from a single page scan when preparing', async () => {
    const buildDir = mkdtempSync(join(tmpdir(), 'nuxt-typed-pages-'))
    onTestFinished(() => rmSync(buildDir, { recursive: true, force: true }))

    let pagesExtendCalls = 0
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        _prepare: true,
        buildDir,
        experimental: { typedPages: true },
        modules: [
          (_options, nuxt) => {
            nuxt.hook('pages:extend', (pages) => {
              pagesExtendCalls++
              pages.push({ name: 'from-module', path: '/from-module', file: join(pagesFixtureDir, 'pages/index.vue') })
            })
          },
        ],
      },
    })
    onTestFinished(() => nuxt.close())

    // `nuxt prepare` and `nuxt build` clear the build dir after modules are set up
    rmSync(buildDir, { recursive: true, force: true })
    await buildNuxt(nuxt)

    const dts = readFileSync(join(buildDir, 'types/typed-router.d.ts'), 'utf8')
    expect(dts).toContain(`'/'`)
    expect(dts).toContain(`'from-module'`)
    expect(pagesExtendCalls).toBe(1)
  })
})
