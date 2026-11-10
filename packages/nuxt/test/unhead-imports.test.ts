// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compileScript, parse } from '@vue/compiler-sfc'
import { UnheadImportsPlugin } from '../src/head/plugins/unhead-imports.ts'
import { matchesIdFilter } from './utils.ts'

describe('UnheadImportsPlugin', () => {
  const plugin = UnheadImportsPlugin({ rootDir: import.meta.dirname }).raw({}, {} as any) as any

  async function transform (code: string, id = '/project/components/MyComponent.vue'): Promise<string | undefined> {
    return (await plugin.transform.handler(code, id))?.code.trim()
  }

  it.each([
    ['/project/components/MyComponent.js', true],
    ['/project/components/MyComponent.ts', true],
    ['/project/components/MyComponent.vue', true],
    ['/project/node_modules/nuxt/dist/head/plugin.js', true],
    ['/project/node_modules/nuxt/dist/app/composables.js', true],
    ['virtual:my-plugin', false],
    ['/project/node_modules/@unhead/vue/index.js', false],
    ['/project/node_modules/unhead/index.js', false],
    ['/project/node_modules/nuxt/dist/head/runtime/composables.js', false],
    ['C:\\project\\node_modules\\nuxt\\dist\\head\\runtime\\composables.js', false],
  ])('should match %s: %s', (id, included) => {
    expect(matchesIdFilter(plugin.transform.filter.id, id)).toBe(included)
  })

  it('should not transform code that does not import from @unhead/vue', async () => {
    expect(await transform(`import { renderSSRHead } from '@unhead/ssr'`)).toBeUndefined()
  })

  it.each([
    ['a single import', `import { useHead } from '@unhead/vue'`, 'import { useHead } from "#app/composables/head"'],
    ['double quotes', `import { useHead } from "@unhead/vue"`, 'import { useHead } from "#app/composables/head"'],
    ['renamed imports', `import { useHead as useHeadAlias } from '@unhead/vue'`, 'import { useHead as useHeadAlias } from "#app/composables/head"'],
    ['multiple imports across lines', `import {\n  useHead,\n  useSeoMeta\n} from '@unhead/vue'\nimport { ref } from 'vue'`, 'import { useHead, useSeoMeta } from "#app/composables/head"'],
    ['imports merged with #app/composables/head', `import { useHead } from '@unhead/vue'\nimport { useSeoMeta } from '#app/composables/head'`, 'import { useHead, useSeoMeta } from "#app/composables/head"'],
  ])('should rewrite %s from @unhead/vue', async (_, code, expected) => {
    const result = await transform(code, '/project/plugins/head.ts')
    expect(result).toContain(expected)
    expect(result).not.toContain('@unhead/vue')
  })

  it('should keep imports from @unhead/vue that are not composables', async () => {
    const result = await transform(`import { useHead, createHead } from '@unhead/vue'`)
    expect(result).toContain('import { useHead } from "#app/composables/head"')
    expect(result).toContain('import { createHead } from "@unhead/vue"')
  })

  it('should rewrite imports in a compiled SFC', async () => {
    const sfc = `<script lang="ts" setup>\nimport { useHead } from '@unhead/vue'\nuseHead({ title: 'My Page' })\n</script>`
    const result = await transform(compileScript(parse(sfc).descriptor, { id: 'component.vue' }).content)
    expect(result).toContain('import { useHead } from "#app/composables/head"')
    expect(result).not.toContain('@unhead/vue')
  })
})
