import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { createRsbuild } from '@rsbuild/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Nuxt, NuxtBuildEnvironment, NuxtBuildEnvironmentResult, NuxtConfig, NuxtHooks } from '@nuxt/schema'
import { loadNuxt } from '@nuxt/kit'

import { resolveRsbuildConfig } from '../src/config.ts'
import { NuxtHooksPlugin } from '../src/plugins/hooks.ts'

const fixtureDir = join(import.meta.dirname, '../../../test/fixtures/minimal')

describe('rsbuild build report', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nuxt-rsbuild-report-'))
    await writeFile(join(dir, 'entry.js'), 'console.log(\'hello\')')
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reports each environment of a production build once its files are written', async () => {
    const hooks = createHooks<NuxtHooks>()
    const nuxt = { options: { dev: false }, hooks, callHook: hooks.callHook.bind(hooks) } as unknown as Nuxt
    const started = new Map<string, { environment: NuxtBuildEnvironment, at: number }>()
    const done = new Map<string, { result: NuxtBuildEnvironmentResult, at: number, sizes: number[] }>()
    hooks.hook('build:environment:start', (environment) => { started.set(environment.name, { environment, at: performance.now() }) })
    hooks.hook('build:environment:done', async (environment, result) => {
      const at = performance.now()
      const sizes = await Promise.all(result.files.map(file => stat(join(result.outDir, file.path)).then(stats => stats.size)))
      done.set(environment.name, { result, at, sizes })
    })

    const rsbuild = await createRsbuild({
      cwd: dir,
      config: {
        mode: 'production',
        logLevel: 'silent',
        plugins: [NuxtHooksPlugin(nuxt)],
        environments: {
          client: { source: { entry: { app: './entry.js' } }, output: { target: 'web', distPath: { root: 'dist/client' } } },
          ssr: { source: { entry: { server: './entry.js' } }, output: { target: 'node', distPath: { root: 'dist/server' } } },
        },
      },
    })
    const { close } = await rsbuild.build()
    await close()

    expect(started.get('client')!.environment).toEqual({ name: 'client', consumer: 'client', builder: 'rsbuild' })
    expect(started.get('ssr')!.environment).toEqual({ name: 'ssr', consumer: 'server', builder: 'rsbuild' })
    expect(started.get('ssr')!.at).toBeLessThan(done.get('client')!.at)
    expect(started.get('client')!.at).toBeLessThan(done.get('ssr')!.at)

    for (const [name, { result, sizes }] of done) {
      expect(result.outDir).toBe(join(dir, 'dist', name === 'ssr' ? 'server' : 'client'))
      expect(result.files.some(file => file.path.endsWith('.js'))).toBe(true)
      expect(result.files.map(file => file.size)).toEqual(sizes)
    }
  })

  it.each([
    [{ dev: false, logLevel: 'info' }, 'warn', { printFileSize: false }],
    [{ dev: false, logLevel: 'verbose' }, 'warn', { printFileSize: false }],
    [{ dev: false, logLevel: 'silent' }, 'silent', undefined],
    [{ dev: false, logLevel: 'info', rsbuild: { logLevel: 'error' } }, 'error', undefined],
    [{ dev: true, logLevel: 'info' }, 'info', undefined],
  ] satisfies Array<[NuxtConfig, string, unknown]>)('only prints warnings and errors from rsbuild in a production build unless the project sets a level (%j)', async (overrides, logLevel, performance) => {
    const nuxt = await loadNuxt({ cwd: fixtureDir, dev: overrides.dev, ready: false, overrides: { builder: 'rsbuild', ...overrides } })
    try {
      const config = await resolveRsbuildConfig(nuxt)
      expect(config.logLevel).toBe(logLevel)
      expect(config.performance?.printFileSize).toEqual(performance?.printFileSize)
    } finally {
      await nuxt.close()
    }
  }, 60_000)
})
