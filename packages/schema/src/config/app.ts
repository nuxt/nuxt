import process from 'node:process'
import { defu } from 'defu'
import { resolve } from 'pathe'
import { booleanOr, defineResolvers } from '../utils/definition.ts'
import { schemaDiagnostics } from '../diagnostics.ts'
import type { AppHeadMetaObject } from '../types/head.ts'
import type { NuxtAppConfig, ViewTransitionOptions } from '../types/config.ts'

function resolveDynamic (val: unknown): unknown {
  return typeof val === 'function' ? (val as () => unknown)() : val
}

function normalizeRoutePrefix (val: string): string {
  return val.replace(/^\/?/, '/').replace(/\/?$/, '/')
}

function normalizeRoutePath (val: string): string {
  return val.replace(/^\/?/, '/').replace(/\/+$/, '') || '/'
}

function normalizePathSegment (val: string): string {
  return val.replace(/^\/+|\/+$/g, '')
}

export default defineResolvers({
  vue: {
    transformAssetUrls: {
      video: ['src', 'poster'],
      source: ['src'],
      img: ['src'],
      image: ['xlink:href', 'href'],
      use: ['xlink:href', 'href'],
    },
    compilerOptions: {},
    runtimeCompiler: booleanOr(false),
    optionsApi: booleanOr(false),

    /**
     * Enable experimental support for Vue Vapor Mode (requires Vue 3.6+).
     *
     * This installs Vue's `vaporInteropPlugin` so that vapor components (SFCs using
     * `<script setup vapor>` or `<template vapor>`) can be used alongside regular
     * VDOM components.
     * @see [Vue Vapor Mode release notes](https://github.com/vuejs/core/releases/tag/v3.6.0-rc.1)
     */
    vapor: booleanOr(false),
    propsDestructure: true,

    config: {},
  },
  app: {
    baseURL: {
      $resolve: (val) => {
        if (typeof val === 'string') {
          return val
        }
        return process.env.NUXT_APP_BASE_URL || '/'
      },
    },
    buildAssetsDir: {
      $resolve: (val) => {
        const dir = typeof val === 'string' ? val : (process.env.NUXT_APP_BUILD_ASSETS_DIR || '/_nuxt/')
        // normalised so consumers can compare it directly against request paths
        return dir.replace(/^\/?/, '/').replace(/\/?$/, '/')
      },
    },

    cdnURL: {
      $resolve: async (val, get) => {
        if (await get('dev')) {
          return ''
        }
        return process.env.NUXT_APP_CDN_URL || (typeof val === 'string' ? val : '')
      },
    },

    head: {
      $resolve: (_val) => {
        const val: Partial<NuxtAppConfig['head']> = _val && typeof _val === 'object' ? _val : {}

        type NormalizedMetaObject = Required<Pick<AppHeadMetaObject, 'meta' | 'link' | 'style' | 'script' | 'noscript'>>

        const resolved: NuxtAppConfig['head'] & NormalizedMetaObject = defu(val, {
          meta: [],
          link: [],
          style: [],
          script: [],
          noscript: [],
        } satisfies NormalizedMetaObject)

        // provides default charset and viewport if not set
        if (!resolved.meta.find(m => m?.charset)?.charset) {
          resolved.meta.unshift({ charset: resolved.charset || 'utf-8' })
        }
        if (!resolved.meta.find(m => m?.name === 'viewport')?.content) {
          resolved.meta.unshift({ name: 'viewport', content: resolved.viewport || 'width=device-width, initial-scale=1' })
        }

        resolved.meta = resolved.meta.filter(Boolean)
        resolved.link = resolved.link.filter(Boolean)
        resolved.style = resolved.style.filter(Boolean)
        resolved.script = resolved.script.filter(Boolean)
        resolved.noscript = resolved.noscript.filter(Boolean)

        return resolved
      },
    },
    layoutTransition: false,
    pageTransition: false,
    viewTransition: {
      $resolve: async (val, get) => {
        const isEnabled = (val === 'always' || typeof val === 'boolean')
        const hasEnabled = val && typeof val === 'object' && 'enabled' in val
        const hasTypes = val && typeof val === 'object' && 'types' in val

        const appOptions: Partial<ViewTransitionOptions> = {
          enabled: isEnabled ? val : (hasEnabled ? val.enabled as ViewTransitionOptions['enabled'] : undefined),
          types: hasTypes ? val.types as ViewTransitionOptions['types'] : undefined,
        }

        if (appOptions.enabled !== undefined && appOptions.types !== undefined) {
          return appOptions as ViewTransitionOptions
        }

        const _configOptions = await get('experimental').then(e => e.viewTransition) ?? { enabled: false }
        const configOptions = typeof _configOptions === 'object' ? _configOptions : { enabled: _configOptions }

        return {
          enabled: appOptions.enabled ?? configOptions.enabled,
          types: appOptions.types ?? configOptions.types,
        }
      },
    },
    keepalive: false,
    rootId: {
      /** @type {string | false | (() => string | false)} */
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return resolved === false ? false : (resolved && typeof resolved === 'string' ? resolved : '__nuxt')
      },
    },
    rootTag: {
      $resolve: val => val && typeof val === 'string' ? val : 'div',
    },
    rootAttrs: {
      $resolve: async (val, get) => {
        const rootId = await get('app.rootId')
        return {
          id: rootId === false ? undefined : (rootId || '__nuxt'),
          ...typeof val === 'object' ? val : {},
        }
      },
    },
    teleportTag: {
      $resolve: val => val && typeof val === 'string' ? val : 'div',
    },
    teleportId: {
      /** @type {string | false | (() => string | false)} */
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return resolved === false ? false : (resolved && typeof resolved === 'string' ? resolved : 'teleports')
      },
    },
    teleportAttrs: {
      $resolve: async (val, get) => {
        const teleportId = await get('app.teleportId')
        return {
          id: teleportId === false ? undefined : (teleportId || 'teleports'),
          ...typeof val === 'object' ? val : {},
        }
      },
    },
    spaLoaderTag: {
      $resolve: val => val && typeof val === 'string' ? val : 'div',
    },
    spaLoaderAttrs: {
      $resolve: (val) => {
        const resolved = val && typeof val === 'object' ? val as Record<string, unknown> : {}
        const id = 'id' in resolved
          ? (resolved.id === false ? undefined : resolved.id)
          : '__nuxt-loader'
        return {
          ...resolved,
          id,
        }
      },
    },
    /**
     * `id` attribute of the inline hydration payload `<script>` tag, or `false` to omit it.
     * Accepts a string, `false`, or a generator function evaluated once per build.
     * @type {string | false | (() => string | false)}
     */
    payloadId: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false) { return false }
        return typeof resolved === 'string' && resolved ? resolved : '__NUXT_DATA__'
      },
    },
    /**
     * Attribute name used on the payload `<script>` tag to store `appId` (defaults to `'data-nuxt-data'`),
     * or `false` to omit the attribute when `payloadId` is set.
     * @type {string | false | (() => string | false)}
     */
    payloadDataAttr: {
      $resolve: async (val, get) => {
        const resolved = resolveDynamic(val)
        if (resolved === false) {
          return (await get('app.payloadId')) === false ? 'data-app-payload' : false
        }
        return typeof resolved === 'string' && resolved ? resolved : 'data-nuxt-data'
      },
    },
    /**
     * Attribute name used on the payload `<script>` tag to mark SSR mode (defaults to `'data-ssr'`),
     * or `false` to omit it and read SSR state from the payload/global instead.
     * @type {string | false | (() => string | false)}
     */
    ssrAttr: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false) { return false }
        return typeof resolved === 'string' && resolved ? resolved : 'data-ssr'
      },
    },
    /**
     * Name of the `window` global used to pass initial config (defaults to `'__NUXT__'`),
     * or `false` to emit no `window` global and fold config into the payload script instead.
     * @type {string | false | (() => string | false)}
     */
    globalName: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false) { return false }
        return typeof resolved === 'string' && resolved ? resolved : '__NUXT__'
      },
    },
    /**
     * Filename used for extracted route payloads (defaults to `'_payload.json'`).
     * @type {string | (() => string)}
     */
    payloadFileName: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return typeof resolved === 'string' && resolved ? resolved.replace(/^\/+/, '') : '_payload.json'
      },
    },
    /**
     * URL prefix used for server component island requests (defaults to `'/__nuxt_island/'`).
     * @type {string | (() => string)}
     */
    islandRoutePrefix: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return typeof resolved === 'string' && resolved ? normalizeRoutePrefix(resolved) : '/__nuxt_island/'
      },
    },
    /**
     * Internal route path used to render SSR error pages (defaults to `'/__nuxt_error'`).
     * @type {string | (() => string)}
     */
    errorRoute: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return typeof resolved === 'string' && resolved ? normalizeRoutePath(resolved) : '/__nuxt_error'
      },
    },
    /**
     * Query parameter name carrying the serialized error payload to `errorRoute` (defaults to `'__nuxt_error_payload'`).
     * @type {string | (() => string)}
     */
    errorQueryParam: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return typeof resolved === 'string' && resolved ? resolved : '__nuxt_error_payload'
      },
    },
    /**
     * Attribute name on the inert `<template>` holding deferred prefetch links (defaults to `'data-nuxt-prefetch'`).
     * @type {string | (() => string)}
     */
    prefetchAttr: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        return typeof resolved === 'string' && resolved ? resolved : 'data-nuxt-prefetch'
      },
    },
    /**
     * Global function name attached to `window` (defaults to `'useNuxtApp'`), or `false` to avoid exposing it globally.
     * @type {string | false | (() => string | false)}
     */
    exposeGlobal: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false) { return false }
        return typeof resolved === 'string' && resolved ? resolved : 'useNuxtApp'
      },
    },
    /**
     * Whether to expose the Nuxt framework version on `nuxtApp.versions.nuxt` (defaults to `true`).
     */
    exposeVersion: booleanOr(true),
    /**
     * Directory inside `buildAssetsDir` holding app build manifests (defaults to `'builds'`).
     * @type {string | (() => string)}
     */
    manifestDir: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        const normalized = typeof resolved === 'string' ? normalizePathSegment(resolved) : ''
        return normalized || 'builds'
      },
    },
    /**
     * Subdirectory inside `manifestDir` holding per-build manifest files (defaults to `'meta'`).
     * @type {string | (() => string)}
     */
    manifestMetaDir: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        const normalized = typeof resolved === 'string' ? normalizePathSegment(resolved) : ''
        return normalized || 'meta'
      },
    },
    /**
     * Filename inside `manifestDir` holding the latest build metadata (defaults to `'latest.json'`).
     * @type {string | (() => string)}
     */
    manifestLatestFile: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        const normalized = typeof resolved === 'string' ? resolved.replace(/^\/+/, '') : ''
        return normalized || 'latest.json'
      },
    },
    /**
     * CSS class applied to `<NuxtLoadingIndicator>` (defaults to `'nuxt-loading-indicator'`), or `false` to omit it.
     * @type {string | false | (() => string | false)}
     */
    loadingIndicatorClass: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false || resolved === '') { return false }
        return typeof resolved === 'string' ? resolved : 'nuxt-loading-indicator'
      },
    },
    /**
     * CSS class applied to `<NuxtAnnouncer>` (defaults to `'nuxt-announcer'`), or `false` to omit it.
     * @type {string | false | (() => string | false)}
     */
    announcerClass: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false || resolved === '') { return false }
        return typeof resolved === 'string' ? resolved : 'nuxt-announcer'
      },
    },
    /**
     * CSS class applied to `<NuxtRouteAnnouncer>` (defaults to `'nuxt-route-announcer'`), or `false` to omit it.
     * @type {string | false | (() => string | false)}
     */
    routeAnnouncerClass: {
      $resolve: (val) => {
        const resolved = resolveDynamic(val)
        if (resolved === false || resolved === '') { return false }
        return typeof resolved === 'string' ? resolved : 'nuxt-route-announcer'
      },
    },
  },
  spaLoadingTemplate: {
    $resolve: async (val, get) => {
      if (typeof val === 'string') {
        return resolve(await get('srcDir'), val)
      }
      if (typeof val === 'boolean') {
        return val
      }
      return null
    },
  },
  plugins: [],
  css: {
    $resolve: (val) => {
      if (!Array.isArray(val)) {
        return []
      }
      const css: string[] = []
      for (const item of val) {
        if (typeof item === 'string') {
          css.push(item)
        }
      }
      return css
    },
  },
  unhead: {
    legacy: {
      $resolve: (val) => {
        if (val === true) {
          schemaDiagnostics.NUXT_B5013()
        }
        return false
      },
    },
    vite: {},
    renderSSRHeadOptions: {
      $resolve: (val: unknown) => ({
        omitLineBreaks: true,
        ...typeof val === 'object' ? val : {},
      }),
    },
  },
})
