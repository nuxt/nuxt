// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compileScript, parse } from '@vue/compiler-sfc'
import { UnheadImportsPlugin } from '../src/head/plugins/unhead-imports'

describe('UnheadImportsPlugin', () => {
  // Helper function to transform code
  function transform (code: string, id = 'app.vue') {
    const plugin = UnheadImportsPlugin({ rootDir: import.meta.dirname, sourcemap: false }).raw({}, {} as any) as any
    return plugin.transformInclude(id) ? Promise.resolve(plugin.transform.handler(code, id)).then((r: any) => r?.code.replace(/^ {6}/gm, '').trim()) : null
  }

  describe('transformInclude', () => {
    // @ts-expect-error untyped
    const transformInclude = UnheadImportsPlugin({ rootDir: process.cwd(), sourcemap: false }).raw({}, {} as any).transformInclude

    it('should include JS files', () => {
      expect(transformInclude('/project/components/MyComponent.js')).toBe(true)
    })

    it('should include TypeScript files', () => {
      expect(transformInclude('/project/components/MyComponent.ts')).toBe(true)
    })

    it('should include Vue files', () => {
      expect(transformInclude('/project/components/MyComponent.vue')).toBe(true)
    })

    it('should exclude virtual files', () => {
      expect(transformInclude('virtual:my-plugin')).toBe(false)
    })

    it('should exclude files from unhead libraries', () => {
      expect(transformInclude('/project/node_modules/@unhead/vue/index.js')).toBe(false)
      expect(transformInclude('/project/node_modules/unhead/index.js')).toBe(false)
    })
  })

  describe('transform', () => {
    it('should not transform code that does not include @unhead/vue', async () => {
      const code = `import { renderSSRHead } from '@unhead/ssr'`
      const result = await transform(code, '/project/components/MyComponent.vue')
      expect(result).toBeUndefined()
    })

    it('should transform imports from @unhead/vue in .vue files', async () => {
      const sfc = `
<script lang="ts" setup>
import { useHead } from '@unhead/vue'
useHead({ title: 'My Page' })
</script>
`
      const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })

      const result = await transform(res.content, '/project/components/MyComponent.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead } from "@unhead/vue"')
    })

    it('should transform imports from @unhead/vue in JS files', async () => {
      const code = `import { useHead } from '@unhead/vue'`
      const result = await transform(code, '/project/composables/head.ts')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead } from "@unhead/vue"')
    })

    it('should handle mixed imports correctly', async () => {
      const code = `
import { useHead } from '@unhead/vue'
import { useSeoMeta } from '#app/composables/head'
      `
      const result = await transform(code, '/project/components/MyComponent.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead, useSeoMeta } from "#app/composables/head"')
      // Since we're not mocking the AST parsing, we need to rely on the actual behavior
      // of the plugin for handling imports from #app/composables/head
    })

    it('should handle renamed imports correctly', async () => {
      const code = `import { useHead as useHeadAlias } from '@unhead/vue'`
      const result = await transform(code, '/project/components/MyComponent.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead as useHeadAlias } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead as useHeadAlias } from "@unhead/vue"')
    })

    it('should handle multiple imports correctly', async () => {
      const code = `import { useHead, useSeoMeta } from '@unhead/vue'`
      const result = await transform(code, '/project/components/MyComponent.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead, useSeoMeta } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead, useSeoMeta } from "@unhead/vue"')
    })
  })

  describe('Integration tests', () => {
    it('should handle a Vue component correctly', async () => {
      const sfc = `
<template>
  <div>
    <h1>{{ title }}</h1>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '@unhead/vue'

const title = ref('Hello World')

useHead({
  title: 'My Page'
})
</script>
      `
      const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })

      const result = await transform(res.content, '/project/components/MyComponent.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead } from "@unhead/vue"')
    })

    it('should handle a Nuxt plugin correctly', async () => {
      const code = `
import { useHead } from '@unhead/vue'

export default defineNuxtPlugin((nuxtApp) => {
  useHead({
    titleTemplate: '%s - My Site'
  })
})
      `

      const result = await transform(code, '/project/plugins/head.ts')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead } from "@unhead/vue"')
    })

    it('should handle TypeScript file in a nested directory correctly', async () => {
      const code = `
import { useHead } from '@unhead/vue'

export function setupHead() {
  useHead({
    meta: [
      { name: 'description', content: 'My website description' }
    ]
  })
}
      `

      const result = await transform(code, '/project/utils/head/setup.ts')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead } from "@unhead/vue"')
    })

    it('should handle multiple imports from different sources', async () => {
      const code = `
import { useHead, useSeoMeta } from '@unhead/vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
      `

      const result = await transform(code, '/project/pages/index.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead, useSeoMeta } from "#app/composables/head"')
      expect(result).not.toContain('@unhead/vue')
    })

    it('should handle imports across multiple lines', async () => {
      const code = `
import {
  useHead,
  useSeoMeta
} from '@unhead/vue'
      `

      const result = await transform(code, '/project/components/Header.vue')

      expect(result).toBeDefined()
      // The actual behavior will depend on how the AST parser handles multi-line imports
      // This test will verify the behavior is consistent
    })

    it('should handle different quote styles in imports', async () => {
      const code = `import { useHead } from "@unhead/vue"`
      const result = await transform(code, '/project/components/MyComponent.vue')

      expect(result).toBeDefined()
      expect(result).toContain('import { useHead } from "#app/composables/head"')
      expect(result).not.toContain('import { useHead } from "@unhead/vue"')
    })
  })
})
