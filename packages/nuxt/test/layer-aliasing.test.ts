import type { NuxtConfigLayer } from 'nuxt/schema'
import type { UnpluginContextMeta } from 'unplugin'
import { describe, expect, it } from 'vitest'

import { LayerAliasingPlugin } from '../src/core/plugins/layer-aliasing'

interface TransformHandler {
  (this: unknown, code: string, id: string): { code: string } | undefined
}

interface RawPlugin {
  transformInclude?: (id: string) => boolean | null | undefined
  transform?: { handler: TransformHandler }
}

function makeLayer (cwd: string): NuxtConfigLayer {
  return { cwd, config: { srcDir: cwd, rootDir: cwd } } as NuxtConfigLayer
}

function createPlugin (layers: NuxtConfigLayer[], framework: 'vite' | 'webpack' = 'vite') {
  const meta = { framework, webpack: { compiler: {} } } as unknown as UnpluginContextMeta
  const raw = LayerAliasingPlugin({ root: '/', dev: false, sourcemap: false, layers }).raw({}, meta)
  const entry = (Array.isArray(raw) ? raw[0] : raw) as RawPlugin
  return {
    transformInclude: entry.transformInclude!,
    transform: (code: string, id: string) => entry.transform!.handler.call({}, code, id),
  }
}

describe('LayerAliasingPlugin transform', () => {
  const layerDir = '/abs/layer'
  const otherLayerDir = '/abs/other-layer'

  it('rewrites quoted layer-relative aliases inside layer files', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    const result = transform(
      `@use '@/styles/global' as g;\n@import "~/styles/extra";`,
      `${layerDir}/components/UiButton.vue`,
    )

    expect(result?.code).toBe(`@use '${layerDir}/styles/global' as g;\n@import "${layerDir}/styles/extra";`)
  })

  it('rewrites url() references that use quoted aliases', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    const result = transform(
      `.x { background-image: url('@/assets/icon.svg'); }`,
      `${layerDir}/components/UrlRef.vue`,
    )

    expect(result?.code).toBe(`.x { background-image: url('${layerDir}/assets/icon.svg'); }`)
  })

  it('handles `@@`/`~~` root aliases distinctly from `@`/`~`', () => {
    const layer: NuxtConfigLayer = {
      cwd: layerDir,
      config: { srcDir: `${layerDir}/src`, rootDir: layerDir },
    } as NuxtConfigLayer
    const { transform } = createPlugin([layer])

    const result = transform(
      `@use '@/a';\n@use '@@/b';`,
      `${layer.config.srcDir}/components/X.vue`,
    )

    expect(result?.code).toBe(`@use '${layerDir}/src/a';\n@use '${layerDir}/b';`)
  })

  it('picks the longest matching layer srcDir (nested layers)', () => {
    const parent = makeLayer('/abs')
    const child = makeLayer('/abs/nested')
    const { transform } = createPlugin([parent, child])

    const result = transform(
      `@use '@/foo';`,
      `/abs/nested/components/X.vue`,
    )

    expect(result?.code).toBe(`@use '/abs/nested/foo';`)
  })

  it('does not touch files outside any registered layer', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    expect(transform(`@use '@/styles/global';`, `/other/path/file.scss`)).toBeUndefined()
  })

  it('does not touch unquoted occurrences (e.g. comments, identifiers)', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    expect(transform(`// see @/styles/global for tokens`, `${layerDir}/file.ts`)).toBeUndefined()
  })

  it('runs the same way under non-vite frameworks', () => {
    const { transform } = createPlugin([makeLayer(layerDir)], 'webpack')

    const result = transform(
      `import x from '@/utils'`,
      `${layerDir}/components/X.vue`,
    )

    expect(result?.code).toBe(`import x from '${layerDir}/utils'`)
  })

  it('on vite, only transforms CSS-flavoured files inside a registered layer', () => {
    const { transformInclude } = createPlugin([makeLayer(layerDir), makeLayer(otherLayerDir)])

    // Plain `.vue` and `.ts` files are handled by `vite.resolveId` instead.
    expect(transformInclude(`${layerDir}/components/X.vue`)).toBe(false)
    expect(transformInclude(`${layerDir}/utils.ts`)).toBe(false)

    // Vite emits virtual sub-IDs for `<style>` blocks; those should be transformed.
    expect(transformInclude(`${layerDir}/components/X.vue?vue&type=style&index=0&lang.scss`)).toBe(true)
    expect(transformInclude(`${layerDir}/components/X.vue?vue&type=style&index=0&lang.css`)).toBe(true)

    // Standalone style files in any registered layer are transformed.
    expect(transformInclude(`${layerDir}/styles/global.scss`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.sass`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.less`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.css`)).toBe(true)
    expect(transformInclude(`${otherLayerDir}/styles/global.scss`)).toBe(true)

    // Outside any layer: never transformed.
    expect(transformInclude(`/somewhere/else/global.scss`)).toBe(false)
  })

  it('on non-vite, transforms any file inside a registered layer', () => {
    const { transformInclude } = createPlugin([makeLayer(layerDir)], 'webpack')

    expect(transformInclude(`${layerDir}/components/X.vue`)).toBe(true)
    expect(transformInclude(`${layerDir}/utils.ts`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.scss`)).toBe(true)
    expect(transformInclude(`/somewhere/else/file.ts`)).toBe(false)
  })
})
