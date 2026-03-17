import { describe, expect, it } from 'vitest'

import { getStableEntryChunkHashSeed } from '../src/plugins/stable-entry'

describe('getStableEntryChunkHashSeed', () => {
  it('is stable for order changes and sensitive to dependency changes', () => {
    const first = getStableEntryChunkHashSeed({
      dynamicImports: ['chunk-a.js', 'chunk-b.js'],
      viteMetadata: {
        importedCss: new Set(['style-b.css', 'style-a.css']),
        importedAssets: new Set(['asset-z.svg']),
      },
    })

    const reordered = getStableEntryChunkHashSeed({
      dynamicImports: ['chunk-b.js', 'chunk-a.js'],
      viteMetadata: {
        importedCss: new Set(['style-a.css', 'style-b.css']),
        importedAssets: new Set(['asset-z.svg']),
      },
    })

    const changed = getStableEntryChunkHashSeed({
      dynamicImports: ['chunk-a.js', 'chunk-c.js'],
      viteMetadata: {
        importedCss: new Set(['style-a.css', 'style-b.css']),
        importedAssets: new Set(['asset-z.svg']),
      },
    })

    expect(first).toBe(reordered)
    expect(changed).not.toBe(first)
  })
})
