import { describe, expect, it } from 'vitest'
import { resolveConfig } from 'vite'
import type { InlineConfig } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { EnvironmentsPlugin } from '../src/plugins/environments.ts'

const nuxt = {
  options: {
    dev: true,
    buildDir: '/fixture/.nuxt',
    app: { buildAssetsDir: '/_nuxt/' },
    experimental: { viteEnvironmentApi: false },
  },
} as unknown as Nuxt

async function resolveOptimizeDepsInclude (config: InlineConfig) {
  const resolved = await resolveConfig({
    configFile: false,
    root: '/fixture',
    logLevel: 'silent',
    ...config,
    optimizeDeps: { include: ['dep'] },
    plugins: [EnvironmentsPlugin(nuxt)],
  }, 'serve')
  return {
    client: resolved.environments.client!.optimizeDeps.include,
    ssr: resolved.environments.ssr!.optimizeDeps.include,
  }
}

describe('environments plugin (serial builds)', () => {
  it('keeps `optimizeDeps.include` in the client build when the user sets top-level `ssr`', async () => {
    const include = await resolveOptimizeDepsInclude({ ssr: { noExternal: ['dep'] } })
    expect(include.client).toEqual(['dep'])
  })

  it('clears `optimizeDeps.include` in the server build', async () => {
    const include = await resolveOptimizeDepsInclude({ ssr: { noExternal: ['dep'] }, build: { ssr: true } })
    expect(include.client).toEqual([])
    expect(include.ssr).toEqual([])
  })
})
