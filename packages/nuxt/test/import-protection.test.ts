import { describe, expect, it } from 'vitest'
import { ImpoundPlugin } from 'impound'
import { createImportProtectionPatterns } from '../src/core/plugins/import-protection.ts'
import type { NuxtOptions } from '../schema.ts'

const testsToTriggerOn = [
  ['~/nuxt.config', 'app.vue', true],
  ['./nuxt.config', 'app.vue', true],
  ['./nuxt.config.ts', 'app.vue', true],
  ['nuxt.config.ts', 'app.vue', true],
  ['./.nuxt/nuxt.config', 'app.vue', false],
  ['.nuxt/nuxt.config', 'app.vue', false],
  ['nuxt', 'components/Component.vue', true],
  ['nuxt3', 'components/Component.vue', true],
  ['nuxt-nightly', 'components/Component.vue', true],
  ['/root/node_modules/@vue/composition-api', 'components/Component.vue', true],
  ['@vue/composition-api', 'components/Component.vue', true],
  ['@nuxt/kit', 'components/Component.vue', true],
  ['nuxt/config', 'components/Component.vue', true],
  ['nuxt/kit', 'components/Component.vue', true],
  ['nuxt/schema', 'components/Component.vue', true],
  ['/root/node_modules/@nuxt/kit', 'components/Component.vue', true],
  ['@nuxt/cli', 'components/Component.vue', true],
  ['@nuxt/cli-nightly/dist/index.mjs', 'components/Component.vue', true],
  ['/root/node_modules/@nuxt/cli/runtime/dev-close-sockets.mjs', 'components/Component.vue', false],
  ['/root/node_modules/@nuxt/cli-nightly/runtime/dev-close-sockets.mjs', 'components/Component.vue', false],
  ['some-nuxt-module', 'components/Component.vue', true],
  ['some-nuxt-module/runtime/something.vue', 'components/Component.vue', false],
  ['/root/src/server/api/test.ts', 'components/Component.vue', true],
  ['src/server/api/test.ts', 'components/Component.vue', true],
  ['node_modules/nitropack/node_modules/crossws/dist/adapters/bun.mjs', 'node_modules/nitropack/dist/presets/bun/runtime/bun.mjs', false],
  ['nitro/builder', 'components/Component.vue', true],
  ['nitro/meta', 'components/Component.vue', true],
  ['nitro/vite', 'components/Component.vue', true],
  ['nitro/h3', 'components/Component.vue', false],
  ['nitro/app', 'components/Component.vue', false],
  ['nitro/runtime-config', 'components/Component.vue', false],
  ['nitro/types', 'components/Component.vue', false],
  ['nitro', 'components/Component.vue', false],
  ['node_modules/some-pkg/server/api/helper.ts', 'components/Component.vue', false],
  ['nuxt/server', 'components/Component.vue', true],
  ['nuxt/internal/server-app-config', 'components/Component.vue', true],
  ['nuxt/app', 'components/Component.vue', false],
] as const

const nitroAppTests: [id: string, importer: string, isProtected: boolean][] = [
  ['#app', 'server/api/foo.ts', true],
  ['#build/utils', 'server/api/foo.ts', true],
  ['~/utils/foo', 'server/api/bar.ts', true],
  ['@/composables/bar', 'server/api/bar.ts', true],
  ['~~/src/utils/baz', 'server/api/bar.ts', true],
  ['@@/src/composables/qux', 'server/api/bar.ts', true],
  ['src/composables/foo', 'server/api/bar.ts', true],
  ['../../src/utils/helper', '/root/server/api/bar.ts', true],
  ['~~/shared/utils', 'server/api/bar.ts', false],
  ['nitro/h3', 'server/api/bar.ts', false],
]

const nuxtAppRelativeServerTests: [id: string, importer: string, isProtected: boolean][] = [
  ['src/server/api/foo.ts', 'components/bar.vue', true],
  ['../server/api/foo', '/root/src/components/bar.vue', true],
]

const nuxtAppAliasToServerTests: [id: string, importer: string, isProtected: boolean][] = [
  ['#api/foo', 'components/bar.vue', true],
]

describe('import protection', () => {
  it.each(testsToTriggerOn)('should protect %s (nuxt-app)', async (id, importer, isProtected) => {
    const result = await transformWithImportProtection(id, importer, 'nuxt-app')
    if (!isProtected) {
      expect(result).toBeFalsy()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
  })

  it('should deny `nuxt/server` in app and shared code, and allow it on the server', async () => {
    for (const context of ['nuxt-app', 'shared'] as const) {
      const errors: string[] = []
      await transformWithImportProtection('nuxt/server', 'components/Component.vue', context, errors)
      expect(errors.join('\n'), context).toContain('`nuxt/server` cannot be imported in')
    }

    expect(await transformWithImportProtection('nuxt/server', 'server/api/hello.ts', 'nitro-app')).toBeFalsy()
  })

  it.each(nitroAppTests)('nitro-app: %s from %s -> %s', async (id, importer, isProtected) => {
    const result = await transformWithImportProtection(id, importer, 'nitro-app')
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
  })

  it.each(nuxtAppRelativeServerTests)('nuxt-app server import: %s from %s -> %s', async (id, importer, isProtected) => {
    const result = await transformWithImportProtection(id, importer, 'nuxt-app')
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
  })

  // Separate setup: we need a custom alias (#api -> server) that modules might add at runtime.
  it.each(nuxtAppAliasToServerTests)('nuxt-app alias to server: %s -> %s', async (id, importer, isProtected) => {
    const plugin = ImpoundPlugin.rollup({
      cwd: '/root',
      patterns: createImportProtectionPatterns({
        options: {
          ...defaultNuxtOptions,
          alias: {
            ...defaultNuxtOptions.alias,
            '#api': '/root/src/server/api',
          },
        } as NuxtOptions,
      }, { context: 'nuxt-app' }),
    })
    const result = (plugin as any).resolveId.call({ error: () => {} }, id, importer)
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
  })
})

const defaultNuxtOptions = {
  _installedModules: [
    // @ts-expect-error an incomplete module
    { entryPath: 'some-nuxt-module' },
  ],
  rootDir: '/root',
  srcDir: '/root/src/',
  serverDir: '/root/src/server',
  alias: {
    '~': '/root/src/',
    '@': '/root/src/',
    '~~': '/root/',
    '@@': '/root/',
  },
} satisfies Partial<NuxtOptions> as NuxtOptions

const transformWithImportProtection = (id: string, importer: string, context: 'nitro-app' | 'nuxt-app' | 'shared', errors: string[] = []) => {
  const plugin = ImpoundPlugin.rollup({
    cwd: '/root',
    patterns: createImportProtectionPatterns({
      options: defaultNuxtOptions,
    }, { context }),
  })

  return (plugin as any).resolveId.call({ error: (error: unknown) => { errors.push(String((error as { message?: string })?.message ?? error)) } }, id, importer)
}
