import { describe, expect, it } from 'vitest'
import { ExtractAsyncDataHandlersPlugin } from '../src/core/plugins/extract-async-data-handlers'
import { clean } from './utils'

describe('extract async data handlers plugin', () => {
  const defaultOptions = {
    enabled: true,
    sourcemap: false,
    rootDir: '/app',
  }

  function createTransform (options = defaultOptions) {
    const plugin = ExtractAsyncDataHandlersPlugin(options).raw({}, { framework: 'rollup' }) as { transform: { handler: (code: string, id: string) => { code: string } | undefined } }
    return (code: string, id = '/app/test.ts') => {
      const result = plugin.transform.handler(code, id)
      return result?.code
    }
  }

  describe('basic functionality', () => {
    it('should not transform when no async data functions are present', async () => {
      const transform = createTransform()
      const code = `
        const data = ref('hello')
        const count = computed(() => data.value.length)
      `
      const result = await transform(code)
      expect(result).toBeUndefined()
    })
  })

  describe('useAsyncData transformation', () => {
    it('should extract simple arrow function handler', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key', async () => {
          return await $fetch('/api/data')
        })
      `
      const result = await transform(code)

      expect(clean(result)).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)
    })

    it('should extract function with external variable references', async () => {
      const transform = createTransform()
      const code = `
        const userId = ref(123)
        const { data } = await useAsyncData('user', async () => {
          return await $fetch(\`/api/users/\${userId.value}\`)
        })
      `
      const result = await transform(code)

      expect(clean(result)).toMatchInlineSnapshot(`
        "const userId = ref(123)
        const { data } = await useAsyncData('user', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)(userId)))"
      `)
    })

    it('should correctly handle variables in scope', async () => {
      const transform = createTransform()
      const code = `
        useAsyncData(async () => {
          const distTags = {}
          return [].map(tag => distTags[tag])
        })
      `
      const result = await transform(code)
      expect(clean(result)).toMatchInlineSnapshot(`"useAsyncData(() => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)
    })

    it('should handle imported functions in handlers', async () => {
      const transform = createTransform()
      const code = `
        import { $fetch } from 'ofetch'
        
        const { data } = await useAsyncData('key', async () => {
          return await $fetch('/api/data')
        })
      `
      const result = await transform(code)

      expect(clean(result)).toMatchInlineSnapshot(`
        "import { $fetch } from 'ofetch'
        const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"
      `)
    })

    it('should handle block statement function bodies', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key', async () => {
          const response = await $fetch('/api/data')
          return response.data
        })
      `
      const result = await transform(code)

      expect(clean(result)).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)(data)))"`)
    })

    it('should handle expression function bodies', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key', async () => $fetch('/api/data'))
      `
      const result = await transform(code)

      expect(clean(result)).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)
    })
  })

  describe('useLazyAsyncData transformation', () => {
    it('should extract useLazyAsyncData handlers', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useLazyAsyncData('key', async () => {
          return await $fetch('/api/data')
        })
      `
      const result = await transform(code)

      expect(clean(result)).toMatchInlineSnapshot(`"const { data } = await useLazyAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)
    })
  })

  describe('edge cases', () => {
    it('should not transform when handler is not a function', async () => {
      const transform = createTransform()
      const code = `
        const handler = async () => $fetch('/api/data')
        const { data } = await useAsyncData('key', handler)
      `
      const result = await transform(code)

      expect(result).toBeUndefined()
    })

    it('should not transform when no handler is provided', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key')
      `
      const result = await transform(code)

      expect(result).toBeUndefined()
    })

    it('should handle multiple useAsyncData calls', async () => {
      const transform = createTransform()
      const code = `
        const { data: users } = await useAsyncData('users', async () => {
          return await $fetch('/api/users')
        })
        
        const { data: posts } = await useAsyncData('posts', async () => {
          return await $fetch('/api/posts')
        })
      `
      const result = await transform(code)

      expect(result).toBeDefined()
      // Should have two import statements
      const importMatches = result!.match(/\(\) => import\(/g)
      expect(importMatches).toHaveLength(2)
    })

    it('should handle Vue SFC script blocks', async () => {
      const transform = createTransform()
      const code = `
        <template>
          <div>{{ data }}</div>
        </template>
        
        <script setup>
        const { data } = await useAsyncData('key', async () => {
          return await $fetch('/api/data')
        })
        </script>
      `
      const result = await transform(code, '/app/test.vue')

      expect(result).toBeDefined()
      expect(result).toContain('() => import(')
    })
  })

  describe('variable scope handling', () => {
    it('should capture variables from outer scope', async () => {
      const transform = createTransform()
      const code = `
        const apiUrl = ref('/api/data')
        const params = { limit: 10 }
        
        const { data } = await useAsyncData('key', async () => {
          return await $fetch(apiUrl.value, { query: params })
        })
      `
      const result = await transform(code)

      expect(result).toBeDefined()
      expect(result).toContain('apiUrl, params')
    })

    it('should not capture variables declared within the function', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key', async () => {
          const localVar = 'local'
          return await $fetch('/api/data', { headers: { 'x-local': localVar } })
        })
      `
      const result = await transform(code)

      expect(result).toBeDefined()
      // Should not pass localVar as parameter since it's declared within the function
      expect(result).not.toContain('localVar')
    })
  })
})
