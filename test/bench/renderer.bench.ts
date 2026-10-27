import { describe, expect, test } from 'vitest'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import { createEvent, options } from '../renderer/harness.ts'

const renderer = createNuxtRenderer(options)

/** Render a failing route as the nitro error handler does, by rendering the error route with the error. */
async function renderError (path: string) {
  const error = await renderer.fetch(createEvent(path)).then(() => undefined, (error: { status: number, statusText: string }) => error)
  if (!error) {
    throw new Error(`Expected ${path} to fail`)
  }
  const event = createEvent(`/__nuxt_error?${new URLSearchParams({ status: String(error.status), statusText: error.statusText, url: path })}`)
  event.context.nuxt = { '~rendering-error': true }
  return renderer.fetch(event)
}

const routes = {
  'minimal page': { render: () => renderer.fetch(createEvent('/')), contains: '<h1>Hello Nuxt</h1>' },
  'page with 300 links': { render: () => renderer.fetch(createEvent('/links')), contains: 'page 298' },
  'catalog page with data, head and 105 components': { render: () => renderer.fetch(createEvent('/catalog')), contains: 'Product 99' },
  'not found error page': { render: () => renderError('/does-not-exist'), contains: '<h1>404</h1>' },
}

describe('server render', () => {
  for (const [name, route] of Object.entries(routes)) {
    test(name, async ({ bench }) => {
      const response = await route.render()
      expect(response.status).toBe(200)
      expect(await response.text()).toContain(route.contains)

      await bench(name, async () => {
        const response = await route.render()
        await response.text()
      }).run()
    })
  }
})
