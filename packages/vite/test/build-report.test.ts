import { statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import type { NuxtBuildEnvironment, NuxtBuildEnvironmentResult, NuxtConfig } from '@nuxt/schema'

import { buildFixture, writeFiles } from './utils.ts'

const tmpDir = fileURLToPath(new URL('./.tmp/build-report', import.meta.url))

interface ReportedEnvironment {
  environment: NuxtBuildEnvironment
  startedAt: number
  doneAt?: number
  result?: NuxtBuildEnvironmentResult
  sizesOnDisk?: number[]
}

async function build (overrides: NuxtConfig) {
  await writeFiles(tmpDir, { 'app/app.vue': '<template><div>hello</div></template>' })
  const reported = new Map<string, ReportedEnvironment>()
  const logLevels: Array<string | undefined> = []
  await buildFixture(tmpDir, {
    ...overrides,
    vite: {
      ...overrides.vite,
      plugins: [{
        name: 'test:log-level',
        configResolved (config) { logLevels.push(config.logLevel) },
      }],
    },
  }, (nuxt) => {
    nuxt.hook('build:environment:start', (environment) => {
      reported.set(environment.name, { environment, startedAt: performance.now() })
    })
    nuxt.hook('build:environment:done', (environment, result) => {
      const entry = reported.get(environment.name)!
      entry.doneAt = performance.now()
      entry.result = result
      entry.sizesOnDisk = result.files.map(file => statSync(join(result.outDir, file.path)).size)
    })
  })
  return { reported, logLevels }
}

describe('build report', () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('reports the client and server bundles built concurrently as overlapping', async () => {
    const { reported, logLevels } = await build({ logLevel: 'info', experimental: { parallelBuild: true } })

    const client = reported.get('client')!
    const ssr = reported.get('ssr')!
    expect(client.environment).toEqual({ name: 'client', consumer: 'client', builder: 'vite' })
    expect(ssr.environment).toEqual({ name: 'ssr', consumer: 'server', builder: 'vite' })
    expect(ssr.startedAt).toBeLessThan(client.doneAt!)
    expect(client.startedAt).toBeLessThan(ssr.doneAt!)

    for (const { result, sizesOnDisk } of reported.values()) {
      expect(result!.files.length).toBeGreaterThan(0)
      expect(result!.files.map(file => file.size)).toEqual(sizesOnDisk)
    }
    expect(reported.get('client')!.result!.files.some(file => file.path.endsWith('.js'))).toBe(true)

    expect(new Set(logLevels)).toEqual(new Set(['warn']))
  }, 240 * 1000)

  it('reports bundles built one after the other, and keeps a log level set by the project', async () => {
    const { reported, logLevels } = await build({ logLevel: 'info', experimental: { parallelBuild: false }, vite: { logLevel: 'error' } })

    const client = reported.get('client')!
    const ssr = reported.get('ssr')!
    expect(client.doneAt).toBeLessThanOrEqual(ssr.startedAt)
    expect(new Set(logLevels)).toEqual(new Set(['error']))
  }, 240 * 1000)
})
