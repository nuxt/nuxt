import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { loadNuxt } from '../src'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./worker-auto-imports-fixture', import.meta.url))))

describe('addVitePlugin worker option', () => {
  let config: ViteConfig

  beforeAll(async () => {
    const nuxt = await loadNuxt({ cwd: fixtureDir })
    config = {}
    await nuxt.callHook('vite:extend', { nuxt, entry: '', config } as any)
    await nuxt.close()
  })

  const workerPlugins = () => (config.worker?.plugins?.() ?? []) as VitePlugin[]
  const mainPlugins = () => (config.plugins ?? []) as VitePlugin[]

  it('registers worker-enabled plugins on `worker.plugins`', () => {
    expect(workerPlugins().map(p => p.name)).toEqual(
      expect.arrayContaining(['test:worker-prepended', 'test:worker-appended']),
    )
  })

  it('omits plugins that did not opt in to `worker: true`', () => {
    expect(workerPlugins().map(p => p.name)).not.toContain('test:not-on-worker')
  })

  it('respects `prepend` order on `worker.plugins`', () => {
    const names = workerPlugins().map(p => p.name)
    expect(names.indexOf('test:worker-prepended')).toBeLessThan(names.indexOf('test:worker-appended'))
  })

  it('still appends worker-enabled plugins to the main `config.plugins`', () => {
    expect(mainPlugins().map(p => p.name)).toEqual(
      expect.arrayContaining(['test:worker-prepended', 'test:worker-appended', 'test:not-on-worker']),
    )
  })
})
