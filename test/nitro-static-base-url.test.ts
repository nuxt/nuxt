import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { NuxtConfig } from 'nuxt/schema'
import { join } from 'pathe'
import { describe, expect, it, vi } from 'vitest'

import { nitroMajor, runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/spa', import.meta.url))

describe.skipIf(!runsOnceInMatrix)('static output base URLs', () => {
  // AI-generated test; not yet reviewed by a human.
  it.each<[name: string, overrides: NuxtConfig, expectFallback: boolean, initialRoutes: string[]]>([
    ['root enabled', {}, false, ['/']],
    ['both index routes configured', {}, false, ['/', '/index.html']],
    ['root ignored', { nitro: { prerender: { ignore: [/^\/$/] } } }, true, ['/']],
    ['root ignored by function', { nitro: { prerender: { ignore: [(path: string) => path === '/'] } } }, true, ['/']],
    ['root disabled by route rule', { routeRules: { '/': { prerender: false } } }, true, ['/']],
  ])('avoids duplicate index output when %s', async (name, overrides, expectFallback, initialRoutes) => {
    const cacheDir = join(rootDir, 'node_modules/.cache/nuxt', `static-index-nitro${nitroMajor || 2}-${name.replaceAll(' ', '-')}`)
    const outputDir = join(cacheDir, 'output')
    let routes: string[] = []
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        ...overrides,
        ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
        buildDir: join(cacheDir, 'build'),
        nitro: { ...overrides.nitro, static: true, prerender: { ...overrides.nitro?.prerender, routes: initialRoutes }, output: { dir: outputDir } },
        hooks: {
          'nitro:build:before' (nitro) {
            nitro.hooks.hook('prerender:routes', (entries) => { routes = [...entries] })
          },
        },
      },
    })
    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }
    expect(routes).toContain('/')
    if (nitroMajor !== 3) {
      expect(routes.includes('/index.html')).toBe(expectFallback)
    }
    for (const file of ['index.html', '200.html', '404.html']) {
      const html = await readFile(join(outputDir, 'public', file), 'utf8')
      expect(html.match(/<\/html>/g), file).toHaveLength(1)
    }
  }, 240_000)

  it.each<[name: string, baseURL: string, overrides: NuxtConfig]>([
    ['relative-spa', './', { nitro: { static: true } }],
    ['relative-spa-preset', './', { nitro: { preset: 'static' } }],
    ['relative-ssr', './', { ssr: true, nitro: { static: true } }],
    ['absolute-spa', '/prefix/', { nitro: { static: true } }],
  ])('writes documents for %s with the %s base URL', async (name, baseURL, overrides) => {
    const cacheDir = join(rootDir, 'node_modules/.cache/nuxt', `static-base-${name}`)
    const outputDir = join(cacheDir, 'output')
    vi.stubEnv('NUXT_APP_BASE_URL', baseURL)
    try {
      const nuxt = await loadNuxt({
        cwd: rootDir,
        ready: true,
        overrides: {
          ...overrides,
          ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
          buildDir: join(cacheDir, 'build'),
          nitro: { ...overrides.nitro, output: { dir: outputDir } },
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
