import { describe, expect, it } from 'vitest'
import Beasties from 'beasties'
import type { Options as BeastiesOptions } from 'beasties'
import { resolveBeastiesOptions } from './runtime/utils/renderer/critical-styles-options.ts'

// These tests exercise every `beasties` option that has an observable effect, run directly
// (no Nuxt build) so the whole `criticalStyles` option surface is covered cheaply. The most
// important guarantee is that our defaults never prune styles emitted by `features.inlineStyles`.

const SHEET = '.used{--used-token:1}.unused{--unused-token:1}'

function run (html: string, options: boolean | BeastiesOptions = true, sheets: Record<string, string> = { '/main.css': SHEET }) {
  class TestBeasties extends Beasties {
    override getCssAsset (href: string) {
      return sheets[href]
    }

    writeFile () {
      return Promise.resolve()
    }
  }
  return new TestBeasties(resolveBeastiesOptions(options)).process(html)
}

const doc = (head = '', body = '<div class="used"></div>') => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`
const LINK = '<link rel="stylesheet" href="/main.css">'
const styleBlocks = (html: string) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!)

describe('resolveBeastiesOptions defaults', () => {
  it('forces silent logging and disabled inline-style reduction', () => {
    expect(resolveBeastiesOptions(true)).toMatchObject({ logLevel: 'silent', reduceInlineStyles: false })
  })

  it('merges and lets user options win over defaults', () => {
    expect(resolveBeastiesOptions({ reduceInlineStyles: true, preload: 'swap' })).toMatchObject({
      logLevel: 'silent',
      reduceInlineStyles: true,
      preload: 'swap',
    })
  })

  it('treats false/true as an empty option set', () => {
    expect(resolveBeastiesOptions(false)).toEqual({ logLevel: 'silent', reduceInlineStyles: false })
  })
})

describe('default behaviour', () => {
  it('inlines critical rules and drops non-critical ones', async () => {
    const out = await run(doc(LINK))
    expect(styleBlocks(out).join('')).toContain('--used-token')
    expect(out).not.toContain('--unused-token')
  })

  it('does not prune pre-existing inline styles (inlineStyles safety)', async () => {
    // `.keep` is absent from the DOM; with our `reduceInlineStyles: false` default it must survive.
    const out = await run(doc(LINK + '<style>.keep{--keep-token:1}</style>'))
    expect(out).toContain('--keep-token')
  })
})

describe('reduceInlineStyles', () => {
  it('prunes inline styles for absent selectors when explicitly enabled', async () => {
    const out = await run(doc('<style>.keep{--keep-token:1}</style>'), { reduceInlineStyles: true })
    expect(out).not.toContain('--keep-token')
  })
})

describe('external', () => {
  it('skips external stylesheets when disabled', async () => {
    const out = await run(doc(LINK), { external: false })
    expect(out).not.toContain('--used-token')
    expect(out).toMatch(/<link [^>]*rel="stylesheet"/)
  })
})

describe('allowRules', () => {
  it('force-includes matched selectors that are not in the DOM', async () => {
    const out = await run(doc(LINK), { allowRules: ['.unused'] })
    expect(styleBlocks(out).join('')).toContain('--unused-token')
  })
})

describe('inlineThreshold', () => {
  it('inlines the whole sheet when it is below the threshold', async () => {
    const out = await run(doc(LINK), { inlineThreshold: 10_000 })
    expect(styleBlocks(out).join('')).toContain('--unused-token')
  })
})

describe('pruneSource', () => {
  it('still inlines critical CSS without throwing', async () => {
    const out = await run(doc(LINK), { pruneSource: true })
    expect(styleBlocks(out).join('')).toContain('--used-token')
  })
})

describe('mergeStylesheets', () => {
  const sheets = { '/a.css': '.used{--a-token:1}', '/b.css': '.second{--b-token:1}' }
  const twoLinks = doc('<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">', '<div class="used"></div><div class="second"></div>')

  it('merges inlined stylesheets into a single tag by default', async () => {
    const out = await run(twoLinks, true, sheets)
    expect(styleBlocks(out)).toHaveLength(1)
  })

  it('keeps stylesheets separate when disabled', async () => {
    const out = await run(twoLinks, { mergeStylesheets: false }, sheets)
    expect(styleBlocks(out).length).toBeGreaterThan(1)
  })
})

describe('preload strategy', () => {
  it('default converts the link to a preload', async () => {
    const out = await run(doc(LINK))
    expect(out).toMatch(/<link [^>]*rel="preload"[^>]*as="style"/)
  })

  it('"swap" flips rel on load', async () => {
    const out = await run(doc(LINK), { preload: 'swap' })
    expect(out).toContain('this.rel=\'stylesheet\'')
  })

  it('"media" uses the print-media swap', async () => {
    const out = await run(doc(LINK), { preload: 'media' })
    expect(out).toMatch(/media="print"/)
  })

  it('"js" injects a loader script', async () => {
    const out = await run(doc(LINK), { preload: 'js' })
    expect(out).toContain('$loadcss')
  })

  it('"body" moves the stylesheet into the body', async () => {
    const out = await run(doc(LINK), { preload: 'body' })
    const bodyStart = out.indexOf('<body')
    expect(out.indexOf('rel="stylesheet"')).toBeGreaterThan(bodyStart)
  })
})

describe('noscriptFallback', () => {
  it('adds a noscript fallback by default for js-based strategies', async () => {
    const out = await run(doc(LINK), { preload: 'swap' })
    expect(out).toContain('<noscript>')
  })

  it('omits the noscript fallback when disabled', async () => {
    const out = await run(doc(LINK), { preload: 'swap', noscriptFallback: false })
    expect(out).not.toContain('<noscript>')
  })
})

describe('keyframes', () => {
  const sheets = { '/main.css': '.used{animation:spin 1s}@keyframes spin{from{opacity:0}to{opacity:1}}@keyframes ghost{from{opacity:0}to{opacity:1}}' }

  it('keeps only critical keyframes by default', async () => {
    const out = await run(doc(LINK), true, sheets)
    const css = styleBlocks(out).join('')
    expect(css).toContain('@keyframes spin')
    expect(css).not.toContain('@keyframes ghost')
  })

  it('drops all keyframes when set to "none"', async () => {
    const out = await run(doc(LINK), { keyframes: 'none' }, sheets)
    expect(styleBlocks(out).join('')).not.toContain('@keyframes spin')
  })

  it('keeps all keyframes when set to "all"', async () => {
    const out = await run(doc(LINK), { keyframes: 'all' }, sheets)
    expect(styleBlocks(out).join('')).toContain('@keyframes ghost')
  })
})

describe('fonts', () => {
  const sheets = { '/main.css': '@font-face{font-family:Test;src:url(/t.woff2)}.used{font-family:Test}' }

  it('inlines critical @font-face when inlineFonts is enabled', async () => {
    const out = await run(doc(LINK), { inlineFonts: true }, sheets)
    expect(styleBlocks(out).join('')).toContain('@font-face')
  })
})

describe('compress', () => {
  const sheets = { '/main.css': '.used { --used-token: 1 }' }

  it('minifies inlined CSS by default', async () => {
    const out = await run(doc(LINK), true, sheets)
    expect(styleBlocks(out).join('')).toContain('--used-token:1')
  })

  it('preserves formatting when disabled', async () => {
    const out = await run(doc(LINK), { compress: false }, sheets)
    expect(styleBlocks(out).join('')).toMatch(/--used-token:\s+1/)
  })
})

describe('safeParser', () => {
  it('tolerates malformed CSS without throwing', async () => {
    const sheets = { '/main.css': '.used{--used-token:1}.broken{color:}' }
    await expect(run(doc(LINK), true, sheets)).resolves.toContain('--used-token')
  })
})
