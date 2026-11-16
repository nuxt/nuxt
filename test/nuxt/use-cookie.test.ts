/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

const MAX_TIMEOUT_DELAY = 2_147_483_647

describe('useCookie', () => {
  it('should watch custom cookie refs', () => {
    const user = useCookie('userInfo', {
      default: () => ({ score: -1 }),
      maxAge: 60 * 60,
    })
    const computedVal = computed(() => user.value.score)
    expect(computedVal.value).toBe(-1)
    user.value.score++
    expect(computedVal.value).toBe(0)
  })

  it('should not re-read `document.cookie` for every call', async () => {
    document.cookie = 'read-count-a=1'
    document.cookie = 'read-count-b=2'

    let target: any = document
    let descriptor: PropertyDescriptor | undefined
    while (target && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(target, 'cookie')
      if (!descriptor) { target = Object.getPrototypeOf(target) }
    }

    let reads = 0
    let writes = 0
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get () {
        reads++
        return descriptor!.get!.call(document)
      },
      set (value) {
        writes++
        descriptor!.set!.call(document, value)
      },
    })

    try {
      for (let i = 0; i < 10; i++) {
        useCookie('read-count-a')
        useCookie('read-count-b')
        useCookie('read-count-absent-' + i)
      }
      expect(reads).toBe(1)
      expect(writes).toBe(0)

      for (let i = 0; i < 10; i++) {
        useCookie('read-count-default', { default: () => 'value' })
      }
      expect(reads).toBe(1)
      expect(writes).toBe(1)

      useCookie('read-count-scoped', { default: () => 'value', domain: 'example.com' })
      useCookie('read-count-a')
      expect(reads).toBe(2)

      await nextTick()
      useCookie('read-count-a')
      expect(reads).toBe(3)
    } finally {
      delete (document as any).cookie
    }
  })

  it('should invalidate the cached cookie jar after a write', async () => {
    const cookie = useCookie<string>('invalidate-me', { default: () => 'initial' })
    expect(useCookie<string>('invalidate-me').value).toBe('initial')

    cookie.value = 'updated'
    await nextTick()
    expect(useCookie<string>('invalidate-me').value).toBe('updated')
  })

  it('should not read a cookie excluded by `filter`', () => {
    document.cookie = 'filtered-out=set'

    let decodeCallCount = 0
    const cookie = useCookie<string>('filtered-out', {
      default: () => 'default',
      filter: () => false,
      decode (value) {
        decodeCallCount++
        return value
      },
    })
    expect(cookie.value).toBe('default')
    expect(decodeCallCount).toBe(0)
  })

  it('cookie decode function should be invoked once', () => {
    // Pre-set cookies
    document.cookie = 'foo=Foo'
    document.cookie = 'bar=%7B%22s2%22%3A0%7D'
    document.cookie = 'baz=%7B%22s2%22%3A0%7D'

    let barCallCount = 0
    const bazCookie = useCookie<{ s2: number }>('baz', {
      default: () => ({ s2: -1 }),
      decode (value) {
        barCallCount++
        return JSON.parse(decodeURIComponent(value))
      },
    })
    bazCookie.value.s2++
    expect(bazCookie.value.s2).toEqual(1)
    expect(barCallCount).toBe(1)

    let quxCallCount = 0
    const quxCookie = useCookie<{ s3: number }>('qux', {
      default: () => ({ s3: -1 }),
      filter: key => key === 'bar' || key === 'baz',
      decode (value) {
        quxCallCount++
        return JSON.parse(decodeURIComponent(value))
      },
    })
    quxCookie.value.s3++
    expect(quxCookie.value.s3).toBe(0)
    expect(quxCallCount).toBe(0)
  })

  it('should not watch custom cookie refs when shallow', () => {
    for (const value of ['shallow', false] as const) {
      const user = useCookie('shallowUserInfo', {
        ...legacyCookieSerializer,
        default: () => ({ score: -1 }),
        maxAge: 60 * 60,
        watch: value,
      })
      const computedVal = computed(() => user.value.score)
      expect(computedVal.value).toBe(-1)
      user.value.score++
      expect(computedVal.value).toBe(-1)
    }
  })

  it('should set cookie value when called on client', () => {
    useCookie('cookie-watch-false', { default: () => 'foo', watch: false })
    expect(document.cookie).toContain('cookie-watch-false=foo')

    useCookie('cookie-watch-true', { default: () => 'foo', watch: true })
    expect(document.cookie).toContain('cookie-watch-true=foo')
  })

  it('should not write a readonly cookie with a default value on client', () => {
    const cookie = useCookie('cookie-readonly', { default: () => 'foo', readonly: true })
    expect(cookie.value).toBe('foo')
    expect(document.cookie).not.toContain('cookie-readonly')
  })

  it('should re-write cookie on same-value assignment when refresh is true', async () => {
    const { nextTick } = await import('vue')

    document.cookie = 'refresh-test=initial; Max-Age=3600'
    const cookie = useCookie('refresh-test', {
      maxAge: 3600,
      refresh: true,
    })
    expect(cookie.value).toBe('initial')

    // Assign the same value — should still trigger a cookie write
    cookie.value = 'initial'
    await nextTick()

    expect(document.cookie).toContain('refresh-test=initial')
  })

  it('should not re-write CookieStore updates when refresh is true', async () => {
    const name = 'refresh-cookiestore-test'
    const scope = effectScope()
    const cookie = scope.run(() => useCookie(name, { maxAge: 3600, refresh: true }))!

    let target: any = document
    let descriptor: PropertyDescriptor | undefined
    while (target && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(target, 'cookie')
      if (!descriptor) { target = Object.getPrototypeOf(target) }
    }

    const writes: string[] = []
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get () {
        return descriptor!.get!.call(document)
      },
      set (value: string) {
        if (value.startsWith(`${name}=`)) { writes.push(value) }
        descriptor!.set!.call(document, value)
      },
    })

    try {
      cookieStore.dispatchEvent(new window.CookieChangeEvent('change', { changed: [{ name, value: 'received' }], deleted: [] }))
      expect(cookie.value).toBe('received')
      await nextTick()
      await nextTick()
      expect(writes).toEqual([])

      const value = cookie.value
      cookie.value = value
      await nextTick()
      expect(writes).toHaveLength(1)
      expect(writes[0]).toContain(`${name}=received`)

      cookie.value = 'disposed'
      scope.stop()
      expect(writes).toHaveLength(2)
      expect(writes[1]).toContain(`${name}=disposed`)
    } finally {
      scope.stop()
      delete (document as any).cookie
    }
  })

  it('should write an assignment made straight after a CookieStore update when refresh is true', async () => {
    const name = 'refresh-cookiestore-assign-test'
    const scope = effectScope()
    const cookie = scope.run(() => useCookie(name, { maxAge: 3600, refresh: true }))!

    cookieStore.dispatchEvent(new window.CookieChangeEvent('change', { changed: [{ name, value: 'received' }], deleted: [] }))
    await nextTick()
    cookie.value = 'local'
    for (let i = 0; i < 4; i++) { await nextTick() }
    expect(document.cookie).toContain(`${name}=local`)

    scope.stop()
  })

  it('should not re-write cookie on same-value assignment when refresh is false', async () => {
    const { nextTick } = await import('vue')

    document.cookie = 'no-refresh-test=original'
    const cookie = useCookie('no-refresh-test', {
      maxAge: 3600,
      refresh: false,
    })
    expect(cookie.value).toBe('original')

    // Clear document.cookie to detect if a write happens
    document.cookie = 'no-refresh-test=; Max-Age=0'
    expect(document.cookie).not.toContain('no-refresh-test=original')

    // Assign the same value — should NOT trigger a cookie write
    cookie.value = 'original'
    await nextTick()

    expect(document.cookie).not.toContain('no-refresh-test=original')
  })

  it('should never write a readonly cookie, even when refresh is true', async () => {
    const { nextTick } = await import('vue')

    document.cookie = 'readonly-refresh-test=original'
    const cookie = useCookie('readonly-refresh-test', {
      maxAge: 3600,
      readonly: true,
      refresh: true,
    })
    expect(cookie.value).toBe('original')

    // Clear document.cookie to detect if a write happens
    document.cookie = 'readonly-refresh-test=; Max-Age=0'
    expect(document.cookie).not.toContain('readonly-refresh-test=original')

    ;(cookie as any).value = 'stray-write'
    expect(cookie.value).toBe('stray-write')
    await nextTick()

    expect(document.cookie).not.toContain('readonly-refresh-test=stray-write')
  })

  it('should re-evaluate expires getter on each cookie write', async () => {
    const { nextTick } = await import('vue')
    let callCount = 0
    const cookie = useCookie('expires-getter', {
      expires: () => {
        callCount++
        return new Date(Date.now() + 60_000)
      },
    })

    // Initial write of default/undefined may or may not happen; start from a known count
    const baseline = callCount
    cookie.value = 'first'
    await nextTick()
    expect(callCount).toBeGreaterThan(baseline)

    const afterFirst = callCount
    cookie.value = 'second'
    await nextTick()
    expect(callCount).toBeGreaterThan(afterFirst)
    expect(document.cookie).toContain('expires-getter=second')
  })

  it('should re-evaluate expires getter on same-value assignment when refresh is true', async () => {
    const { nextTick } = await import('vue')
    let callCount = 0
    document.cookie = 'expires-refresh=token'
    const cookie = useCookie('expires-refresh', {
      refresh: true,
      expires: () => {
        callCount++
        return new Date(Date.now() + 60_000)
      },
    })
    expect(cookie.value).toBe('token')

    document.cookie = 'expires-refresh=; Max-Age=0'
    expect(document.cookie).not.toContain('expires-refresh=token')

    const baseline = callCount
    cookie.value = 'token'
    await nextTick()
    expect(callCount).toBeGreaterThan(baseline)
    expect(document.cookie).toContain('expires-refresh=token')
  })

  it('should support a static Date for expires without a getter', async () => {
    const { nextTick } = await import('vue')
    const cookie = useCookie('expires-static', {
      expires: new Date(Date.now() + 60_000),
    })
    cookie.value = 'static-value'
    await nextTick()
    expect(document.cookie).toContain('expires-static=static-value')
  })

  it('should not treat an expires getter returning undefined as expired', () => {
    const cookie = useCookie('expires-undefined-getter', {
      default: () => 'fallback',
      expires: () => undefined,
    })
    expect(cookie.value).toBe('fallback')
  })

  it('should keep session cookies without expires or maxAge as plain refs', async () => {
    const { nextTick } = await import('vue')
    vi.useFakeTimers()
    try {
      const cookie = useCookie('session-no-expiry', {
        default: () => 'session',
      })
      cookie.value = 'session'
      await nextTick()
      expect(cookie.value).toBe('session')

      vi.advanceTimersByTime(60_000)
      expect(cookie.value).toBe('session')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useCookie expiration timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should expire cookie ref after maxAge elapses', () => {
    const maxAge = 60 // 60 seconds
    const cookie = useCookie('expire-short', {
      default: () => 'value',
      maxAge,
    })

    expect(cookie.value).toBe('value')

    // Setting the cookie starts the expiration timeout
    cookie.value = 'updated'
    expect(cookie.value).toBe('updated')

    // Advance time just before expiration
    vi.advanceTimersByTime(maxAge * 1000 - 1)
    expect(cookie.value).toBe('updated')

    // Advance past expiration
    vi.advanceTimersByTime(1)
    expect(cookie.value).toBeUndefined()
  })

  it('should expire cookie ref when maxAge exceeds MAX_TIMEOUT_DELAY', () => {
    // 30 days in seconds — exceeds MAX_TIMEOUT_DELAY (~24.8 days in ms)
    const maxAge = 30 * 24 * 60 * 60
    const delayMs = maxAge * 1000

    // Sanity check: this delay requires chunked timeouts
    expect(delayMs).toBeGreaterThan(MAX_TIMEOUT_DELAY)

    const cookie = useCookie('expire-long', {
      default: () => 'long-lived',
      maxAge,
    })

    // Trigger the expiration timeout by setting a value
    cookie.value = 'long-lived'
    expect(cookie.value).toBe('long-lived')

    // Advance past one MAX_TIMEOUT_DELAY chunk — should still be alive
    vi.advanceTimersByTime(MAX_TIMEOUT_DELAY)
    expect(cookie.value).toBe('long-lived')

    // Advance remaining time minus 1ms
    const remaining = delayMs - MAX_TIMEOUT_DELAY
    vi.advanceTimersByTime(remaining - 1)
    expect(cookie.value).toBe('long-lived')

    // Final millisecond triggers expiration
    vi.advanceTimersByTime(1)
    expect(cookie.value).toBeUndefined()
  })

  it('should expire cookie ref when maxAge requires more than two timeout chunks', () => {
    // 60 days in seconds — requires 3 chunks
    const maxAge = 60 * 24 * 60 * 60
    const delayMs = maxAge * 1000

    expect(delayMs).toBeGreaterThan(MAX_TIMEOUT_DELAY * 2)

    const cookie = useCookie('expire-very-long', {
      default: () => 'value',
      maxAge,
    })

    cookie.value = 'value'
    expect(cookie.value).toBe('value')

    // Advance through first two chunks
    vi.advanceTimersByTime(MAX_TIMEOUT_DELAY)
    expect(cookie.value).toBe('value')

    vi.advanceTimersByTime(MAX_TIMEOUT_DELAY)
    expect(cookie.value).toBe('value')

    // Advance remaining time
    const remaining = delayMs - MAX_TIMEOUT_DELAY * 2
    vi.advanceTimersByTime(remaining)
    expect(cookie.value).toBeUndefined()
  })

  it('should reset expiration when cookie value is re-set', () => {
    const maxAge = 60
    const cookie = useCookie('expire-reset', {
      default: () => 'initial',
      maxAge,
    })

    cookie.value = 'first'

    // Advance halfway
    vi.advanceTimersByTime(maxAge * 1000 / 2)
    expect(cookie.value).toBe('first')

    // Re-set the value — this should reset the expiration timer
    cookie.value = 'second'

    // Advance to what would have been the original expiration
    vi.advanceTimersByTime(maxAge * 1000 / 2)
    expect(cookie.value).toBe('second')

    // Advance the remaining half — now it should expire
    vi.advanceTimersByTime(maxAge * 1000 / 2)
    expect(cookie.value).toBeUndefined()
  })

  it('should be reactive when cookie expires', () => {
    const maxAge = 10
    const cookie = useCookie('expire-reactive', {
      default: () => 'tracked',
      maxAge,
    })

    cookie.value = 'tracked'
    const derived = computed(() => cookie.value ?? 'expired')
    expect(derived.value).toBe('tracked')

    vi.advanceTimersByTime(maxAge * 1000)
    expect(derived.value).toBe('expired')
  })

  it('should reset expiration when expires getter is re-evaluated on set', () => {
    const cookie = useCookie('expire-getter-reset', {
      default: () => 'initial',
      expires: () => new Date(Date.now() + 1000),
    })

    cookie.value = 'first'
    expect(cookie.value).toBe('first')

    vi.advanceTimersByTime(500)
    expect(cookie.value).toBe('first')

    // Re-set — getter returns a fresh Date 1000ms from now
    cookie.value = 'second'
    expect(cookie.value).toBe('second')

    vi.advanceTimersByTime(500)
    expect(cookie.value).toBe('second')

    vi.advanceTimersByTime(500)
    expect(cookie.value).toBeUndefined()
  })

  it('should not extend a fixed expires Date beyond its absolute time on re-set', () => {
    const expires = new Date(Date.now() + 1000)
    const cookie = useCookie('expire-fixed-date', {
      default: () => 'initial',
      expires,
    })

    cookie.value = 'first'
    expect(cookie.value).toBe('first')

    vi.advanceTimersByTime(500)
    expect(cookie.value).toBe('first')

    // Re-set should use remaining time to the fixed Date, not restart a full 1000ms
    cookie.value = 'second'
    expect(cookie.value).toBe('second')

    vi.advanceTimersByTime(500)
    expect(cookie.value).toBeUndefined()
  })

  it('should prefer maxAge over expires for the client expiration timer', () => {
    const cookie = useCookie('expire-maxage-precedence', {
      default: () => 'value',
      maxAge: 2,
      expires: () => new Date(Date.now() + 60_000),
    })

    cookie.value = 'value'
    expect(cookie.value).toBe('value')

    vi.advanceTimersByTime(2000)
    expect(cookie.value).toBeUndefined()
  })

  it('should start an expiration timer when expires changes from undefined to a Date', () => {
    const state: { expires?: Date } = {}
    const cookie = useCookie('expire-session-to-date', {
      default: () => 'initial',
      expires: () => state.expires,
    })

    cookie.value = 'session'
    vi.advanceTimersByTime(1000)
    expect(cookie.value).toBe('session')

    state.expires = new Date(Date.now() + 1000)
    cookie.value = 'persistent'

    vi.advanceTimersByTime(1000)
    expect(cookie.value).toBeUndefined()
  })

  it('should clear the expiration timer when expires changes from a Date to undefined', () => {
    const state: { expires?: Date } = { expires: new Date(Date.now() + 1000) }
    const cookie = useCookie('expire-date-to-session', {
      default: () => 'initial',
      expires: () => state.expires,
    })

    cookie.value = 'persistent'
    vi.advanceTimersByTime(500)
    expect(cookie.value).toBe('persistent')

    state.expires = undefined
    cookie.value = 'session'

    vi.advanceTimersByTime(1000)
    expect(cookie.value).toBe('session')
  })
})
