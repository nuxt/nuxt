import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { EnvironmentsPlugin } from './environments'

describe('EnvironmentsPlugin', () => {
  describe('optimizeDeps.include configuration in serial mode', () => {
    it('should preserve optimizeDeps.include when the server config has no ssr key', () => {
      // the serial client build must not receive `ssr` options — see buildClient
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      // @ts-expect-error - config is an ObjectHook
      plugin.config({})

      const clientConfig: any = {
        optimizeDeps: {
          include: ['test-dep', 'another-dep'],
        },
      }

      // @ts-expect-error - configEnvironment is an ObjectHook
      plugin.configEnvironment('client', clientConfig)

      expect(clientConfig.optimizeDeps.include).toEqual(['test-dep', 'another-dep'])
    })

    it('should clear optimizeDeps.include on every environment when the server config has ssr', () => {
      // the serial SSR build passes `ssr` options in its inline config; every
      // environment inside that server (including the compat client env) must
      // not run user-provided optimizeDeps.include
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      // @ts-expect-error - config is an ObjectHook
      plugin.config({ ssr: { noExternal: ['dayjs'] } })

      const clientConfig: any = {
        optimizeDeps: { include: ['client-dep'] },
      }
      const ssrConfig: any = {
        optimizeDeps: { include: ['ssr-dep'] },
      }

      // @ts-expect-error - configEnvironment is an ObjectHook
      plugin.configEnvironment('client', clientConfig)
      // @ts-expect-error - configEnvironment is an ObjectHook
      plugin.configEnvironment('ssr', ssrConfig)

      expect(clientConfig.optimizeDeps.include).toBeUndefined()
      expect(ssrConfig.optimizeDeps.include).toBeUndefined()
    })

    it('should initialize optimizeDeps if not present when clearing', () => {
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      // @ts-expect-error - config is an ObjectHook
      plugin.config({ ssr: {} })

      const ssrConfig: any = {}

      // @ts-expect-error - configEnvironment is an ObjectHook
      plugin.configEnvironment('ssr', ssrConfig)

      expect(ssrConfig.optimizeDeps).toBeDefined()
      expect(ssrConfig.optimizeDeps.include).toBeUndefined()
    })

    it('should NOT modify optimizeDeps when viteEnvironmentApi is enabled', () => {
      const mockNuxt = createMockNuxt({ viteEnvironmentApi: true })
      const plugin = EnvironmentsPlugin(mockNuxt)

      // @ts-expect-error - config is an ObjectHook
      plugin.config({ ssr: { noExternal: ['dayjs'] } })

      const ssrConfig: any = {
        optimizeDeps: {
          include: ['test-dep'],
        },
      }

      // @ts-expect-error - configEnvironment is an ObjectHook
      plugin.configEnvironment('ssr', ssrConfig)

      expect(ssrConfig.optimizeDeps.include).toEqual(['test-dep'])
    })
  })
})

function createMockNuxt (experimentalOptions: { viteEnvironmentApi?: boolean } = {}): Nuxt {
  return {
    options: {
      dev: true,
      experimental: {
        viteEnvironmentApi: experimentalOptions.viteEnvironmentApi ?? false,
      },
      app: {
        buildAssetsDir: '_nuxt',
      },
      buildDir: '.nuxt',
      rootDir: '/test',
    },
  } as any as Nuxt
}
