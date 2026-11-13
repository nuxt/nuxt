// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { Comment, Fragment, Static } from 'vue'
import type { Slots, VNode } from 'vue'
import { isIslandsV2 } from '@nuxt/kit/internal'

import { htmlToVNode } from '../src/app/components/islands-v2/dom-to-vnode.ts'
import { createRemoteImportFn } from '../src/app/components/islands-v2/import-fn.ts'
import { encodeMarker, isChunkPath, isMarkerNonce, ownSlots, readChunkPaths, readMarkerNonces } from '../src/app/components/islands-v2/shared.ts'

// The real loader imports the build-generated `#islands-v2-manifest`.
vi.mock('../src/app/components/islands-v2/loader.ts', () => ({ default: { name: 'NuxtIslandComponentLoader' } }))

const NONCE = 'abcdef0123456789abcdef01'

describe('isIslandsV2', () => {
  it('accepts the string and the object form', () => {
    expect(isIslandsV2('v2')).toBe(true)
    expect(isIslandsV2({ version: 'v2', remoteIsland: true })).toBe(true)
  })

  it.each([true, false, 'auto', 'local+remote', { remoteIsland: true }, { selectiveClient: 'deep' }] as const)('rejects %j', (value) => {
    expect(isIslandsV2(value)).toBe(false)
  })
})

describe('isChunkPath', () => {
  it.each(['/_nuxt/abc.js', '/_nuxt/components/Counter.vue', '/_nuxt/@fs/D:/repo/app/Counter.vue', '/_nuxt/a%20b.js'])('accepts %s', (path) => {
    expect(isChunkPath(path)).toBe(true)
  })

  it.each([
    ['an absolute URL', 'https://evil.test/x.js'],
    ['a protocol-relative URL', '//evil.test/x.js'],
    ['a backslash', '/\\evil.test/x.js'],
    ['a relative path', '_nuxt/x.js'],
    ['a parent segment', '/_nuxt/../../x.js'],
    ['a trailing parent segment', '/_nuxt/..'],
    ['a dot segment', '/./x.js'],
    ['an encoded dot', '/_nuxt/%2e%2e/x.js'],
    ['an encoded slash', '/_nuxt/%2F%2Fevil.test'],
    ['a query', '/x.js?y'],
    ['a fragment', '/x.js#y'],
    ['a data URL', 'data:text/javascript,alert(1)'],
    ['a non-string', 1],
  ])('rejects %s', (_, path) => {
    expect(isChunkPath(path)).toBe(false)
  })
})

describe('readChunkPaths', () => {
  it('keeps only the paths that are safe to import', () => {
    expect(readChunkPaths({ '/a.vue': '/_nuxt/a.js', '/b.vue': '//evil.test/b.js', '/c.vue': 1 })).toEqual({ '/a.vue': '/_nuxt/a.js' })
    expect(readChunkPaths('/_nuxt/a.js')).toBeUndefined()
    expect(readChunkPaths(undefined)).toBeUndefined()
  })
})

describe('readMarkerNonces', () => {
  it('reads valid nonces of a local or remote response', () => {
    expect(readMarkerNonces({ nonce: NONCE }, false)).toEqual({ nonce: NONCE })
    expect(readMarkerNonces({ nonce: NONCE, nonces: [NONCE] }, true)).toEqual({ nonce: NONCE, nonces: [NONCE] })
  })

  it('rejects a local response without a valid nonce', () => {
    expect(readMarkerNonces({}, false)).toBeUndefined()
    expect(readMarkerNonces({ nonce: NONCE, nonces: ['short'] }, false)).toBeUndefined()
  })

  it('gives a remote response without a valid nonce a fresh one, so its HTML renders statically', () => {
    const html = `<div><!--i:c:${NONCE}${encodeMarker([null, '/c.vue'])}--><i>x</i><!--/i:c:${NONCE}--></div>`
    const nonces = readMarkerNonces({ nonce: 'short' }, true)!
    expect(isMarkerNonce(nonces.nonce)).toBe(true)
    expect(nonces.nonce).not.toBe(NONCE)

    const remote = { source: 'https://remote.test' }
    expect(htmlToVNode(html, { ...nonces, remote })!.type).toBe(Static)
    const fragment = htmlToVNode(`<!--legacy-->${html}`, { ...nonces, remote })!
    expect(fragment.type).toBe(Fragment)
    expect((fragment.children as VNode[]).map(vnode => vnode.type)).toEqual([Comment, Static])
  })

  it('keeps an absent payload entry an error, remote or not', () => {
    expect(readMarkerNonces(undefined, true)).toBeUndefined()
  })
})

describe('ownSlots', () => {
  const slots = { default: () => [], _: 1 } as unknown as Slots

  it('keeps the slots for an own slot function', () => {
    expect(ownSlots(slots, 'default')).toBe(slots)
  })

  it.each(['toString', 'hasOwnProperty', '_', 'missing'])('drops them for %s', (name) => {
    expect(ownSlots(slots, name)).toEqual({})
  })
})

describe('createRemoteImportFn', () => {
  it('only loads chunks listed in the response', async () => {
    const importFn = createRemoteImportFn('https://remote.test', { '/c.vue': '/_nuxt/c.js' })
    await expect(importFn('/other.vue')).rejects.toThrow('No loader registered')
    await expect(importFn('__proto__')).rejects.toThrow('No loader registered')
  })
})
