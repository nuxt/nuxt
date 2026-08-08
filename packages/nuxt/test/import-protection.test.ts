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
  // All server subdirectories should be protected (not just api/routes/middleware/plugins)
  ['src/server/utils/helper.ts', 'components/Component.vue', true],
  ['/root/src/server/utils/secret.ts', 'components/Component.vue', true],
  ['/root/src/server/services/db.ts', 'components/Component.vue', true],
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

describe('import protection', () => {
  it.each(testsToTriggerOn)('should protect %s', async (id, importer, isProtected) => {
    const result = await transformWithImportProtection(id, importer, 'nuxt-app')
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
  })
})

const transformWithImportProtection = (id: string, importer: string, context: 'nitro-app' | 'nuxt-app' | 'shared') => {
  const plugin = ImpoundPlugin.rollup({
    cwd: '/root',
    patterns: createImportProtectionPatterns({
      options: {
        _installedModules: [
          // @ts-expect-error an incomplete module
          { entryPath: 'some-nuxt-module' },
        ],
        rootDir: '/root',
        srcDir: '/root/src/',
        serverDir: '/root/src/server',
      } satisfies Partial<NuxtOptions> as NuxtOptions,
    }, { context }),
  })

  return (plugin as any).resolveId.call({ error: () => {} }, id, importer)
}

// Nuxt 4 structure: srcDir = app/, server is sibling of srcDir
const transformWithImportProtectionNuxt4 = (id: string, importer: string, context: 'nitro-app' | 'nuxt-app' | 'shared') => {
  const plugin = ImpoundPlugin.rollup({
    cwd: '/root',
    patterns: createImportProtectionPatterns({
      options: {
        _installedModules: [
          // @ts-expect-error an incomplete module
          { entryPath: 'some-nuxt-module' },
        ],
        rootDir: '/root/',
        srcDir: '/root/app/',
        serverDir: '/root/server',
      } satisfies Partial<NuxtOptions> as NuxtOptions,
    }, { context }),
  })

  return (plugin as any).resolveId.call({ error: () => {} }, id, importer)
}

const testsToTriggerOnNuxt4 = [
  ['~/nuxt.config', 'app.vue', true],
  ['./nuxt.config', 'app.vue', true],
  ['./nuxt.config.ts', 'app.vue', true],
  ['nuxt.config.ts', 'app.vue', true],
  ['./.nuxt/nuxt.config', 'app.vue', false],
  ['.nuxt/nuxt.config', 'app.vue', false],
  ['nuxt', 'app/components/Component.vue', true],
  ['nuxt3', 'app/components/Component.vue', true],
  ['nuxt-nightly', 'app/components/Component.vue', true],
  ['/root/node_modules/@vue/composition-api', 'app/components/Component.vue', true],
  ['@vue/composition-api', 'app/components/Component.vue', true],
  ['@nuxt/kit', 'app/components/Component.vue', true],
  ['nuxt/config', 'app/components/Component.vue', true],
  ['nuxt/kit', 'app/components/Component.vue', true],
  ['nuxt/schema', 'app/components/Component.vue', true],
  ['/root/node_modules/@nuxt/kit', 'app/components/Component.vue', true],
  ['some-nuxt-module', 'app/components/Component.vue', true],
  ['some-nuxt-module/runtime/something.vue', 'app/components/Component.vue', false],
  ['/root/server/api/test.ts', 'app/components/Component.vue', true],
  ['server/api/test.ts', 'app/components/Component.vue', true],
  ['server/utils/helper.ts', 'app/components/Component.vue', true],
  ['/root/server/utils/secret.ts', 'app/components/Component.vue', true],
  ['/root/server/services/db.ts', 'app/components/Component.vue', true],
  ['server/middleware/auth.ts', 'app/composables/useAuth.ts', true],
  ['server/plugins/database.ts', 'app/pages/index.vue', true],
  ['server/routes/health.ts', 'app/layouts/default.vue', true],
  ['node_modules/nitropack/node_modules/crossws/dist/adapters/bun.mjs', 'node_modules/nitropack/dist/presets/bun/runtime/bun.mjs', false],
  ['app/utils/helper.ts', 'app/pages/index.vue', false],
  ['app/composables/useState.ts', 'app/components/Component.vue', false],
  ['shared/types.ts', 'app/components/Component.vue', false],
  ['shared/utils/format.ts', 'app/pages/index.vue', false],
] as const

describe('import protection (Nuxt 4 structure)', () => {
  it.each(testsToTriggerOnNuxt4)('should protect %s', async (id, importer, isProtected) => {
    const result = await transformWithImportProtectionNuxt4(id, importer, 'nuxt-app')
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(result).toContain('impound:proxy')
    }
  })
})
