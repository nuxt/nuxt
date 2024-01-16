import { normalize } from 'pathe'
import { describe, expect, it } from 'vitest'
import { ImportProtectionPlugin, nuxtImportProtections } from '../src/core/plugins/import-protection'
import type { NuxtOptions } from '../schema'

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
  ['/root/src/server/api/test.ts', 'components/Component.vue', true],
  ['src/server/api/test.ts', 'components/Component.vue', true]
] as const

describe('import protection', () => {
  it.each(testsToTriggerOn)('should protect %s', async (id, importer, isProtected) => {
    const result = await transformWithImportProtection(id, importer)
    if (!isProtected) {
      expect(result).toBeNull()
    } else {
      expect(result).toBeDefined()
      expect(normalize(result)).contains('unenv/runtime/mock/proxy')
    }
  })
})

const transformWithImportProtection = (id: string, importer: string) => {
  const plugin = ImportProtectionPlugin.rollup({
    rootDir: '/root',
    patterns: nuxtImportProtections({
      options: {
        modules: ['some-nuxt-module'],
        srcDir: '/root/src/',
        serverDir: '/root/src/server'
      } satisfies Partial<NuxtOptions> as NuxtOptions
    })
  })

  return (plugin as any).resolveId(id, importer)
}
