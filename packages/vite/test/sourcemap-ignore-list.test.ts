import { describe, expect, it } from 'vitest'
import { rolldown } from 'rolldown'

import { createSourcemapIgnoreList } from '../src/utils/index.ts'

describe('createSourcemapIgnoreList', () => {
  const ignoreList = createSourcemapIgnoreList('/project/.nuxt')
  const sourcemapPath = '/project/.nuxt/dist/client/_nuxt/entry.js.map'

  it('lists sources inside the build directory', () => {
    expect(ignoreList('../../../components.plugin.mjs', sourcemapPath)).toBe(true)
  })

  it('lists sources from node_modules', () => {
    expect(ignoreList('../../../../node_modules/vue/dist/vue.mjs', sourcemapPath)).toBe(true)
  })

  it('does not list app sources or directories sharing a name prefix with the build directory', () => {
    expect(ignoreList('../../../../app/app.vue', sourcemapPath)).toBe(false)
    expect(ignoreList('../../../../.nuxt-foo/index.mjs', sourcemapPath)).toBe(false)
  })

  it('applies to the sources of a rolldown build', async () => {
    const files: Record<string, string> = {
      '/project/app/entry.js': 'import { gen } from "/project/.nuxt/gen.js"\nconsole.log(gen())',
      '/project/.nuxt/gen.js': 'export const gen = () => globalThis.value',
    }
    const bundle = await rolldown({
      input: '/project/app/entry.js',
      plugins: [{
        name: 'files',
        resolveId: id => id in files ? id : undefined,
        load: id => files[id],
      }],
    })
    const { output: [chunk] } = await bundle.generate({
      dir: '/project/.nuxt/dist/client/_nuxt',
      sourcemap: true,
      sourcemapIgnoreList: ignoreList,
    })
    const map = chunk.map!
    expect(map.sources).toEqual(['../../../gen.js', '../../../../app/entry.js'])
    expect(map.ignoreList).toEqual([0])
  })
})
