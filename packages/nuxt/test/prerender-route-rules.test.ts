import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

describe('prerendering pages covered by route rules', () => {
  it('adds pages matching a `prerender` route rule to the prerender list', async () => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        routeRules: {
          '/admin/**': { prerender: true },
          '/about': { prerender: false },
        },
      },
    })

    try {
      await nuxt.callHook('pages:resolved', [
        { path: '/admin/settings', file: join(pagesFixtureDir, 'pages/index.vue') },
        { path: '/about', file: join(pagesFixtureDir, 'pages/index.vue') },
        { path: '/contact', file: join(pagesFixtureDir, 'pages/index.vue') },
      ])

      const nitro = (nuxt as any)._nitro
      nitro.options.prerender.routes = []
      await nuxt.callHook('nitro:build:before', nitro)

      expect(nitro.options.prerender.routes).toContain('/admin/settings')
      expect(nitro.options.prerender.routes).not.toContain('/about')
      expect(nitro.options.prerender.routes).not.toContain('/contact')
    } finally {
      await nuxt.close()
    }
  })

  it('omits routes already covered by a `prerender` route rule from the app manifest', async () => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        routeRules: { '/admin/**': { prerender: true } },
        experimental: { appManifest: true },
      },
    })

    try {
      const nitro = (nuxt as any)._nitro
      const payloadSuffix = nuxt.options.experimental.renderJsonPayloads ? '/_payload.json' : '/_payload.js'
      nitro._prerenderedRoutes = [
        { route: `/admin/settings${payloadSuffix}` },
        { route: `/about${payloadSuffix}` },
      ]

      await nitro.hooks.callHook('rollup:before', nitro)

      const buildId = nuxt.options.runtimeConfig.app.buildId
      const manifestPath = join(nuxt.options.buildDir, 'manifest/meta', `${buildId}.json`)
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { prerendered: string[] }

      expect(manifest.prerendered).toEqual(['/about'])
    } finally {
      await nuxt.close()
    }
  })
})
