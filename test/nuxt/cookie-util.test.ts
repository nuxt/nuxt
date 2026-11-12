/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { $cookie } from '#app/composables/cookie'

function clearCookies () {
  for (const name of Object.keys($cookie.getAll())) {
    $cookie.remove(name)
  }
}

describe('$cookie', () => {
  afterEach(clearCookies)

  it('should read, write and remove cookies', () => {
    expect($cookie.get('util-basic')).toBeUndefined()
    expect($cookie.has('util-basic')).toBe(false)

    $cookie.set('util-basic', 'a b')
    expect(document.cookie).toContain('util-basic=a%20b')
    expect($cookie.get('util-basic')).toBe('a b')
    expect($cookie.has('util-basic')).toBe(true)

    $cookie.remove('util-basic')
    expect($cookie.get('util-basic')).toBeUndefined()
  })

  it('should treat null as removal', async () => {
    $cookie.set('util-null', 'x')
    $cookie.set('util-null', null)
    // happy-dom only expires a `Max-Age=0` cookie once the clock has moved on
    await new Promise(resolve => setTimeout(resolve, 2))
    expect(document.cookie).not.toContain('util-null=')
    expect($cookie.has('util-null')).toBe(false)
  })

  it('should share encoding with useCookie', () => {
    $cookie.set('util-shared', '"quoted"')
    expect(useCookie('util-shared').value).toBe('"quoted"')

    $cookie.set<number>('util-shared-number', 42)
    expect(useCookie('util-shared-number').value).toBe('42')
  })

  it('should not serialize values as JSON by default', () => {
    const writes = captureCookieWrites()
    $cookie.set('util-plain', 'true')
    $cookie.set<{ a: number }>('util-plain-object', { a: 1 })
    expect([...writes]).toEqual(['util-plain=true; Path=/', 'util-plain-object=%5Bobject%20Object%5D; Path=/'])
    expect($cookie.get('util-plain')).toBe('true')
    writes.restore()
  })

  it('should support the legacy JSON serializer', () => {
    const legacy = $cookie.create(legacyCookieSerializer)
    legacy.set('util-legacy', { a: 1 })
    legacy.set('util-legacy-string', '42')
    expect($cookie.get('util-legacy')).toBe('{"a":1}')
    expect($cookie.get('util-legacy-string')).toBe('"42"')
    expect(legacy.get('util-legacy')).toEqual({ a: 1 })
    expect(legacy.get('util-legacy-string')).toBe('42')

    const useLegacyCookie = createUseCookie(legacyCookieSerializer)
    expect(useLegacyCookie('util-legacy').value).toEqual({ a: 1 })
    expect(useLegacyCookie('util-legacy', { decode: v => v }).value).toBe('%7B%22a%22%3A1%7D')
  })

  it('should support default and custom encode/decode', () => {
    expect($cookie.get('util-default', { default: () => 'fallback' })).toBe('fallback')

    $cookie.set('util-custom', 'hello', { encode: v => `x-${v}` })
    expect($cookie.get('util-custom', { decode: v => v?.slice(2) })).toBe('hello')
  })

  it('should create instances with merged defaults', () => {
    const writes = captureCookieWrites()
    const base = $cookie.create({ path: '/', maxAge: 60, encode: v => `x-${v}`, decode: v => v?.slice(2) })
    const child = base.create({ default: () => 'fallback' })

    expect($cookie.options).toEqual({})
    expect(child.options).toMatchObject({ path: '/', maxAge: 60, default: expect.any(Function) })

    child.set('util-create', 'hi')
    expect(writes.at(-1)).toBe('util-create=x-hi; Max-Age=60; Path=/')
    expect(child.get('util-create')).toBe('hi')
    expect(child.get('util-create-missing')).toBe('fallback')

    child.set('util-create', 'hi', { maxAge: 10, encode: v => `y-${v}` })
    expect(writes.at(-1)).toBe('util-create=y-hi; Max-Age=10; Path=/')
    writes.restore()
  })

  it('should use the defaults of a $cookie instance passed to useCookie', async () => {
    const prefixed = $cookie.create({ encode: v => `x-${v}`, decode: v => v?.slice(2) })

    useCookie('util-ref', { $cookie: prefixed }).value = 'hi'
    await nextTick()
    expect($cookie.get('util-ref', { decode: v => v })).toBe('x-hi')
    expect(useCookie('util-ref', { $cookie: prefixed }).value).toBe('hi')

    expect(useCookie('util-ref', { $cookie: prefixed, decode: v => v }).value).toBe('x-hi')
  })
})

function captureCookieWrites () {
  let target: any = document
  let descriptor: PropertyDescriptor | undefined
  while (target && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(target, 'cookie')
    if (!descriptor) { target = Object.getPrototypeOf(target) }
  }
  const writes: string[] = []
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => descriptor!.get!.call(document),
    set (value) {
      writes.push(value)
      descriptor!.set!.call(document, value)
    },
  })
  return Object.assign(writes, { restore: () => { delete (document as any).cookie } })
}
