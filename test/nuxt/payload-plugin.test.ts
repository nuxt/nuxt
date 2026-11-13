/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useNuxtApp, useRuntimeConfig } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import payloadPlugin from '#app/plugins/payload.client'

vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
  purgeCachedData: true,
}))

function mockPayloads (payloads: Record<string, Record<string, string>>) {
  const buildId = useRuntimeConfig().app.buildId
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace(/\/_payload\.json$/, '')
    const entries = Object.entries(payloads[path] ?? {})
    const flat: unknown[] = [{ data: 1, buildId: 2 }, {}, buildId]
    for (const [key, value] of entries) {
      (flat[1] as Record<string, number>)[key] = flat.push(value) - 1
    }
    return Promise.resolve(new Response(JSON.stringify(flat)))
  })
}

describe('static payload data', () => {
  beforeAll(() => {
    const nuxtApp = useNuxtApp()
    nuxtApp.runWithContext(() => payloadPlugin.setup!(nuxtApp))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await useRouter().push('/')
    useNuxtApp().static.data = {}
  })

  it('should purge keys named after inherited object properties', async () => {
    mockPayloads({ '/pre/first': { constructor: 'value' }, '/pre/second': { other: 'value' } })
    const router = useRouter()

    await router.push('/pre/first')
    expect(useNuxtApp().static.data.constructor).toBe('value')

    await router.push('/pre/second')
    expect(Object.hasOwn(useNuxtApp().static.data, 'constructor')).toBe(false)
  })
})
