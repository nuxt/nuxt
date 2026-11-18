import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { BuildEnvironment, Plugin, ViteBuilder } from 'vite'
import { waitForClientBuild } from '@nuxt/kit/internal'

import { ParallelBuildPlugin } from '../src/plugins/parallel-build.ts'
import { buildFixture, writeFiles } from './utils.ts'

const tmpDir = fileURLToPath(new URL('./.tmp/parallel-build', import.meta.url))

function environment (name: string) {
  return { name, isBuilt: false, config: { build: { rolldownOptions: { input: 'entry' } } } } as unknown as BuildEnvironment
}

function buildApp (plugin: Plugin) {
  const hook = plugin.buildApp as { handler: (builder: ViteBuilder) => Promise<void> }
  return hook.handler
}

describe('parallel build', () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it.each([true, false])('should start the server build before the client build finishes only when `experimental.parallelBuild` is enabled (%s)', async (parallelBuild) => {
    await writeFiles(tmpDir, { 'app/app.vue': '<template><div>hello</div></template>' })
    let clientBuilt = false
    let ssrStartedBeforeClientBuilt = false
    await buildFixture(tmpDir, {
      experimental: { parallelBuild },
      vite: {
        plugins: [{
          name: 'test:build-order',
          buildStart () {
            if (this.environment.name === 'ssr') {
              ssrStartedBeforeClientBuilt = !clientBuilt
            }
          },
          writeBundle () {
            if (this.environment.name === 'client') {
              clientBuilt = true
            }
          },
        }],
      },
    })
    expect(ssrStartedBeforeClientBuilt).toBe(parallelBuild)
  }, 240 * 1000)

  it('should wait for the client build to settle before rejecting with a server build error', async () => {
    const nuxt = {} as Nuxt
    let finishClient!: () => void
    let clientSettled = false
    const client = environment('client')
    const ssr = environment('ssr')
    let ssrStartedWhileClientPending = false
    const builder = {
      environments: { client, ssr },
      build: (env: BuildEnvironment) => {
        if (env === client) {
          return new Promise<void>((resolve) => { finishClient = () => { clientSettled = true; resolve() } })
        }
        ssrStartedWhileClientPending = !clientSettled
        return Promise.reject(new Error('ssr failed'))
      },
    } as unknown as ViteBuilder

    let settledBeforeReject: boolean | undefined
    const result = buildApp(ParallelBuildPlugin(nuxt))(builder).catch((error) => {
      settledBeforeReject = clientSettled
      throw error
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(ssrStartedWhileClientPending).toBe(true)
    expect(settledBeforeReject).toBeUndefined()

    finishClient()
    await expect(result).rejects.toThrow('ssr failed')
    expect(settledBeforeReject).toBe(true)
    expect(nuxt._clientBuild).toBeUndefined()
  })

  it('should reject server build waiters with a client build error', async () => {
    const nuxt = {} as Nuxt
    const client = environment('client')
    const ssr = environment('ssr')
    const error = new Error('client failed')
    let ssrBuild: Promise<void> | undefined
    const builder = {
      environments: { client, ssr },
      build: (env: BuildEnvironment) => env === client ? Promise.reject(error) : (ssrBuild = waitForClientBuild(nuxt)),
    } as unknown as ViteBuilder

    await expect(buildApp(ParallelBuildPlugin(nuxt))(builder)).rejects.toBe(error)
    await expect(ssrBuild).rejects.toBe(error)
    expect(nuxt._clientBuild).toBeUndefined()
  })
})
