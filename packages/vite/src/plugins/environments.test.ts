import { describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { EnvironmentsPlugin } from './environments'
import type * as kit from '@nuxt/kit'

// Mock useNitro to return a minimal nitro instance
vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual<typeof kit>('@nuxt/kit')
  return {
    ...actual,
    useNitro: vi.fn(() => ({
      options: {
        output: {
          publicDir: '/test/public',
        },
      },
    })),
  }
})

describe('EnvironmentsPlugin', () => {
  describe('optimizeDeps.include configuration', () => {
    it('should preserve optimizeDeps.include for client environment', () => {
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      const clientConfig = {
        optimizeDeps: {
          include: ['test-dep', 'another-dep'],
        },
      }

      // Call configEnvironment for client
      // @ts-expect-error - configEnvironment is a function in our implementation
      plugin.configEnvironment('client', clientConfig)

      // Should NOT unset include for client environment
      expect(clientConfig.optimizeDeps.include).toEqual(['test-dep', 'another-dep'])
    })

    it('should unset optimizeDeps.include for SSR environment', () => {
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      const ssrConfig: any = {
        optimizeDeps: {
          include: ['test-dep', 'another-dep'],
        },
      }

      // Call configEnvironment for SSR
      // @ts-expect-error - configEnvironment is a function in our implementation
      plugin.configEnvironment('ssr', ssrConfig)

      // Should unset include for SSR environment
      expect(ssrConfig.optimizeDeps.include).toBeUndefined()
      expect(ssrConfig.optimizeDeps).toEqual({ include: undefined })
    })

    it('should initialize optimizeDeps if not present when unsetting for SSR', () => {
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      const ssrConfig: any = {}

      // Call configEnvironment for SSR
      // @ts-expect-error - configEnvironment is a function in our implementation
      plugin.configEnvironment('ssr', ssrConfig)

      // Should initialize optimizeDeps and set include to undefined
      expect(ssrConfig.optimizeDeps).toBeDefined()
      expect(ssrConfig.optimizeDeps.include).toBeUndefined()
    })

    it('should NOT modify optimizeDeps when viteEnvironmentApi is enabled', () => {
      const mockNuxt = createMockNuxt({ viteEnvironmentApi: true })
      const plugin = EnvironmentsPlugin(mockNuxt)

      const ssrConfig: any = {
        optimizeDeps: {
          include: ['test-dep'],
        },
      }

      // Call configEnvironment for SSR with experimental flag enabled
      // @ts-expect-error - configEnvironment is a function in our implementation
      plugin.configEnvironment('ssr', ssrConfig)

      // Should NOT modify when experimental flag is on
      expect(ssrConfig.optimizeDeps.include).toEqual(['test-dep'])
    })

    it('should handle multiple environment configurations independently', () => {
      const mockNuxt = createMockNuxt()
      const plugin = EnvironmentsPlugin(mockNuxt)

      const clientConfig: any = {
        optimizeDeps: { include: ['client-dep'] },
      }
      const ssrConfig: any = {
        optimizeDeps: { include: ['ssr-dep'] },
      }

      // Configure both environments
      // @ts-expect-error - configEnvironment is a function in our implementation
      plugin.configEnvironment('client', clientConfig)
      // @ts-expect-error - configEnvironment is a function in our implementation
      plugin.configEnvironment('ssr', ssrConfig)

      // Client should be preserved, SSR should be unset
      expect(clientConfig.optimizeDeps.include).toEqual(['client-dep'])
      expect(ssrConfig.optimizeDeps.include).toBeUndefined()
    })
  })
})

/**
 * Creates a mock Nuxt instance with minimal required properties
 */
function createMockNuxt (experimentalOptions: { viteEnvironmentApi?: boolean } = {}): Nuxt {
  return {
    options: {
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
