import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { BuildEnvironment, ViteBuilder } from 'vite'

import { BuildEnvironmentsPlugin } from '../src/document.ts'

function createNuxt (options: { ssr: boolean, parallelBuild: boolean, rendererPlugins?: boolean }) {
  return {
    options: {
      ssr: options.ssr,
      experimental: { parallelBuild: options.parallelBuild },
      _rendererPlugins: options.rendererPlugins ? [{ src: 'plugin' }] : [],
    },
  } as unknown as Nuxt
}

async function buildApp (nuxt: Nuxt) {
  const environments = {
    client: { name: 'client', isBuilt: false },
    ssr: { name: 'ssr', isBuilt: false },
  } as unknown as Record<string, BuildEnvironment>
  const events: string[] = []
  const builder = {
    environments,
    async build (environment: BuildEnvironment) {
      events.push(`start:${environment.name}:${nuxt._clientBuild ? 'concurrent' : 'alone'}`)
      await new Promise(resolve => setTimeout(resolve, 5))
      events.push(`end:${environment.name}`)
      environment.isBuilt = true
    },
  } as unknown as ViteBuilder
  const hook = BuildEnvironmentsPlugin(nuxt).buildApp as { handler: (builder: ViteBuilder) => Promise<void> }
  await hook.handler(builder)
  return events
}

describe('build environments', () => {
  it('should build the client and ssr environments concurrently with `experimental.parallelBuild`', async () => {
    const nuxt = createNuxt({ ssr: true, parallelBuild: true })

    expect(await buildApp(nuxt)).toEqual(['start:client:alone', 'start:ssr:concurrent', 'end:client', 'end:ssr'])
    expect(nuxt._clientBuild).toBeUndefined()
  })

  it('should build the client environment before the ssr environment without `experimental.parallelBuild`', async () => {
    expect(await buildApp(createNuxt({ ssr: true, parallelBuild: false }))).toEqual(['start:client:alone', 'end:client', 'start:ssr:alone', 'end:ssr'])
  })

  it('should build the ssr environment before the client environment that renders the SPA document with it', async () => {
    expect(await buildApp(createNuxt({ ssr: false, parallelBuild: true, rendererPlugins: true }))).toEqual(['start:ssr:alone', 'end:ssr', 'start:client:alone', 'end:client'])
  })

  it('should only build the client environment when nothing renders on the server', async () => {
    expect(await buildApp(createNuxt({ ssr: false, parallelBuild: true }))).toEqual(['start:client:alone', 'end:client'])
  })
})
