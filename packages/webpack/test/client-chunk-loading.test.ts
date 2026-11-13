import { describe, expect, it } from 'vitest'

import { getClientChunkLoading } from '../src/plugins/vue/manifest.ts'

describe('getClientChunkLoading', () => {
  it('describes chunks loaded as classic scripts', () => {
    expect(getClientChunkLoading({ chunkLoading: 'jsonp', scriptType: false, crossOriginLoading: false })).toEqual({ module: false, crossOrigin: false })
  })

  it.each([
    ['imported', { chunkLoading: 'import' }],
    ['inserted as module scripts', { chunkLoading: 'jsonp', scriptType: 'module' }],
  ])('describes chunks %s as modules', (_, output) => {
    expect(getClientChunkLoading(output)).toEqual({ module: true, crossOrigin: false })
  })

  it.each(['anonymous', 'use-credentials'])('does not describe chunks loaded with `crossOriginLoading: %s`', (crossOriginLoading) => {
    expect(getClientChunkLoading({ chunkLoading: 'jsonp', crossOriginLoading })).toBeUndefined()
  })

  it.each([false, 'import-scripts', undefined] as const)('does not describe chunks loaded with `chunkLoading: %s`', (chunkLoading) => {
    expect(getClientChunkLoading({ chunkLoading })).toBeUndefined()
  })
})
