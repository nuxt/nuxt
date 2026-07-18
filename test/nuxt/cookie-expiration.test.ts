/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

const MAX_TIMEOUT_DELAY = 2_147_483_647

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
})
