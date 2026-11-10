import { resolve } from 'pathe'
import { addComponent, addPlugin, addPluginTemplate, addRouteMiddleware, directoryToURL } from '@nuxt/kit'
import { configDiagnostics } from '@nuxt/kit/internal'
import { readPackageJSON } from 'pkg-types'
import type { PackageJson } from 'pkg-types'
import { resolveModulePath } from 'exsolve'
import { satisfies } from 'verkit'
import type { AddComponentOptions } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'

import { BUILTIN_COMPONENT_META, getBuiltinComponentMeta } from '../components/builtin-metadata.ts'
import type { BuiltinComponentName } from '../components/builtin-metadata.ts'

type BuiltinComponent = [name: string, file: string, options?: Partial<AddComponentOptions>]

const builtinComponents: BuiltinComponent[] = [
  ['NuxtLayout', 'nuxt-layout'],
  ['NuxtErrorBoundary', 'nuxt-error-boundary'],
  ['ClientOnly', 'client-only'],
  ['DevOnly', 'dev-only'],
  ['ServerPlaceholder', 'server-placeholder'],
  ['NuxtLink', 'nuxt-link'],
  ['NuxtLoadingIndicator', 'nuxt-loading-indicator'],
  ['NuxtTime', 'nuxt-time.vue'],
  ['NuxtRouteAnnouncer', 'nuxt-route-announcer', { mode: 'client' }],
  ['NuxtAnnouncer', 'nuxt-announcer', { mode: 'client' }],
]

function addBuiltinComponent (nuxt: Nuxt, [name, file, options]: BuiltinComponent) {
  addComponent({
    name,
    // built-ins that users are not expected to override
    priority: 10,
    filePath: resolve(nuxt.options.appDir, 'components', file),
    ...name in BUILTIN_COMPONENT_META && { meta: getBuiltinComponentMeta(name as BuiltinComponentName) },
    ...options,
  })
}

export function addAppPlugin (nuxt: Nuxt, name: string) {
  addPlugin(resolve(nuxt.options.appDir, 'plugins', name))
}

function isPagesEnabled (nuxt: Nuxt) {
  return nuxt.options.pages !== false && (nuxt.options.pages as { enabled?: boolean } | undefined)?.enabled !== false
}

/**
 * Built-in components and app plugins registered before modules are installed, so that modules
 * can see (and override) them.
 */
export function addBuiltinsBeforeModules (nuxt: Nuxt) {
  // TODO: revert when deep server component config is properly bundle-split: https://github.com/nuxt/nuxt/pull/29956
  const islandsConfig = nuxt.options.experimental.componentIslands
  if (nuxt.options.dev || !(typeof islandsConfig === 'object' && islandsConfig.selectiveClient === 'deep')) {
    addBuiltinComponent(nuxt, ['NuxtWelcome', 'welcome'])
  }

  for (const component of builtinComponents) {
    addBuiltinComponent(nuxt, component)
  }

  if (nuxt.options.experimental.clientFallback) {
    for (const mode of ['client', 'server'] as const) {
      addBuiltinComponent(nuxt, ['NuxtClientFallback', `client-fallback.${mode}`, { _raw: true, mode }])
    }
  }

  for (const name of ['NuxtImg', 'NuxtPicture'] as const) {
    addComponent({
      name,
      export: name,
      priority: -1,
      filePath: resolve(nuxt.options.appDir, 'components/nuxt-stubs'),
      meta: getBuiltinComponentMeta(name),
      // @ts-expect-error TODO: refactor to @nuxt/cli
      _internal_install: '@nuxt/image',
    })
  }

  const { debug } = nuxt.options
  if (debug && debug.hooks && (debug.hooks === true || debug.hooks.client)) {
    addAppPlugin(nuxt, 'debug-hooks')
  }

  // https://developer.chrome.com/docs/devtools/performance/extension
  if (nuxt.options.experimental.browserDevtoolsTiming) {
    addAppPlugin(nuxt, 'browser-devtools-timing.client')
  }
}

/**
 * Built-in components and app plugins that depend on options modules may change.
 */
export async function addBuiltinsAfterModules (nuxt: Nuxt) {
  const { experimental } = nuxt.options

  if (experimental.componentIslands) {
    addBuiltinComponent(nuxt, ['NuxtIsland', 'nuxt-island'])
  }

  if (experimental.deferPrefetchHints) {
    addAppPlugin(nuxt, 'deferred-prefetch.client')
  }

  if (experimental.crossOriginPrefetch) {
    addAppPlugin(nuxt, 'cross-origin-prefetch.client')
  }

  // route chunk errors require route-level chunks and client-side navigation
  if (isPagesEnabled(nuxt)) {
    if (experimental.componentIslands) {
      addAppPlugin(nuxt, 'island-link-navigation.client')
    }
    if (experimental.emitRouteChunkError === 'automatic') {
      addAppPlugin(nuxt, 'chunk-reload.client')
    }
    if (experimental.emitRouteChunkError === 'automatic-immediate') {
      addAppPlugin(nuxt, 'chunk-reload-immediate.client')
    }
    // crawlers reload when a chunk fails during initial hydration, so they index the
    // server-rendered HTML rather than a blank page
    if (experimental.emitRouteChunkError) {
      addAppPlugin(nuxt, 'chunk-reload-crawler.client')
    }
  }

  if (experimental.restoreState) {
    addAppPlugin(nuxt, 'restore-state.client')
  }

  if (experimental.viewTransition) {
    addAppPlugin(nuxt, 'view-transitions.client')
  }

  if (experimental.renderJsonPayloads) {
    addAppPlugin(nuxt, 'revive-payload.server')
  }

  addRouteMiddleware({
    name: 'manifest-route-rule',
    path: resolve(nuxt.options.appDir, 'middleware/route-rules'),
    global: true,
  })

  if (experimental.appManifest && experimental.checkOutdatedBuildInterval !== false) {
    addAppPlugin(nuxt, 'check-outdated-build.client')
  }

  if (experimental.navigationRepaint) {
    addAppPlugin(nuxt, 'navigation-repaint.client')
  }

  if (nuxt.options.vue.vapor) {
    if (await vueSupportsVapor(nuxt)) {
      addAppPlugin(nuxt, 'vapor-interop.client')
    } else {
      nuxt.options.vue.vapor = false
      configDiagnostics.NUXT_B5024()
    }
  }

  if (nuxt.options.vue.config && Object.values(nuxt.options.vue.config).some(v => v !== null && v !== undefined)) {
    addPluginTemplate({
      filename: 'vue-app-config.mjs',
      dependsOn: [],
      getContents: () => `
import { defineNuxtPlugin } from '#app/nuxt'
export default defineNuxtPlugin({
  name: 'nuxt:vue-app-config',
  enforce: 'pre',
  setup (nuxtApp) {
    ${Object.keys(nuxt.options.vue.config!).map(k => `    nuxtApp.vueApp.config[${JSON.stringify(k)}] = ${JSON.stringify(nuxt.options.vue.config![k as 'idPrefix'])}`).join('\n')}
  }
})`,
    })
  }
}

/**
 * App plugins that depend on the server build configuration.
 */
export function addBuiltinsAfterServer (nuxt: Nuxt) {
  if (nuxt.options.experimental.renderJsonPayloads && nuxt.options.ssr !== false) {
    addAppPlugin(nuxt, 'revive-payload.client')
  }

  if (nuxt.options.experimental.payloadExtraction) {
    // payloads are only loaded during client-side navigation
    if (isPagesEnabled(nuxt)) {
      addAppPlugin(nuxt, 'payload.client')
    }
    if (nuxt.options.experimental.prefetchPreloadTags) {
      addAppPlugin(nuxt, 'prefetch-preload-tags.server')
    }
  }
}

async function vueSupportsVapor (nuxt: Nuxt) {
  const path = resolveModulePath('vue/package.json', {
    from: [directoryToURL(nuxt.options.rootDir), directoryToURL(nuxt.options.workspaceDir), import.meta.url],
    try: true,
  })
  if (!path) { return false }
  const { version } = await readPackageJSON(path).catch(() => ({}) as PackageJson)
  return !!version && satisfies(version, '>=3.6.0-rc.6')
}
