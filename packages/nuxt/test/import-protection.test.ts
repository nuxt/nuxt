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
  ['~/server/utils/helper', 'server/api/bar.ts', false],
  ['nitro/h3', 'server/api/bar.ts', false],
  ['srvx/node', 'node_modules/h3/dist/_entries/node.mjs', false],
  ['srvx', 'node_modules/h3/dist/something.mjs', false],
  ['~/server-utils/foo', 'server/api/bar.ts', true],
  // Custom alias to server-utils (not serverDir) - resolves outside srcDir, not protected
  ['~~/shared/server-utils/helper', 'server/api/bar.ts', false],
]

const nuxtAppRelativeServerTests: [id: string, importer: string, isProtected: boolean][] = [
  ['src/server/api/foo.ts', 'components/bar.vue', true],
  ['../server/api/foo', '/root/src/components/bar.vue', true],
]

const nuxtAppAliasToServerTests: [id: string, importer: string, isProtected: boolean][] = [
  ['#api/foo', 'components/bar.vue', true],
  // Custom alias to server-utils (not serverDir) - should NOT be treated as server import
  ['~~/shared/server-utils/helper', 'components/bar.vue', false],
]

describe('import protection', () => {
  it.each(testsToTriggerOn)('should protect %s (nuxt-app)', async (id, importer, isProtected) => {
    const result = await transformWithImportProtection(id, importer, 'nuxt-app')
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
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

  it('nitro-app with custom serverDir: ~/backend/ allowed when serverDir is backend', async () => {
    const customOptions = {
      ...defaultNuxtOptions,
      serverDir: '/root/src/backend',
    } as NuxtOptions
    const plugin = ImpoundPlugin.rollup({
      cwd: '/root',
      patterns: createImportProtectionPatterns({ options: customOptions }, { context: 'nitro-app' }),
    })
    const result = (plugin as any).resolveId.call({ error: () => {} }, '~/backend/utils/helper', 'backend/api/bar.ts')
    expect(result).toBeNull()
  })

  it('nitro-app with custom serverDir: ~/server-utils/ still protected (sibling of serverDir)', async () => {
    const customOptions = {
      ...defaultNuxtOptions,
      serverDir: '/root/src/backend',
    } as NuxtOptions
    const plugin = ImpoundPlugin.rollup({
      cwd: '/root',
      patterns: createImportProtectionPatterns({ options: customOptions }, { context: 'nitro-app' }),
    })
    const result = (plugin as any).resolveId.call({ error: () => {} }, '~/server-utils/foo', 'backend/api/bar.ts')
    expect(result).toBeDefined()
    expect(result).toContain('impound:proxy')
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

const transformWithImportProtection = (id: string, importer: string, context: 'nitro-app' | 'nuxt-app' | 'shared') => {
  const plugin = ImpoundPlugin.rollup({
    cwd: '/root',
    patterns: createImportProtectionPatterns({
      options: defaultNuxtOptions,
    }, { context }),
  })

  return (plugin as any).resolveId.call({ error: () => {} }, id, importer)
}
