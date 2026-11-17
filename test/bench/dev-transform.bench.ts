import { afterAll, beforeAll, describe, test } from 'vitest'
import { join } from 'pathe'
import type { DevEnvironment, ViteDevServer } from 'vite'
import type { Nuxt } from 'nuxt/schema'
import { build, loadNuxt } from 'nuxt'
import { largeAppDir } from './large-app.ts'

const files = [
  'app/app.vue',
  'app/layouts/default.vue',
  'app/pages/index.vue',
  'app/pages/catalog/[id].vue',
  'app/components/forms/Item3.vue',
  'app/composables/counter-1.ts',
  'app/plugins/00.plugin-0.ts',
  'app/middleware/catalog-guard.ts',
]

describe('dev server transform', () => {
  let nuxt: Nuxt
  let server: ViteDevServer
  const ids = files.map(file => join(largeAppDir, file))

  beforeAll(async () => {
    nuxt = await loadNuxt({
      cwd: largeAppDir,
      dev: true,
      ready: true,
      overrides: {
        dev: true,
        buildDir: join(largeAppDir, 'node_modules/dev-transform/.nuxt'),
        vite: {
          optimizeDeps: { noDiscovery: true, include: [] },
        },
      },
    })
    nuxt.hook('vite:extendConfig', (config) => {
      for (const environment of Object.values(config.environments || {})) {
        environment.optimizeDeps = { noDiscovery: true, include: [] }
      }
    })
    nuxt.hook('vite:serverCreated', (created) => { server = created })
    await build(nuxt)
  })

  afterAll(() => nuxt?.close())

  async function transformAll (environment: DevEnvironment) {
    for (const id of ids) {
      const mod = environment.moduleGraph.getModuleById(id)
      if (mod) {
        environment.moduleGraph.invalidateModule(mod)
      }
      await environment.transformRequest(id)
    }
  }

  for (const name of ['client', 'ssr']) {
    test(`transform ${files.length} app files (${name})`, async ({ bench }) => {
      const environment = server.environments[name]!
      // requesting a module would otherwise also transform everything it imports
      Object.assign(environment.config.dev, { preTransformRequests: false })
      await transformAll(environment)

      await bench(`transform ${files.length} app files (${name})`, () => transformAll(environment)).run()
    })
  }
})
