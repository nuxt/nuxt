import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Nuxt, NuxtBuildEnvironment, NuxtBuildEnvironmentResult, NuxtHooks } from '@nuxt/schema'
import { runWithNuxtContext } from '@nuxt/kit'
import webpack from 'webpack'

import '../src/impl.ts'
import { compile } from '../src/webpack.ts'

describe('webpack build report', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nuxt-webpack-report-'))
    await writeFile(join(dir, 'entry.js'), 'console.log(\'hello\')')
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reports each compiler of a production build once its files are written', async () => {
    const hooks = createHooks<NuxtHooks>()
    const nuxt = { options: { dev: false }, hooks, callHook: hooks.callHook.bind(hooks) } as unknown as Nuxt
    const events: Array<{ name: string, environment: NuxtBuildEnvironment, result?: NuxtBuildEnvironmentResult, sizes?: number[] }> = []
    hooks.hook('build:environment:start', (environment) => { events.push({ name: 'start', environment }) })
    hooks.hook('build:environment:done', async (environment, result) => {
      const sizes = await Promise.all(result.files.map(file => stat(join(result.outDir, file.path)).then(stats => stats.size)))
      events.push({ name: 'done', environment, result, sizes })
    })

    for (const name of ['client', 'server']) {
      const compiler = webpack({
        name,
        mode: 'production',
        context: dir,
        entry: './entry.js',
        devtool: 'source-map',
        output: { path: join(dir, 'dist', name), filename: 'app.js' },
      })
      await runWithNuxtContext(nuxt, () => compile(compiler))
    }

    expect(events.map(event => [event.name, event.environment])).toEqual([
      ['start', { name: 'client', consumer: 'client', builder: 'webpack' }],
      ['done', { name: 'client', consumer: 'client', builder: 'webpack' }],
      ['start', { name: 'server', consumer: 'server', builder: 'webpack' }],
      ['done', { name: 'server', consumer: 'server', builder: 'webpack' }],
    ])
    const done = events.find(event => event.name === 'done')!
    expect(done.result!.outDir).toBe(join(dir, 'dist/client'))
    expect(done.result!.files.map(file => file.path).sort()).toEqual(['app.js', 'app.js.map'])
    expect(done.result!.files.map(file => file.size)).toEqual(done.sizes)
  })
})
