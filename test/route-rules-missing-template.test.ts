import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { builder, isDev } from './matrix'

const fixtureDir = fileURLToPath(new URL('./fixtures/minimal-pages', import.meta.url))
const buildDir = join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8))

await setup({
  rootDir: fixtureDir,
  dev: isDev,
  server: true,
  browser: false,
  nuxtConfig: {
    buildDir: isDev ? buildDir : undefined,
    routeRules: {
      '/swr': { swr: 60 },
      '/isr': { isr: 60 },
    },
  },
})

describe.skipIf(builder !== 'vite' || !isDev)('route-rules template materialization', () => {
  it('starts app and writes expected templates to disk', async () => {
    const { status } = await fetch('/')
    expect(status).toBe(200)

    expect(existsSync(join(buildDir, 'app.config.mjs'))).toBe(true)
    expect(existsSync(join(buildDir, 'route-rules.mjs'))).toBe(true)
  })
})
