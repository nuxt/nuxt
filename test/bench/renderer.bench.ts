import { describe, expect, test } from 'vitest'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import { createEvent, options } from '../renderer/harness.ts'

const renderer = createNuxtRenderer(options)

const routes = {
  'minimal page': { path: '/', status: 200, contains: '<h1>Hello Nuxt</h1>' },
  'page with 300 links': { path: '/links', status: 200, contains: 'page 298' },
  'catalog page with data, head and 105 components': { path: '/catalog', status: 200, contains: 'Product 99' },
  'not found error page': { path: '/does-not-exist', status: 404, contains: '<h1>404</h1>' },
}

describe('server render', () => {
  for (const [name, route] of Object.entries(routes)) {
    test(name, async ({ bench }) => {
      const response = await renderer.fetch(createEvent(route.path))
      expect(response.status).toBe(route.status)
      expect(await response.text()).toContain(route.contains)

      await bench(name, async () => {
        const response = await renderer.fetch(createEvent(route.path))
        await response.text()
      }).run()
    })
  }
})
