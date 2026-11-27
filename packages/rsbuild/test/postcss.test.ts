import type { Nuxt } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'

import { TildeAliasPostcssPlugin } from '../src/utils/postcss.ts'

const nuxt = { options: { alias: { '~': '/project/app', '~~': '/project' } } } as unknown as Nuxt

function transform (value: string, file: string | null = '/project/app/assets/css/main.css') {
  const decl = { value, source: { input: { file: file ?? undefined } } }
  const plugin = TildeAliasPostcssPlugin(nuxt) as unknown as { Declaration: (decl: unknown) => void }
  plugin.Declaration(decl)
  return decl.value
}

describe('TildeAliasPostcssPlugin', () => {
  it('rewrites `~` and `~~` url() requests relative to the stylesheet', () => {
    expect(transform(`url('~/assets/icon.svg')`)).toBe(`url('../icon.svg')`)
    expect(transform(`url("~~/public/icon.svg") no-repeat, url(~/assets/css/bg.png)`)).toBe(`url("../../../public/icon.svg") no-repeat, url(./bg.png)`)
  })

  it('leaves other url() requests unchanged', () => {
    for (const value of [`url('@/assets/icon.svg')`, `url(/icon.svg)`, `url(./icon.svg)`, `url(~pkg/icon.svg)`, `url(data:image/png;base64,AAAA)`]) {
      expect(transform(value)).toBe(value)
    }
  })

  it('leaves declarations without a source file unchanged', () => {
    expect(transform(`url(~/assets/icon.svg)`, null)).toBe(`url(~/assets/icon.svg)`)
  })
})
