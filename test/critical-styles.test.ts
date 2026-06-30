import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { builder, isBuilt, projectSuffix } from './matrix'

describe.skipIf(builder !== 'vite' || !isBuilt)('critical styles', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/critical-styles', import.meta.url))

  async function generate (mode: '' | 'true' | 'options') {
    const result = await exec('pnpm', ['nuxt', 'generate', rootDir], {
      nodeOptions: { env: { ...process.env, NUXT_TEST_CRITICAL: mode } },
    })
    if (result.exitCode !== 0) {
      throw new Error(`nuxt generate (mode=${mode || 'off'}) failed:\n${result.stderr}\n${result.stdout}`)
    }
  }

  const readOutput = (suffix: string) => readFile(join(rootDir, `.output-${projectSuffix}${suffix}`, 'public', 'index.html'), 'utf-8')

  const readOutputPage = (suffix: string, page: string) => readFile(join(rootDir, `.output-${projectSuffix}${suffix}`, 'public', page, 'index.html'), 'utf-8')

  let enabledHtml = ''
  let enabledSpaHtml = ''
  let optionsHtml = ''
  let disabledHtml = ''

  beforeAll(async () => {
    await generate('true')
    await generate('options')
    await generate('')
    enabledHtml = await readOutput('-critical')
    enabledSpaHtml = await readOutputPage('-critical', 'spa')
    optionsHtml = await readOutput('-options')
    disabledHtml = await readOutput('')
  }, 360 * 1000)

  const inlinedCss = (html: string) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]!).join('')

  describe('with criticalStyles disabled', () => {
    it('still inlines component styles via inlineStyles', () => {
      expect(inlinedCss(disabledHtml)).toMatch(/--component-token:\s*present/)
    })

    it('keeps the global stylesheet render-blocking', () => {
      expect(disabledHtml).toMatch(/<link [^>]*rel="stylesheet"/)
      expect(disabledHtml).not.toMatch(/rel="preload"[^>]*as="style"/)
      // the global CSS is external, so its critical rule is not inlined
      expect(inlinedCss(disabledHtml)).not.toContain('--global-critical')
    })
  })

  describe('with criticalStyles enabled', () => {
    it('inlines the critical rules of the global stylesheet and lazy-loads it', () => {
      const css = inlinedCss(enabledHtml)
      // rule matching the rendered DOM is inlined
      expect(css).toMatch(/--global-critical:\s*present/)
      // rule with no matching element is not inlined (stays in the lazy-loaded sheet)
      expect(css).not.toContain('--global-noncritical')
      // the render-blocking link is converted to a lazy preload
      expect(enabledHtml).toMatch(/<link [^>]*rel="preload"[^>]*as="style"/)
    })

    it('composes with inlineStyles without dropping inlined component styles', () => {
      // component styles inlined by inlineStyles remain intact
      expect(inlinedCss(enabledHtml)).toMatch(/--component-token:\s*present/)
    })

    it('does not prune component styles for elements absent from the server DOM (hydration safety)', () => {
      // `.client-only` is not server-rendered, but its styles must survive for post-hydration use
      expect(enabledHtml).not.toContain('class="client-only"')
      expect(inlinedCss(enabledHtml)).toMatch(/--hydration-token:\s*present/)
    })
  })

  describe('with a non-server-rendered (ssr: false) route', () => {
    it('does not run beasties on the SPA shell', () => {
      // critical CSS must come from server-rendered markup, so the SPA shell is left untouched
      expect(enabledSpaHtml).toMatch(/<link [^>]*rel="stylesheet"/)
      expect(enabledSpaHtml).not.toMatch(/rel="preload"[^>]*as="style"/)
      expect(inlinedCss(enabledSpaHtml)).not.toContain('--global-critical')
    })
  })

  describe('with criticalStyles as an options object', () => {
    it('forwards beasties options to override behaviour', () => {
      const css = inlinedCss(optionsHtml)
      // normal critical rule is still inlined
      expect(css).toMatch(/--global-critical:\s*present/)
      // `allowRules: ['.global-unused']` forces a rule with no matching element to inline,
      // the opposite of the default behaviour — proving the options object reaches beasties
      expect(css).toMatch(/--global-noncritical:\s*present/)
    })
  })
})
