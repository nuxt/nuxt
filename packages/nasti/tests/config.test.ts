import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { describe, expect, it, vi } from 'vitest'
import { toNastiConfig } from '../src/config.ts'

function createNuxt (overrides: Record<string, any> = {}) {
  return {
    options: {
      rootDir: '/repo',
      srcDir: '/repo/app',
      appDir: '/repo/packages/nuxt/app',
      buildDir: '/repo/.nuxt',
      dev: true,
      logLevel: 'debug',
      dir: {
        assets: 'assets',
      },
      app: {
        baseURL: '/base/',
      },
      alias: {
        '@nuxt-alias': '/repo/nuxt-alias',
      },
      sourcemap: {
        client: true,
        server: false,
      },
      vite: {
        resolve: {
          alias: [{ find: '@vite-alias', replacement: '/repo/vite-alias' }],
          conditions: ['custom-condition'],
          extensions: ['.ts', '.vue'],
        },
        plugins: [
          {
            name: 'vite-plugin',
            transform (code: string) {
              return code
            },
          },
        ],
      },
      ...overrides,
    },
  } as unknown as Nuxt
}

describe('toNastiConfig', () => {
  it('translates Nuxt options into a Nasti config', async () => {
    const config = await toNastiConfig(createNuxt(), {
      serverEntry: '/repo/.nuxt/entry-server.mjs',
    })

    expect(config).toMatchObject({
      root: '/repo',
      base: '/base/',
      mode: 'development',
      framework: 'vue',
      logLevel: 'info',
      build: {
        outDir: '/repo/.nuxt',
        sourcemap: true,
      },
      resolve: {
        conditions: ['custom-condition'],
        extensions: ['.ts', '.vue'],
      },
      environments: {
        client: {
          consumer: 'client',
        },
        ssr: {
          consumer: 'server',
          entry: '/repo/.nuxt/entry-server.mjs',
          build: {
            minify: false,
            sourcemap: false,
            rolldownOptions: {
              output: {
                format: 'es',
              },
            },
          },
        },
      },
    })
    expect(config.resolve?.alias).toMatchObject({
      'assets': '/repo/app/assets',
      '@vite-alias': '/repo/vite-alias',
      '@nuxt-alias': '/repo/nuxt-alias',
      '#app': '/repo/packages/nuxt/app',
    })
    expect(config.plugins?.map(plugin => plugin.name)).toEqual([
      'vite-plugin',
    ])
  })

  it('drops unsupported Vite aliases with a warning', async () => {
    const warn = vi.mocked(logger.warn)
    warn.mockClear()

    const config = await toNastiConfig(
      createNuxt({
        vite: {
          resolve: {
            alias: [
              { find: /^@regexp/, replacement: '/repo/regexp' },
              { find: '@supported', replacement: '/repo/supported' },
            ],
          },
        },
      }),
      { serverEntry: '/repo/.nuxt/entry-server.mjs' },
    )

    expect(config.resolve?.alias).toMatchObject({
      '@supported': '/repo/supported',
    })
    expect(config.resolve?.alias).not.toHaveProperty('/^@regexp/')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 1 unsupported Vite alias entry'),
    )
  })
})
