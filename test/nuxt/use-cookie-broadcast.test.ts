/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

vi.mock('#build/nuxt.config.mjs', async original => ({
  ...await original<Record<string, unknown>>(),
  cookieStore: false,
}))

function nextBroadcast (name: string) {
  return new Promise<void>((resolve) => {
    const probe = new BroadcastChannel(`nuxt:cookies:${name}`)
    probe.onmessage = () => {
      probe.close()
      setTimeout(resolve, 10)
    }
  })
}

describe('useCookie without cookieStore', () => {
  let scope: EffectScope

  afterEach(() => scope?.stop())

  it('keeps the value of a write that is not visible to the current document', async () => {
    scope = effectScope()
    const cookie = scope.run(() => useCookie('broadcast-scoped', { path: '/elsewhere' }))!

    const broadcast = nextBroadcast('broadcast-scoped')
    cookie.value = 'written'
    await nextTick()
    await broadcast

    expect(document.cookie).not.toContain('broadcast-scoped=')
    expect(cookie.value).toBe('written')
  })

  it('syncs a write that is not visible to the current document to other refs', async () => {
    scope = effectScope()
    const [writer, reader] = scope.run(() => [
      useCookie('broadcast-scoped-sync', { path: '/elsewhere' }),
      useCookie('broadcast-scoped-sync', { path: '/elsewhere' }),
    ])!

    const broadcast = nextBroadcast('broadcast-scoped-sync')
    writer.value = 'written'
    await nextTick()
    await broadcast

    expect(reader.value).toBe('written')
  })
})
