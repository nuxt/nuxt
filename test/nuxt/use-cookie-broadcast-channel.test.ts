import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCookie } from '#app/composables/cookie'

vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  cookieStore: false,
}))

describe('useCookie without CookieStore', () => {
  it('should broadcast a cleared cookie without calling `encode`', async () => {
    const encode = vi.fn((value: string) => {
      if (typeof value !== 'string') { throw new TypeError('expected a string') }
      return value
    })
    const scope = effectScope()
    const [writer, reader] = scope.run(() => [
      useCookie<string | null | undefined>('broadcast-cleared', { default: () => 'value', encode }),
      useCookie<string | null | undefined>('broadcast-cleared', { encode }),
    ])!

    expect(reader.value).toBe('value')
    writer.value = null
    await vi.waitFor(() => expect(reader.value).toBeNull())
    writer.value = undefined
    await vi.waitFor(() => expect(reader.value).toBeUndefined())
    expect(encode.mock.calls.every(([value]) => typeof value === 'string')).toBe(true)
    scope.stop()
  })
})
