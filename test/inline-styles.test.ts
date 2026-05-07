import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { builder, isBuilt, projectSuffix } from './matrix'

describe.skipIf(builder !== 'vite' || !isBuilt)('inline styles dedupe (#30435)', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/inline-styles-dedupe', import.meta.url))

  beforeAll(async () => {
    const result = await exec('pnpm', ['nuxt', 'generate', rootDir])
    if (result.exitCode !== 0) {
      throw new Error(`nuxt generate failed:\n${result.stderr}\n${result.stdout}`)
    }
  }, 120 * 1000)

  const outputDir = join(rootDir, `.output-${projectSuffix}`)

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
})
