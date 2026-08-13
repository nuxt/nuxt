import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { isBuilt, projectSuffix, runsOnceInMatrix } from './matrix'

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

  // https://github.com/nuxt/nuxt/issues/35715
  it.runIf(isBuilt)('inline entry component CSS including not rendered in SSR', async () => {
    const html = await readFile(join(outputDir, 'public', 'index.html'), 'utf-8')
    expect(html).toContain('--inline-some-component-token:some-component')

    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(cssLinks).toEqual([])
  })

  // https://github.com/nuxt/nuxt/issues/35255
  it('drops duplicate stylesheet links for fully inlined CSS in a shared chunk', async () => {
    for (const page of ['shared-a', 'shared-b']) {
      const html = await readFile(join(outputDir, 'public', page, 'index.html'), 'utf-8')
      expect(html, page).toContain('--inline-shared-box-token:shared-box')

      const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
      expect(cssLinks, page).toEqual([])
    }
  })

  it('keeps a stylesheet link for CSS a page does not inline itself', async () => {
    const html = await readFile(join(outputDir, 'public', 'shared-css-via-js', 'index.html'), 'utf-8')
    expect(html).toContain('--inline-shared-css-via-js-token:shared-css-via-js')

    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(cssLinks.length).toBeGreaterThan(0)

    const linked = await Promise.all(cssLinks.map(href => readFile(join(outputDir, 'public', href.replace(/^\//, '')), 'utf-8')))
    expect(linked.join('\n')).toContain('--inline-shared-with-js-module-token:shared-with-js-module')
  })

  // https://github.com/nuxt/nuxt/issues/36058
  it('keeps a stylesheet link for a component the route does not server-render', async () => {
    const html = await readFile(join(outputDir, 'public', 'client-only', 'index.html'), 'utf-8')
    const inlinedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!).join('\n')
    expect(inlinedStyles).not.toContain('--inline-shared-box-token:shared-box')

    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    const linked = await Promise.all(cssLinks.map(href => readFile(join(outputDir, 'public', href.replace(/^\//, '')), 'utf-8')))
    expect(linked.join('\n')).toContain('--inline-shared-box-token:shared-box')
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
  // https://github.com/nuxt/nuxt/issues/35591
  it('inlined SSR CSS class names match rendered markup when generateScopedName is a string pattern', async () => {
    const html = await readFile(join(outputDir, 'public', 'css-modules-scoped/index.html'), 'utf-8')

    const inlinedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!).join('\n')
    const rule = inlinedStyles.match(/\.([\w-]+)\s*\{[^}]*--inline-css-modules-scoped-token:\s*css-modules-scoped[^}]*\}/)
    expect(rule, 'CSS module rule was not inlined into the SSR response').toBeTruthy()

    const scopedClass = rule![1]!
    const markupClasses = new Set([...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(m => m[1]!.split(/\s+/)))
    expect(markupClasses).toContain(scopedClass)
  })

  // https://github.com/nuxt/nuxt/issues/29232
  it('SSR inline styles are transformed by Vite plugins for custom style attributes', async () => {
    const html = await readFile(join(outputDir, 'public', 'custom-layout/index.html'), 'utf-8')

    const inlinedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!).join('\n')
    expect(inlinedStyles).toContain('--inline-custom-layout-token:custom-layout')
    expect(inlinedStyles).toMatch(/\.xs\s*(?:\{\s*)?\.layout-container/)
  })

  it('inlines a shared CSS source for the page the `inlineStyles` predicate opts in', async () => {
    const html = await readFile(join(outputDir, 'public', 'predicate-inlined', 'index.html'), 'utf-8')
    const inlinedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!).join('\n')
    expect(inlinedStyles).toContain('--inline-predicate-shared-token:predicate-shared')
  })

  it('keeps the stylesheet link for the page the `inlineStyles` predicate opts out', async () => {
    const html = await readFile(join(outputDir, 'public', 'predicate-not-inlined', 'index.html'), 'utf-8')
    const inlinedStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!).join('\n')
    expect(inlinedStyles).not.toContain('--inline-predicate-shared-token:predicate-shared')

    const cssLinks = [...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    const linked = await Promise.all(cssLinks.map(href => readFile(join(outputDir, 'public', href.replace(/^\//, '')), 'utf-8')))
    expect(linked.join('\n')).toContain('--inline-predicate-shared-token:predicate-shared')
  })
})
