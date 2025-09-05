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
    const plugin = ExtractAsyncDataHandlersPlugin(options).raw({}, { framework: 'rollup' }) as {
      load: (id: string) => { code: string } | undefined
      transform: { handler: (code: string, id: string) => { code: string } | undefined }
    }
    const fn = (code: string, id = '/app/test.ts') => {
      const result = plugin.transform.handler(code, id)
      return result?.code ? clean(result.code) : result?.code
    }
    return Object.assign(fn, { load: (id: string) => clean(plugin.load(id)?.code) || undefined })
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
      expect(transform.load('/app/async-data-chunk-0.js')).toBeUndefined()
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

      expect(result).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `
        "export default async function () { 
                  return await $fetch('/api/data')
                 }"
      `,
      )
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

      expect(result).toMatchInlineSnapshot(`
        "const userId = ref(123)
        const { data } = await useAsyncData('user', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)(userId)))"
      `)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `
        "export default async function (userId) { 
                  return await $fetch(\`/api/users/\${userId.value}\`)
                 }"
      `,
      )
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
      expect(result).toMatchInlineSnapshot(`"useAsyncData(() => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `
        "export default async function () { 
                  const distTags = {}
                  return [].map(tag => distTags[tag])
                 }"
      `,
      )
    })

    it('should correctly handle auto-imported functions in scope', async () => {
      const transform = createTransform()
      const code = `
        const { data: page } = await useAsyncData(() => queryCollection('landing').path('/enterprise/jobs').first())
      `
      const result = await transform(code)
      expect(result).toMatchInlineSnapshot(
        `"const { data: page } = await useAsyncData(() => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`,
      )
      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `"export default async function () { return queryCollection('landing').path('/enterprise/jobs').first() }"`,
      )
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

      expect(result).toMatchInlineSnapshot(`
        "import { $fetch } from 'ofetch'
        const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"
      `)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `
        "import { $fetch } from 'ofetch'
        export default async function () { 
                  return await $fetch('/api/data')
                 }"
      `,
      )
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

      expect(result).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)(data)))"`)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `
        "export default async function (data) { 
                  const response = await $fetch('/api/data')
                  return response.data
                 }"
      `,
      )
    })

    it('should handle expression function bodies', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key', async () => $fetch('/api/data'))
      `
      const result = await transform(code)

      expect(result).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `"export default async function () { return $fetch('/api/data') }"`,
      )
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

      expect(result).toMatchInlineSnapshot(`"const { data } = await useLazyAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(
        `
        "export default async function () { 
                  return await $fetch('/api/data')
                 }"
      `,
      )
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
      expect(transform.load('/app/async-data-chunk-0.js')).toBeUndefined()
    })

    it('should not transform when no handler is provided', async () => {
      const transform = createTransform()
      const code = `
        const { data } = await useAsyncData('key')
      `
      const result = await transform(code)

      expect(result).toBeUndefined()
      expect(transform.load('/app/async-data-chunk-0.js')).toBeUndefined()
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

      expect(result).toMatchInlineSnapshot(`
        "const { data: users } = await useAsyncData('users', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))
        const { data: posts } = await useAsyncData('posts', () => import('/app/async-data-chunk-1.js').then(r => (r.default || r)()))"
      `)
      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(`
        "export default async function () { 
                  return await $fetch('/api/users')
                 }"
      `)
      expect(transform.load('/app/async-data-chunk-1.js')).toMatchInlineSnapshot(`
        "export default async function () { 
                  return await $fetch('/api/posts')
                 }"
      `)
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

      expect(result).toMatchInlineSnapshot(`
        "const apiUrl = ref('/api/data')
        const params = { limit: 10 }
        const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)(apiUrl, params)))"
      `)

      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(`
        "export default async function (apiUrl, params) { 
                  return await $fetch(apiUrl.value, { query: params })
                 }"
      `)
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

      expect(result).toMatchInlineSnapshot(`"const { data } = await useAsyncData('key', () => import('/app/async-data-chunk-0.js').then(r => (r.default || r)()))"`)
      expect(transform.load('/app/async-data-chunk-0.js')).toMatchInlineSnapshot(`
        "export default async function () { 
                  const localVar = 'local'
                  return await $fetch('/api/data', { headers: { 'x-local': localVar } })
                 }"
      `)
    })
  })
})
