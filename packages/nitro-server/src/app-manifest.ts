import { promises as fsp } from 'node:fs'
import type { Nuxt } from '@nuxt/schema'
import { join, resolve } from 'pathe'
import { joinURL } from 'ufo'
import type { NitroConfig } from 'nitro/types'
import { addTemplate } from '@nuxt/kit'
import { defu } from 'defu'

import { createNormalizedRouteRulesRouter, mergeMethodRouteRulesRoutes, normalizeRouteRuleLookupPath } from '@nuxt/kit/internal'
import { relativeWithDot } from './utils.ts'

/**
 * Serve the app manifest: the id of the build, and the routes prerendered without a
 * `prerender` route rule, which the client reads to tell which routes have a payload file.
 */
export function setupAppManifest (nuxt: Nuxt, nitroConfig: NitroConfig, options: { baseURL: string, typesDir: string }): void {
  const buildId = nuxt.options.runtimeConfig.app.buildId ||= nuxt.options.buildId
  const buildTimestamp = Date.now()

  const manifestPrefix = joinURL(nuxt.options.app.buildAssetsDir, 'builds')
  const tempDir = join(nuxt.options.buildDir, 'manifest')

  nitroConfig.prerender ||= {}
  nitroConfig.prerender.ignore ||= []
  nitroConfig.prerender.ignore.push(joinURL(options.baseURL, manifestPrefix))

  nitroConfig.publicAssets!.unshift(
    // build manifest
    {
      dir: join(tempDir, 'meta'),
      maxAge: 31536000 /* 1 year */,
      baseURL: joinURL(manifestPrefix, 'meta'),
    },
    // latest build
    {
      dir: tempDir,
      maxAge: 1,
      baseURL: manifestPrefix,
    },
  )

  nuxt.options.alias['#app-manifest'] = join(tempDir, `meta/${buildId}.json`)

  // keeps the generated tsconfigs independent of the build id
  addTemplate({
    filename: 'types/app-manifest.d.ts',
    dependsOn: [],
    getContents: () => 'declare const manifest: { id: string, timestamp: number, prerendered: string[] }\nexport default manifest\n',
  })
  nuxt.hook('prepare:types', ({ tsConfig }) => {
    tsConfig.compilerOptions ||= {}
    tsConfig.compilerOptions.paths ||= {}
    tsConfig.compilerOptions.paths['#app-manifest'] = [relativeWithDot(options.typesDir, resolve(nuxt.options.buildDir, 'types/app-manifest'))]
  })

  // write stub manifest before build so external import of #app-manifest can be resolved
  if (!nuxt.options._prepare && (!nuxt.options.dev || nuxt.options.experimental.nitroViteEnvironment)) {
    nuxt.hook('build:before', async () => {
      await fsp.mkdir(join(tempDir, 'meta'), { recursive: true })
      await fsp.writeFile(join(tempDir, `meta/${buildId}.json`), JSON.stringify({
        id: buildId,
        timestamp: buildTimestamp,
        prerendered: [],
      }))
    })
  }

  nuxt.hook('nitro:config', (config) => {
    config.alias ||= {}
    config.alias['#app-manifest'] = join(tempDir, `meta/${buildId}.json`)
  })

  nuxt.hook('nitro:init', (nitro) => {
    const isEnvApi = nuxt.options.experimental.nitroViteEnvironment
    async function writeAppManifest (target?: 'public') {
      // Add pages prerendered but not covered by route rules
      const prerenderedRoutes = new Set<string>()
      if (nitro._prerenderedRoutes?.length) {
        const payloadSuffix = '/_payload.json'
        const caseSensitiveRouteRules = !!nuxt.options.router.options.sensitive
        const routeRulesMatcher = createNormalizedRouteRulesRouter(nitro.routing.routeRules.routes, nitro.options.baseURL, !caseSensitiveRouteRules)
        for (const route of nitro._prerenderedRoutes) {
          if (!route.error && route.route.endsWith(payloadSuffix)) {
            const url = route.route.slice(0, -payloadSuffix.length) || '/'
            const rules = defu({}, ...routeRulesMatcher.matchAll('', normalizeRouteRuleLookupPath(url, !caseSensitiveRouteRules)).reverse()) as Record<string, any>
            if (!rules.prerender) {
              prerenderedRoutes.add(url)
            }
          }
        }
      }

      const manifest = {
        id: buildId,
        timestamp: buildTimestamp,
        prerendered: nuxt.options.dev ? [] : [...prerenderedRoutes].sort(),
      }

      const dir = target === 'public'
        ? join(nitro.options.output.publicDir, manifestPrefix)
        : tempDir
      await fsp.mkdir(join(dir, 'meta'), { recursive: true })
      await fsp.writeFile(join(dir, 'latest.json'), JSON.stringify({
        id: buildId,
        timestamp: buildTimestamp,
      }))
      await fsp.writeFile(join(dir, `meta/${buildId}.json`), JSON.stringify(manifest))
    }
    // seed the manifest so `#app-manifest` resolves during bundling,
    // and refresh it after prerendering with the actual prerendered routes.
    // As a vite environment, nitro empties its output directory once the build
    // starts, so the final copy is emitted once public assets have been copied.
    nitro.hooks.hook('build:config', () => writeAppManifest())
    if (isEnvApi) {
      nitro.hooks.hook('compiled', () => writeAppManifest('public'))
    }
    nitro.hooks.hook('prerender:done', () => writeAppManifest(isEnvApi ? 'public' : undefined))
  })
}

const CATCH_ALL_RE = /(?:\/\*\*(?::[^/]+)?|:\w+[*+])$/
const TRAILING_SLASHES_RE = /\/+$/
const PAYLOAD_RULE_KEYS = ['isr', 'cache', 'redirect', 'proxy', 'headers', 'cors']

/**
 * Add a `_payload.json` route rule for every route that sets its own caching, redirect, proxy,
 * headers or cors, is rendered only on the client, or in development is prerendered, so its
 * payload URL resolves to the same server rules as the route.
 */
export function setupPayloadRouteRules (nuxt: Nuxt): void {
  if (nuxt.options.dev) {
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.prerender ||= {}
      nitroConfig.prerender.routes ||= []
      nitroConfig.routeRules ||= {}
      for (const route of nitroConfig.prerender.routes) {
        if (!route) { continue }
        nitroConfig.routeRules[route] = defu(nitroConfig.routeRules[route], { prerender: true })
      }
    })
  }
  nuxt.hook('nitro:init', (nitro) => {
    nitro.hooks.hook('build:before', (nitro) => {
      const updatedRules: Record<string, Record<string, any>> = {}
      const fold = !nuxt.options.router.options.sensitive
      const routes = mergeMethodRouteRulesRoutes(nitro.routing.routeRules.routes)
      const matcher = createNormalizedRouteRulesRouter(routes, '', fold)
      const resolveRules = (path: string) => defu({}, ...matcher.matchAll('', normalizeRouteRuleLookupPath(path, fold)).reverse()) as Record<string, any>
      for (const { route, data: value } of routes) {
        if (route === '/__nuxt_error' || CATCH_ALL_RE.test(route) || route.endsWith('/_payload.json')) { continue }
        const payloadKey = route.replace(TRAILING_SLASHES_RE, '') + '/_payload.json'
        const ssr = defu(value, resolveRules(route)).ssr !== false
        const keys = [...PAYLOAD_RULE_KEYS, ...nuxt.options.dev && ssr ? ['prerender'] : []].filter(key => key in value)
        if (!keys.length && (ssr || resolveRules(payloadKey).ssr === false)) { continue }
        const defaults: Record<string, any> = { ssr }
        for (const key of keys) {
          defaults[key] = value[key]
        }
        updatedRules[payloadKey] = defu(nitro.options.routeRules[payloadKey], defaults)
      }
      if (Object.keys(updatedRules).length === 0) { return }
      nitro.options.routeRules = { ...nitro.options.routeRules, ...updatedRules }
      nitro.routing.sync()
    })
  })
}
