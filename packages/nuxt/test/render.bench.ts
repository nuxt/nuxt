import { fileURLToPath } from 'node:url'
import { beforeAll, bench, describe, expect } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { build, loadNuxt } from 'nuxt'
import { x } from 'tinyexec'

const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/basic', import.meta.url))))
const outputDir = fileURLToPath(new URL('../../../node_modules/.test/render-benchmark', import.meta.url))

describe('render', () => {
  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: basicTestFixtureDir,
      ready: true,
      overrides: {
        nitro: {
          output: {
            dir: outputDir,
          },
        },
        sourcemap: false,
      },
    })
    nuxt.hook('nitro:build:before', (nitro) => {
      nitro.options.entry = fileURLToPath(new URL('./nitro/render-index', import.meta.url))
    })
    await build(nuxt)
    await nuxt.close()
  }, 100_000)

  bench('index route in the basic test fixture', async () => {
    const res = await x('node', [join(outputDir, 'server/index.mjs')], {
      nodeOptions: { stdio: 'pipe' },
    })
    expect(res.stdout).toContain('Hello Nuxt 3!')
  })
})
