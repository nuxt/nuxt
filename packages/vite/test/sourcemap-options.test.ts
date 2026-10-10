import { describe, expect, it, vi } from 'vitest'
import type { Nuxt } from 'nuxt/schema'

import { clientEnvironment } from '../src/shared/client.ts'
import { ssrEnvironment } from '../src/shared/server.ts'

vi.mock('@nuxt/kit/internal', () => ({
  useServerBuild: () => ({ buildsSeparately: true }),
}))
vi.mock('../src/utils/transpile.ts', () => ({
  getTranspileStrings: () => [],
}))

type SourcemapOption = boolean | 'hidden' | 'nosource'

function createNuxt (sourcemap: { client: SourcemapOption, server: SourcemapOption }) {
  return {
    options: {
      dev: false,
      rootDir: '/project',
      buildDir: '/project/.nuxt',
      envName: 'production',
      dir: { shared: 'shared' },
      build: { transpile: [] },
      experimental: {},
      vite: { mode: 'production', build: {} },
      sourcemap,
    },
  } as unknown as Nuxt
}

describe('vite sourcemap options', () => {
  it.each([true, false, 'hidden'] as const)('passes `%s` through and includes sources', (value) => {
    const nuxt = createNuxt({ client: value, server: value })

    const client = clientEnvironment(nuxt, 'entry.js').build
    expect(client.sourcemap).toBe(value)
    expect(client.rolldownOptions).not.toHaveProperty('output')

    const server = ssrEnvironment(nuxt, 'server.js').build
    expect(server.sourcemap).toBe(value)
    expect(server.rolldownOptions.output.sourcemapExcludeSources).toBe(false)
  })

  it('generates sourcemaps without sources for `nosource`', () => {
    const nuxt = createNuxt({ client: 'nosource', server: 'nosource' })

    const client = clientEnvironment(nuxt, 'entry.js').build
    expect(client.sourcemap).toBe(true)
    expect(client.rolldownOptions).toHaveProperty('output.sourcemapExcludeSources', true)

    const server = ssrEnvironment(nuxt, 'server.js').build
    expect(server.sourcemap).toBe(true)
    expect(server.rolldownOptions.output.sourcemapExcludeSources).toBe(true)
  })
})
