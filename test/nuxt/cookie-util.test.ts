/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, describe, expect, it } from 'vitest'
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

    $cookie.set('util-basic', { a: 1 })
    expect(document.cookie).toContain('util-basic=')
    expect($cookie.get('util-basic')).toEqual({ a: 1 })
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
    $cookie.set('util-shared', '42')
    expect(useCookie('util-shared').value).toBe('42')

    $cookie.set('util-shared-number', 42)
    expect(useCookie('util-shared-number').value).toBe(42)
  })

  it('should support default and custom encode/decode', () => {
    expect($cookie.get('util-default', { default: () => 'fallback' })).toBe('fallback')

    $cookie.set('util-custom', 'hello', { encode: v => `x-${v}` })
    expect($cookie.get('util-custom', { decode: v => v?.slice(2) })).toBe('hello')
  })

  it('should run onRead and onWrite interceptors', () => {
    const calls: string[] = []
    $cookie.set('util-intercept', 'secret', {
      onWrite: (ctx) => {
        calls.push(`write:${ctx.name}:${ctx.raw}`)
        ctx.value = ctx.value!.toUpperCase()
        calls.push(`encoded:${ctx.raw}`)
      },
    })
    expect($cookie.get('util-intercept')).toBe('SECRET')

    const value = $cookie.get('util-intercept', {
      onRead: (ctx) => {
        calls.push(`read:${ctx.raw}`)
        ctx.value = `${ctx.value}!`
      },
    })
    expect(value).toBe('SECRET!')
    expect(calls).toEqual(['write:util-intercept:secret', 'encoded:SECRET', 'read:SECRET'])
  })

  it('should allow interceptors to change the raw value', () => {
    const signed = $cookie.create({
      onWrite: (ctx) => {
        if (ctx.raw !== undefined) { ctx.raw = `${ctx.raw}.sig` }
      },
      onRead: (ctx) => {
        ctx.raw = ctx.raw?.endsWith('.sig') ? ctx.raw.slice(0, -4) : undefined
      },
    })

    signed.set('util-signed', { a: 1 })
    expect($cookie.get('util-signed', { decode: v => v })).toBe('%7B%22a%22%3A1%7D.sig')
    expect(signed.get('util-signed')).toEqual({ a: 1 })

    $cookie.set('util-signed', 'tampered')
    expect(signed.get('util-signed', { default: () => 'fallback' })).toBe('fallback')

    signed.remove('util-signed')
    expect($cookie.get('util-signed')).toBeUndefined()
  })

  it('should discard a raw override when the value is changed afterwards', () => {
    $cookie.set('util-override', 'a', {
      onWrite: [
        (ctx) => { ctx.raw = 'overridden' },
        (ctx) => { ctx.value = 'b' },
      ],
    })
    expect($cookie.get('util-override')).toBe('b')
  })

  it('should create instances with merged defaults and chained interceptors', () => {
    const order: string[] = []
    const base = $cookie.create({
      maxAge: 60,
      onWrite: (ctx) => { order.push('base'); ctx.name = `app-${ctx.name}` },
    })
    const child = base.create({ onWrite: () => { order.push('child') } })

    child.set('token', 'abc', { onWrite: () => { order.push('call') } })
    expect(order).toEqual(['base', 'child', 'call'])
    expect($cookie.get('app-token')).toBe('abc')
    expect($cookie.has('token')).toBe(false)
  })
})
