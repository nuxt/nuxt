import { describe, expect, it } from 'vitest'
import { normalize } from 'pathe'

import { isExternalId } from '../../packages/nuxt/src/imports/transform'

describe('isExternalId', () => {
  const layerRoots = [normalize('/project'), normalize('/project/app'), normalize('/layers/base')]

  it('keeps project and layer files internal (auto-imports allowed)', () => {
    expect(isExternalId(normalize('/project/app/app.vue'), layerRoots)).toBe(false)
    expect(isExternalId(normalize('/project/composables/foo.ts'), layerRoots)).toBe(false)
    expect(isExternalId(normalize('/layers/base/utils/bar.ts'), layerRoots)).toBe(false)
  })

  it('marks node_modules files external', () => {
    expect(isExternalId(normalize('/project/node_modules/vue/dist/vue.mjs'), layerRoots)).toBe(true)
  })

  it('marks a linked lib resolved outside every layer root external (#19525)', () => {
    // vite resolves a `file:`-linked dep to its real path, outside node_modules and layer roots
    expect(isExternalId(normalize('/linked-lib/lib.mjs'), layerRoots)).toBe(true)
  })

  it('does not misclassify a sibling dir sharing a layer-root prefix', () => {
    expect(isExternalId(normalize('/project-utils/index.mjs'), layerRoots)).toBe(true)
  })

  it('keeps `include`-matched node_modules layers internal', () => {
    const id = normalize('/project/node_modules/my-layer/composables/x.ts')
    expect(isExternalId(id, layerRoots, [/my-layer/])).toBe(false)
  })

  it('leaves non-absolute ids to the node_modules check (virtual modules untouched)', () => {
    expect(isExternalId('\0virtual:nuxt', layerRoots)).toBe(false)
    expect(isExternalId('#build/foo', layerRoots)).toBe(false)
  })

  it('falls back to node_modules only when no layer roots are known', () => {
    expect(isExternalId(normalize('/linked-lib/lib.mjs'), [])).toBe(false)
    expect(isExternalId(normalize('/project/node_modules/vue/index.mjs'), [])).toBe(true)
  })
})
