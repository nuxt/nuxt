import { describe, expect, it, vi } from 'vitest'
import { unheadDedupePlugin } from '../src/unhead.ts'

describe('unheadDedupePlugin', () => {
  const plugin = unheadDedupePlugin('/nuxt/app')

  it('resolves `unhead` and its subpaths ahead of other resolvers', () => {
    const { filter, order } = plugin.resolveId
    expect(order).toBe('pre')
    for (const id of ['unhead', 'unhead/server', 'unhead/stream/server']) {
      expect(filter.id.test(id)).toBe(true)
    }
    for (const id of ['unhead-extra', '@unhead/vue', 'my-unhead/server']) {
      expect(filter.id.test(id)).toBe(false)
    }
  })

  it('resolves from the nuxt app directory', async () => {
    const resolve = vi.fn((id: string) => Promise.resolve({ id: `/nuxt/node_modules/${id}.mjs` }))
    const options = { kind: 'import-statement' }

    expect(await plugin.resolveId.handler.call({ resolve }, 'unhead/server', '/project/node_modules/dep/index.mjs', options)).toEqual({ id: '/nuxt/node_modules/unhead/server.mjs' })
    expect(resolve).toHaveBeenCalledWith('unhead/server', '/nuxt/app/index.js', { kind: 'import-statement', skipSelf: true })
  })

  it('leaves entries to the default resolution', async () => {
    const resolve = vi.fn()

    expect(await plugin.resolveId.handler.call({ resolve }, 'unhead', undefined, {})).toBeUndefined()
    expect(resolve).not.toHaveBeenCalled()
  })
})
