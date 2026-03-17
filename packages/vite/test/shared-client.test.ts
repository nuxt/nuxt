import { describe, expect, it, vi } from 'vitest'
import { clientEnvironment } from '../src/shared/client.ts'

vi.mock('../src/utils/transpile.ts', () => ({
  getTranspileStrings: () => [],
}))

describe('clientEnvironment', () => {
  it('explicitly excludes route-rules virtual module from optimizer', () => {
    const nuxt = {
      options: {
        dev: false,
        buildDir: '.nuxt',
        sourcemap: { client: false },
        vite: { mode: 'test', build: {} },
        experimental: { clientNodeCompat: false },
      },
    } as any

    const env = clientEnvironment(nuxt, '/entry.mjs')

    expect(env.optimizeDeps.exclude).toContain('#build/route-rules.mjs')
    expect(env.optimizeDeps.exclude).toContain('#app-manifest')
  })
})
