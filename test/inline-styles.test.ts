import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { projectSuffix, runsOnceInMatrix } from './matrix'

describe.skipIf(!runsOnceInMatrix)('inline styles', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/inline-styles', import.meta.url))

  beforeAll(async () => {
    const result = await exec('pnpm', ['nuxt', 'generate', rootDir])
    if (result.exitCode !== 0) {
      throw new Error(`nuxt generate failed:\n${result.stderr}\n${result.stdout}`)
    }
  }, 120 * 1000)

  const outputDir = join(rootDir, `.output-${projectSuffix}`)

  // https://github.com/nuxt/nuxt/issues/30435
  it.each([
    ['/', 'index', '--inline-app-token:app', '--inline-page-index-token:index'],
    ['/about', 'about', '--inline-app-token:app', '--inline-page-about-token:about'],
  ])('drops duplicate stylesheet links for %s when its CSS is fully inlined', async (route, page, ...tokens) => {
    const html = await readFile(join(outputDir, 'public', route === '/' ? 'index.html' : `${page}/index.html`), 'utf-8')
    for (const token of tokens) {
      expect(html, page).toContain(token)
    }

    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(cssLinks, page).toEqual([])
  })

  // https://github.com/nuxt/nuxt/issues/35255
  it.fails('drops duplicate stylesheet links for fully inlined CSS in a shared chunk', async () => {
    for (const page of ['shared-a', 'shared-b']) {
      const html = await readFile(join(outputDir, 'public', page, 'index.html'), 'utf-8')
      expect(html, page).toContain('--inline-shared-box-token:shared-box')

      const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
      expect(cssLinks, page).toEqual([])
    }
  })

  // https://github.com/nuxt/nuxt/issues/31558
  it('inlines CSS for a non-island child of a server component', async () => {
    const html = await readFile(join(outputDir, 'public', 'index.html'), 'utf-8')
    expect(html).toContain('--island-child-token:child')
  })

  // https://github.com/nuxt/nuxt/issues/35188
  it('inlines CSS for a lazy component explicitly imported from #components', async () => {
    // Check the style is in the HTML
    const html = await readFile(join(outputDir, 'public', 'lazy-import/index.html'), 'utf-8')
    expect(html).toContain('--inline-lazy-import-token:lazy-import')
    // Ensure there are no linked stylesheets
    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(cssLinks).toEqual([])
  })

  // https://github.com/nuxt/nuxt/issues/35423
  it.each([
    ['first', '--inline-first-shared-token:first-shared', '--inline-second-shared-token:second-shared'],
    ['second', '--inline-second-shared-token:second-shared', '--inline-first-shared-token:first-shared'],
  ])('inlines the correct CSS for %s when two pages share a basename', async (dir, expectedToken, otherToken) => {
    const html = await readFile(join(outputDir, 'public', dir, 'shared-name', 'index.html'), 'utf-8')
    expect(html).toContain(expectedToken)
    expect(html).not.toContain(otherToken)
    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(cssLinks).toEqual([])
  })

  // https://github.com/nuxt/nuxt/issues/27417
  // https://github.com/nuxt/nuxt/issues/35065
  it.each([
    ['preprocessor extension imported from <script>', '--inline-preprocessor-from-script-token:preprocessor-from-script'],
    ['CSS imported as a side effect from a non-Vue JS module', '--inline-js-module-token:js-module'],
    ['CSS imported from <script setup>', '--inline-script-setup-css-token:script-setup-css'],
  ])('inlines CSS for %s', async (_, token) => {
    const html = await readFile(join(outputDir, 'public', 'js-imported-css/index.html'), 'utf-8')
    expect(html).toContain(token)
    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(cssLinks).toEqual([])
  })
})
