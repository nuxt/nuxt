import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { builder, isBuilt, projectSuffix } from './matrix'

describe.skipIf(builder !== 'vite' || !isBuilt)('relative baseURL', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/relative-base-url', import.meta.url))
  const outputDir = join(rootDir, `.output-${projectSuffix}`)

  beforeAll(async () => {
    const result = await exec('pnpm', ['nuxt', 'generate', rootDir])
    if (result.exitCode !== 0) {
      throw new Error(`nuxt generate failed:\n${result.stderr}\n${result.stdout}`)
    }
  }, 120 * 1000)

  it('renders relative build asset paths for generated HTML', async () => {
    const html = await readFile(join(outputDir, 'public/index.html'), 'utf-8')
    const assetUrls = [...html.matchAll(/(?:href|src)="([^"]*\/_nuxt\/[^"]+)"/g)].map(match => match[1])

    expect(assetUrls.length).toBeGreaterThan(0)
    for (const url of assetUrls) {
      expect(url).toMatch(/^\.\/_nuxt\//)
    }
  })
})
