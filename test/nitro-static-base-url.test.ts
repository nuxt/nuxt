import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import { describe, expect, it, vi } from 'vitest'

import { runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/spa', import.meta.url))

describe.skipIf(!runsOnceInMatrix)('Nitro static SPA base URLs', () => {
  it.each([
    ['relative', './'],
    ['absolute', '/prefix/'],
  ])('writes SPA documents with the %s base URL', async (name, baseURL) => {
    const cacheDir = join(rootDir, 'node_modules/.cache/nuxt', `static-base-${name}`)
    const outputDir = join(cacheDir, 'output')
    vi.stubEnv('NUXT_APP_BASE_URL', baseURL)
    try {
      const nuxt = await loadNuxt({
        cwd: rootDir,
        ready: true,
        overrides: {
          buildDir: join(cacheDir, 'build'),
          nitro: { static: true, output: { dir: outputDir } },
        },
      })
      try {
        await buildNuxt(nuxt)
      } finally {
        await nuxt.close()
      }
    } finally {
      vi.unstubAllEnvs()
    }

    const publicDir = join(outputDir, 'public')
    for (const page of ['index.html', '200.html', '404.html']) {
      const html = await readFile(join(publicDir, page), 'utf-8')
      expect(html, page).toContain(`<script type="module" src="${baseURL}_nuxt/`)
      const src = html.match(/<script type="module" src="([^"]+)"/)?.[1]
      await expect(readFile(join(publicDir, src!.slice(baseURL.length)), 'utf-8')).resolves.toBeTruthy()
    }
  }, 240_000)
})
