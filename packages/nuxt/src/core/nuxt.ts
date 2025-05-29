import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { join, normalize, relative, resolve } from 'pathe'
import { createDebugger, createHooks } from 'hookable'
import ignore from 'ignore'
import type { LoadNuxtOptions } from '@nuxt/kit'
import { addBuildPlugin, addComponent, addPlugin, addPluginTemplate, addRouteMiddleware, addServerHandler, addServerPlugin, addServerTemplate, addTypeTemplate, addVitePlugin, addWebpackPlugin, directoryToURL, installModule, loadNuxtConfig, nuxtCtx, resolveAlias, resolveFiles, resolveIgnorePatterns, runWithNuxtContext, useNitro } from '@nuxt/kit'
import type { Nuxt, NuxtHooks, NuxtModule, NuxtOptions } from 'nuxt/schema'
import type { PackageJson } from 'pkg-types'
import { readPackageJSON } from 'pkg-types'
import { hash } from 'ohash'
import consola from 'consola'
import onChange from 'on-change'
import { colors } from 'consola/utils'
import { formatDate, resolveCompatibilityDatesFromEnv } from 'compatx'
import type { DateString } from 'compatx'
import escapeRE from 'escape-string-regexp'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { ImpoundPlugin } from 'impound'
import defu from 'defu'
import { gt, satisfies } from 'semver'
import { hasTTY, isCI } from 'std-env'
import { genImport } from 'knitwork'
import { resolveModulePath } from 'exsolve'

import { installNuxtModule } from '../core/features'
import pagesModule from '../pages/module'
import metaModule from '../head/module'
import componentsModule from '../components/module'
import importsModule from '../imports/module'

import { distDir, pkgDir } from '../dirs'
import { version } from '../../package.json'
import { scriptsStubsPreset } from '../imports/presets'
import { logger } from '../utils'
import { resolveTypePath } from './utils/types'
import { createImportProtectionPatterns } from './plugins/import-protection'
import { UnctxTransformPlugin } from './plugins/unctx'
import { TreeShakeComposablesPlugin } from './plugins/tree-shake'
import { DevOnlyPlugin } from './plugins/dev-only'
import { LayerAliasingPlugin } from './plugins/layer-aliasing'
import { addModuleTranspiles } from './modules'
import { initNitro } from './nitro'
import schemaModule from './schema'
import { RemovePluginMetadataPlugin } from './plugins/plugin-metadata'
import { AsyncContextInjectionPlugin } from './plugins/async-context'
import { ComposableKeysPlugin } from './plugins/composable-keys'
import { ResolveDeepImportsPlugin } from './plugins/resolve-deep-imports'
import { ResolveExternalsPlugin } from './plugins/resolved-externals'
import { PrehydrateTransformPlugin } from './plugins/prehydrate'
import { VirtualFSPlugin } from './plugins/virtual'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = createHooks<NuxtHooks>()

  const { callHook, callHookParallel, callHookWith } = hooks
  hooks.callHook = (...args) => runWithNuxtContext(nuxt, () => callHook(...args))
  hooks.callHookParallel = (...args) => runWithNuxtContext(nuxt, () => callHookParallel(...args))
  hooks.callHookWith = (...args) => runWithNuxtContext(nuxt, () => callHookWith(...args))

  const nuxt: Nuxt = {
    __name: randomUUID(),
    _version: version,
    _asyncLocalStorageModule: options.experimental.debugModuleMutation ? new AsyncLocalStorage() : undefined,
    hooks,
    callHook: hooks.callHook,
    addHooks: hooks.addHooks,
    hook: hooks.hook,
    ready: () => runWithNuxtContext(nuxt, () => initNuxt(nuxt)),
    close: () => hooks.callHook('close', nuxt),
    vfs: {},
    apps: {},
    runWithContext: fn => runWithNuxtContext(nuxt, fn),
    options,
  }

  if (options.experimental.debugModuleMutation) {
    const proxiedOptions = new WeakMap<NuxtModule, NuxtOptions>()

    Object.defineProperty(nuxt, 'options', {
      get () {
        const currentModule = nuxt._asyncLocalStorageModule!.getStore()
        if (!currentModule) {
          return options
        }

        if (proxiedOptions.has(currentModule)) {
          return proxiedOptions.get(currentModule)!
        }

        nuxt._debug ||= {}
        nuxt._debug.moduleMutationRecords ||= []

        const proxied = onChange(options, (keys, newValue, previousValue, applyData) => {
          if (newValue === previousValue && !applyData) {
            return
          }
          let value = applyData?.args ?? newValue
          // Make a shallow copy of the value
          if (Array.isArray(value)) {
            value = [...value]
          } else if (typeof value === 'object') {
            value = { ...(value as any) }
          }
          nuxt._debug!.moduleMutationRecords!.push({
            module: currentModule,
            keys,
            target: 'nuxt.options',
            value,
            timestamp: Date.now(),
            method: applyData?.name,
          })
        }, {
          ignoreUnderscores: true,
          ignoreSymbols: true,
          pathAsArray: true,
        })

        proxiedOptions.set(currentModule, proxied)
        return proxied
      },
    })
  }

  if (!nuxtCtx.tryUse()) {
    // backward compatibility with 3.x
    nuxtCtx.set(nuxt)
    nuxt.hook('close', () => {
      nuxtCtx.unset()
    })
  }

  hooks.hookOnce('close', () => { hooks.removeAllHooks() })

  return nuxt
}

// TODO: update to nitro import
const fallbackCompatibilityDate = '2024-04-03' as DateString

const nightlies = {
  'nitropack': 'nitropack-nightly',
  'nitro': 'nitro-nightly',
  'h3': 'h3-nightly',
  'nuxt': 'nuxt-nightly',
  '@nuxt/schema': '@nuxt/schema-nightly',
  '@nuxt/kit': '@nuxt/kit-nightly',
}

export const keyDependencies = [
  '@nuxt/kit',
]

let warnedAboutCompatDate = false

async function initNuxt (nuxt: Nuxt) {
  // Register user hooks
  for (const config of nuxt.options._layers.map(layer => layer.config).reverse()) {
    if (config.hooks) {
      nuxt.hooks.addHooks(config.hooks)
    }
  }

  // Prompt to set compatibility date
  nuxt.options.compatibilityDate = resolveCompatibilityDatesFromEnv(nuxt.options.compatibilityDate)

  if (!nuxt.options.compatibilityDate.default) {
    nuxt.options.compatibilityDate.default = fallbackCompatibilityDate

    if (nuxt.options.dev && hasTTY && !isCI && !nuxt.options.test && !warnedAboutCompatDate) {
      warnedAboutCompatDate = true
      consola.warn(`We recommend adding \`compatibilityDate: '${formatDate('latest')}'\` to your \`nuxt.config\` file.\nUsing \`${fallbackCompatibilityDate}\` as fallback. More info at: ${colors.underline('https://nitro.build/deploy#compatibility-date')}`)
    }
  }

  // Restart Nuxt when layer directories are added or removed
  const layersDir = withTrailingSlash(resolve(nuxt.options.rootDir, 'layers'))
  nuxt.hook('builder:watch', (event, relativePath) => {
    const path = resolve(nuxt.options.srcDir, relativePath)
    if (event === 'addDir' || event === 'unlinkDir') {
      if (path.startsWith(layersDir)) {
        return nuxt.callHook('restart', { hard: true })
      }
    }
  })
  const coreTypePackages = nuxt.options.typescript.hoist || []

  // Disable environment types entirely if `typescript.builder` is false
  if (nuxt.options.typescript.builder !== false) {
    const envMap = {
      // defaults from `builder` based on package name
      '@nuxt/rspack-builder': '@rspack/core/module',
      '@nuxt/vite-builder': 'vite/client',
      '@nuxt/webpack-builder': 'webpack/module',
      // simpler overrides from `typescript.builder` for better DX
      'rspack': '@rspack/core/module',
      'vite': 'vite/client',
      'webpack': 'webpack/module',
      // default 'merged' builder environment for module authors
      'shared': '@nuxt/schema/builder-env',
    }

    const overrideEnv = nuxt.options.typescript.builder && envMap[nuxt.options.typescript.builder]
    // If there's no override, infer based on builder. If a custom builder is provided, we disable shared types
    const defaultEnv = typeof nuxt.options.builder === 'string' ? envMap[nuxt.options.builder] : false
    const environmentTypes = overrideEnv || defaultEnv

    if (environmentTypes) {
      nuxt.options.typescript.hoist.push(environmentTypes)
      addTypeTemplate({
        filename: 'types/builder-env.d.ts',
        getContents: () => genImport(environmentTypes),
      })
    }
  }

  const packageJSON = await readPackageJSON(nuxt.options.rootDir).catch(() => ({}) as PackageJson)
  const NESTED_PKG_RE = /^[^@]+\//
  nuxt._dependencies = new Set([...Object.keys(packageJSON.dependencies || {}), ...Object.keys(packageJSON.devDependencies || {})])
  const paths = Object.fromEntries(await Promise.all(coreTypePackages.map(async (pkg) => {
    const [_pkg = pkg, _subpath] = NESTED_PKG_RE.test(pkg) ? pkg.split('/') : [pkg]
    const subpath = _subpath ? '/' + _subpath : ''

    // ignore packages that exist in `package.json` as these can be resolved by TypeScript
    if (nuxt._dependencies?.has(_pkg) && !(_pkg in nightlies)) { return [] }

    // deduplicate types for nightly releases
    if (_pkg in nightlies) {
      const nightly = nightlies[_pkg as keyof typeof nightlies]
      const path = await resolveTypePath(nightly + subpath, subpath, nuxt.options.modulesDir)
      if (path) {
        return [[pkg, [path]], [nightly + subpath, [path]]]
      }
    }

    const path = await resolveTypePath(_pkg + subpath, subpath, nuxt.options.modulesDir)
    if (path) {
      return [[pkg, [path]]]
    }

    return []
  })).then(r => r.flat()))

  // Set nitro resolutions for types that might be obscured with shamefully-hoist=false
  nuxt.options.nitro.typescript = defu(nuxt.options.nitro.typescript, {
    tsConfig: { compilerOptions: { paths: { ...paths } } },
  })

  // Add nuxt types
  nuxt.hook('prepare:types', (opts) => {
    opts.references.push({ types: 'nuxt' })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/plugins.d.ts') })
    // Add vue shim
    if (nuxt.options.typescript.shim) {
      opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/vue-shim.d.ts') })
    }
    // Add shims for `#build/*` imports that do not already have matching types
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/build.d.ts') })
    // Add module augmentations directly to NuxtConfig
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/schema.d.ts') })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/app.config.d.ts') })

    // Set Nuxt resolutions for types that might be obscured with shamefully-hoist=false
    opts.tsConfig.compilerOptions = defu(opts.tsConfig.compilerOptions, { paths: { ...paths } })

    for (const layer of nuxt.options._layers) {
      const declaration = join(layer.cwd, 'index.d.ts')
      if (existsSync(declaration)) {
        opts.references.push({ path: declaration })
      }
    }
  })

  // Prompt to install `@nuxt/scripts` if user has configured it
  // @ts-expect-error scripts types are not present as the module is not installed
  if (nuxt.options.scripts) {
    if (!nuxt.options._modules.some(m => m === '@nuxt/scripts' || m === '@nuxt/scripts-nightly')) {
      installNuxtModule('@nuxt/scripts')
    }
  }

  // Support Nuxt VFS
  addBuildPlugin(VirtualFSPlugin(nuxt, { mode: 'server' }), { client: false })
  addBuildPlugin(VirtualFSPlugin(nuxt, { mode: 'client', alias: { 'nitro/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs') } }), { server: false })

  // Add plugin normalization plugin
  addBuildPlugin(RemovePluginMetadataPlugin(nuxt))

  // Add keys for useFetch, useAsyncData, etc.
  addBuildPlugin(ComposableKeysPlugin({
    sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
    rootDir: nuxt.options.rootDir,
    composables: nuxt.options.optimization.keyedComposables,
  }))

  // shared folder import protection
  const sharedDir = withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared))
  const relativeSharedDir = withTrailingSlash(relative(nuxt.options.rootDir, resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))
  const sharedPatterns = [/^#shared\//, new RegExp('^' + escapeRE(sharedDir)), new RegExp('^' + escapeRE(relativeSharedDir))]
  const sharedProtectionConfig = {
    cwd: nuxt.options.rootDir,
    include: sharedPatterns,
    patterns: createImportProtectionPatterns(nuxt, { context: 'shared' }),
  }
  addVitePlugin(() => ImpoundPlugin.vite(sharedProtectionConfig), { server: false })
  addWebpackPlugin(() => ImpoundPlugin.webpack(sharedProtectionConfig), { server: false })

  // Add import protection
  const nuxtProtectionConfig = {
    cwd: nuxt.options.rootDir,
    // Exclude top-level resolutions by plugins
    exclude: [relative(nuxt.options.rootDir, join(nuxt.options.srcDir, 'index.html')), ...sharedPatterns],
    patterns: createImportProtectionPatterns(nuxt, { context: 'nuxt-app' }),
  }
  addVitePlugin(() => Object.assign(ImpoundPlugin.vite({ ...nuxtProtectionConfig, error: false }), { name: 'nuxt:import-protection' }), { client: false })
  addVitePlugin(() => Object.assign(ImpoundPlugin.vite({ ...nuxtProtectionConfig, error: true }), { name: 'nuxt:import-protection' }), { server: false })
  addWebpackPlugin(() => ImpoundPlugin.webpack(nuxtProtectionConfig))

  // add resolver for modules used in virtual files
  addVitePlugin(() => ResolveDeepImportsPlugin(nuxt), { client: false })
  addVitePlugin(() => ResolveDeepImportsPlugin(nuxt), { server: false })

  addVitePlugin(() => ResolveExternalsPlugin(nuxt), { client: false, prepend: true })

  // Add transform for `onPrehydrate` lifecycle hook
  addBuildPlugin(PrehydrateTransformPlugin({ sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }))

  if (nuxt.options.experimental.localLayerAliases) {
    // Add layer aliasing support for ~, ~~, @ and @@ aliases
    addBuildPlugin(LayerAliasingPlugin({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      dev: nuxt.options.dev,
      root: nuxt.options.srcDir,
      // skip top-level layer (user's project) as the aliases will already be correctly resolved
      layers: nuxt.options._layers.slice(1),
    }))
  }

  nuxt.hook('modules:done', () => {
    // Add unctx transform
    addBuildPlugin(UnctxTransformPlugin({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      transformerOptions: {
        ...nuxt.options.optimization.asyncTransforms,
        helperModule: 'unctx',
      },
    }))

    // Add composable tree-shaking optimisations
    if (Object.keys(nuxt.options.optimization.treeShake.composables.server).length) {
      addBuildPlugin(TreeShakeComposablesPlugin({
        sourcemap: !!nuxt.options.sourcemap.server,
        composables: nuxt.options.optimization.treeShake.composables.server,
      }), { client: false })
    }
    if (Object.keys(nuxt.options.optimization.treeShake.composables.client).length) {
      addBuildPlugin(TreeShakeComposablesPlugin({
        sourcemap: !!nuxt.options.sourcemap.client,
        composables: nuxt.options.optimization.treeShake.composables.client,
      }), { server: false })
    }
  })

  if (!nuxt.options.dev) {
    // DevOnly component tree-shaking - build time only
    addBuildPlugin(DevOnlyPlugin({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
    }))
  }

  if (nuxt.options.dev) {
    // Add plugin to check if layouts are defined without NuxtLayout being instantiated
    addPlugin(resolve(nuxt.options.appDir, 'plugins/check-if-layout-used'))
  }

  if (nuxt.options.dev && nuxt.options.features.devLogs) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/dev-server-logs'))
    addServerPlugin(resolve(distDir, 'core/runtime/nitro/plugins/dev-server-logs'))
    nuxt.options.nitro = defu(nuxt.options.nitro, {
      externals: {
        inline: [/#internal\/dev-server-logs-options/],
      },
      virtual: {
        '#internal/dev-server-logs-options': () => `export const rootDir = ${JSON.stringify(nuxt.options.rootDir)};`,
      },
    })
  }

  // Transform initial composable call within `<script setup>` to preserve context
  if (nuxt.options.experimental.asyncContext) {
    addBuildPlugin(AsyncContextInjectionPlugin(nuxt), { client: false })
  }

  // TODO: [Experimental] Avoid emitting assets when flag is enabled
  if (nuxt.options.features.noScripts && !nuxt.options.dev) {
    nuxt.hook('build:manifest', async (manifest) => {
      for (const chunk of Object.values(manifest)) {
        if (chunk.resourceType === 'script') {
          await rm(resolve(nuxt.options.buildDir, 'dist/client', withoutLeadingSlash(nuxt.options.app.buildAssetsDir), chunk.file), { force: true })
          chunk.file = ''
        }
      }
    })
  }

  // Transpile #app if it is imported directly from subpath export
  nuxt.options.build.transpile.push('nuxt/app')

  // Transpile layers within node_modules
  nuxt.options.build.transpile.push(
    ...nuxt.options._layers.filter(i => i.cwd.includes('node_modules')).map(i => i.cwd as string),
  )

  // Ensure we can resolve dependencies within layers - filtering out local `~~/layers` directories
  const locallyScannedLayersDirs = nuxt.options._layers.map(l => resolve(l.cwd, 'layers').replace(/\/?$/, '/'))
  nuxt.options.modulesDir.push(...nuxt.options._layers
    .filter(l => l.cwd !== nuxt.options.rootDir && locallyScannedLayersDirs.every(dir => !l.cwd.startsWith(dir)))
    .map(l => resolve(l.cwd, 'node_modules')))

  // Init user modules
  await nuxt.callHook('modules:before')

  const { paths: modulePaths, modules } = await resolveModules(nuxt)

  nuxt.options.watch.push(...modulePaths)

  // Add <NuxtWelcome>
  // TODO: revert when deep server component config is properly bundle-split: https://github.com/nuxt/nuxt/pull/29956
  const islandsConfig = nuxt.options.experimental.componentIslands
  if (nuxt.options.dev || !(typeof islandsConfig === 'object' && islandsConfig.selectiveClient === 'deep')) {
    addComponent({
      name: 'NuxtWelcome',
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, 'components/welcome'),
    })
  }

  addComponent({
    name: 'NuxtLayout',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-layout'),
  })

  // Add <NuxtErrorBoundary>
  addComponent({
    name: 'NuxtErrorBoundary',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-error-boundary'),
  })

  // Add <ClientOnly>
  addComponent({
    name: 'ClientOnly',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/client-only'),
  })

  // Add <DevOnly>
  addComponent({
    name: 'DevOnly',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/dev-only'),
  })

  // Add <ServerPlaceholder>
  addComponent({
    name: 'ServerPlaceholder',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/server-placeholder'),
  })

  // Add <NuxtLink>
  addComponent({
    name: 'NuxtLink',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-link'),
  })

  // Add <NuxtLoadingIndicator>
  addComponent({
    name: 'NuxtLoadingIndicator',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-loading-indicator'),
  })

  // Add <NuxtTime>
  addComponent({
    name: 'NuxtTime',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-time.vue'),
  })

  // Add <NuxtRouteAnnouncer>
  addComponent({
    name: 'NuxtRouteAnnouncer',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-route-announcer'),
    mode: 'client',
  })

  // Add <NuxtClientFallback>
  if (nuxt.options.experimental.clientFallback) {
    addComponent({
      name: 'NuxtClientFallback',
      _raw: true,
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, 'components/client-fallback.client'),
      mode: 'client',
    })

    addComponent({
      name: 'NuxtClientFallback',
      _raw: true,
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, 'components/client-fallback.server'),
      mode: 'server',
    })
  }

  // Add stubs for <NuxtImg> and <NuxtPicture>
  for (const name of ['NuxtImg', 'NuxtPicture']) {
    addComponent({
      name,
      export: name,
      priority: -1,
      filePath: resolve(nuxt.options.appDir, 'components/nuxt-stubs'),
      // @ts-expect-error TODO: refactor to @nuxt/cli
      _internal_install: '@nuxt/image',
    })
  }

  // Track components used to render for webpack
  if (nuxt.options.builder === '@nuxt/webpack-builder') {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/preload.server'))
  }

  // Add nuxt app hooks debugger
  if (
    nuxt.options.debug
    && nuxt.options.debug.hooks
    && (nuxt.options.debug.hooks === true || nuxt.options.debug.hooks.client)
  ) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/debug-hooks'))
  }

  // Add experimental Chrome devtools timings support
  // https://developer.chrome.com/docs/devtools/performance/extension
  if (nuxt.options.experimental.browserDevtoolsTiming) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/browser-devtools-timing.client'))
  }

  for (const [key, options] of modules) {
    await installModule(key, options)
  }

  // (Re)initialise ignore handler with resolved ignores from modules
  nuxt._ignore = ignore(nuxt.options.ignoreOptions)
  nuxt._ignore.add(resolveIgnorePatterns())

  await nuxt.callHook('modules:done')

  // remove duplicate css after modules are done
  nuxt.options.css = nuxt.options.css
    .filter((value, index, array) => !array.includes(value, index + 1))

  // Add <NuxtIsland>
  if (nuxt.options.experimental.componentIslands) {
    addComponent({
      name: 'NuxtIsland',
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, 'components/nuxt-island'),
    })

    // sync conditions with /packages/nuxt/src/core/templates.ts#L539
    addServerTemplate({
      filename: '#internal/nuxt/island-renderer.mjs',
      getContents () {
        if (nuxt.options.dev || nuxt.options.experimental.componentIslands !== 'auto' || nuxt.apps.default?.pages?.some(p => p.mode === 'server') || nuxt.apps.default?.components?.some(c => c.mode === 'server' && !nuxt.apps.default?.components.some(other => other.pascalName === c.pascalName && other.mode === 'client'))) {
          return `export { default } from '${resolve(distDir, 'core/runtime/nitro/handlers/island')}'`
        }
        return `import { defineEventHandler } from 'h3'; export default defineEventHandler(() => {});`
      },
    })
    addServerHandler({
      route: '/__nuxt_island/**',
      handler: '#internal/nuxt/island-renderer.mjs',
    })

    if (!nuxt.options.ssr && nuxt.options.experimental.componentIslands !== 'auto') {
      nuxt.options.ssr = true
      nuxt.options.nitro.routeRules ||= {}
      nuxt.options.nitro.routeRules['/**'] = defu(nuxt.options.nitro.routeRules['/**'], { ssr: false })
    }
  }

  // Add prerender payload support
  if (!nuxt.options.dev && nuxt.options.experimental.payloadExtraction) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/payload.client'))
  }

  // Add experimental cross-origin prefetch support using Speculation Rules API
  if (nuxt.options.experimental.crossOriginPrefetch) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/cross-origin-prefetch.client'))
  }

  // Add experimental page reload support
  if (nuxt.options.experimental.emitRouteChunkError === 'automatic') {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/chunk-reload.client'))
  }
  // Add experimental immediate page reload support
  if (nuxt.options.experimental.emitRouteChunkError === 'automatic-immediate') {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/chunk-reload-immediate.client'))
  }

  // Add experimental session restoration support
  if (nuxt.options.experimental.restoreState) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/restore-state.client'))
  }

  // Add experimental automatic view transition api support
  if (nuxt.options.experimental.viewTransition) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/view-transitions.client'))
  }

  // Add experimental support for custom types in JSON payload
  if (nuxt.options.experimental.renderJsonPayloads) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/revive-payload.client'))
    addPlugin(resolve(nuxt.options.appDir, 'plugins/revive-payload.server'))
  }

  if (nuxt.options.experimental.appManifest) {
    addRouteMiddleware({
      name: 'manifest-route-rule',
      path: resolve(nuxt.options.appDir, 'middleware/manifest-route-rule'),
      global: true,
    })

    if (nuxt.options.experimental.checkOutdatedBuildInterval !== false) {
      addPlugin(resolve(nuxt.options.appDir, 'plugins/check-outdated-build.client'))
    }
  }

  if (nuxt.options.experimental.navigationRepaint) {
    addPlugin({
      src: resolve(nuxt.options.appDir, 'plugins/navigation-repaint.client'),
    })
  }

  if (nuxt.options.vue.config && Object.values(nuxt.options.vue.config).some(v => v !== null && v !== undefined)) {
    addPluginTemplate({
      filename: 'vue-app-config.mjs',
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

  nuxt.hooks.hook('builder:watch', (event, relativePath) => {
    const path = resolve(nuxt.options.srcDir, relativePath)
    // Local module patterns
    if (modulePaths.has(path)) {
      return nuxt.callHook('restart', { hard: true })
    }

    // User provided patterns
    const layerRelativePaths = new Set(nuxt.options._layers.map(l => relative(l.config.srcDir || l.cwd, path)))
    for (const pattern of nuxt.options.watch) {
      if (typeof pattern === 'string') {
        // Test (normalized) strings against absolute path and relative path to any layer `srcDir`
        if (pattern === path || layerRelativePaths.has(pattern)) { return nuxt.callHook('restart') }
        continue
      }
      // Test regular expressions against path to _any_ layer `srcDir`
      for (const p of layerRelativePaths) {
        if (pattern.test(p)) {
          return nuxt.callHook('restart')
        }
      }
    }

    // Restart Nuxt when new `app/` dir is added
    if (event === 'addDir' && path === resolve(nuxt.options.srcDir, 'app')) {
      logger.info(`\`${path}/\` ${event === 'addDir' ? 'created' : 'removed'}`)
      return nuxt.callHook('restart', { hard: true })
    }

    // Core Nuxt files: app.vue, error.vue and app.config.ts
    const isFileChange = ['add', 'unlink'].includes(event)
    if (isFileChange && RESTART_RE.test(path)) {
      logger.info(`\`${path}\` ${event === 'add' ? 'created' : 'removed'}`)
      return nuxt.callHook('restart')
    }
  })

  // Normalize windows transpile paths added by modules
  nuxt.options.build.transpile = nuxt.options.build.transpile.map(t => typeof t === 'string' ? normalize(t) : t)

  addModuleTranspiles()

  // Init nitro
  await initNitro(nuxt)

  // TODO: remove when app manifest support is landed in https://github.com/nuxt/nuxt/pull/21641
  // Add prerender payload support
  const nitro = useNitro()
  if (nitro.options.static && nuxt.options.experimental.payloadExtraction === undefined) {
    logger.warn('Using experimental payload extraction for full-static output. You can opt-out by setting `experimental.payloadExtraction` to `false`.')
    nuxt.options.experimental.payloadExtraction = true
  }
  nitro.options.replace['process.env.NUXT_PAYLOAD_EXTRACTION'] = String(!!nuxt.options.experimental.payloadExtraction)
  nitro.options._config.replace!['process.env.NUXT_PAYLOAD_EXTRACTION'] = String(!!nuxt.options.experimental.payloadExtraction)

  if (!nuxt.options.dev && nuxt.options.experimental.payloadExtraction) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/payload.client'))
  }

  // Show compatibility version banner when Nuxt is running with a compatibility version
  // that is different from the current major version
  if (!(satisfies(nuxt._version, nuxt.options.future.compatibilityVersion + '.x'))) {
    logger.info(`Running with compatibility version \`${nuxt.options.future.compatibilityVersion}\``)
  }

  await nuxt.callHook('ready', nuxt)
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  const options = await loadNuxtConfig(opts)

  // Temporary until finding better placement for each
  options.appDir = options.alias['#app'] = resolve(distDir, 'app')
  options._majorVersion = 4

  // De-duplicate key arrays
  for (const key in options.app.head || {}) {
    options.app.head[key as 'link'] = deduplicateArray(options.app.head[key as 'link'])
  }

  // Nuxt DevTools only works for Vite
  if (options.builder === '@nuxt/vite-builder') {
    const isDevToolsEnabled = typeof options.devtools === 'boolean'
      ? options.devtools
      : options.devtools?.enabled !== false // enabled by default unless explicitly disabled

    if (isDevToolsEnabled) {
      if (!options._modules.some(m => m === '@nuxt/devtools' || m === '@nuxt/devtools-nightly' || m === '@nuxt/devtools-edge')) {
        options._modules.push('@nuxt/devtools')
      }
    }
  }

  if (!options._modules.some(m => m === '@nuxt/scripts' || m === '@nuxt/scripts-nightly')) {
    options.imports = defu(options.imports, {
      presets: [scriptsStubsPreset],
    })
  }

  // Nuxt Webpack Builder is currently opt-in
  if (options.builder === '@nuxt/webpack-builder') {
    if (!await import('./features').then(r => r.ensurePackageInstalled('@nuxt/webpack-builder', {
      rootDir: options.rootDir,
      searchPaths: options.modulesDir,
    }))) {
      logger.warn('Failed to install `@nuxt/webpack-builder`, please install it manually, or change the `builder` option to vite in `nuxt.config`')
    }
  }

  // Add core modules
  options._modules.push(pagesModule, metaModule, componentsModule)
  options._modules.push([importsModule, {
    transform: {
      include: options._layers
        .filter(i => i.cwd && i.cwd.includes('node_modules'))
        .map(i => new RegExp(`(^|\\/)${escapeRE(i.cwd!.split('node_modules/').pop()!)}(\\/|$)(?!node_modules\\/)`)),
    },
  }])
  options._modules.push(schemaModule)
  options.modulesDir.push(resolve(options.workspaceDir, 'node_modules'))
  options.modulesDir.push(resolve(pkgDir, 'node_modules'))
  options.build.transpile.push(
    'mocked-exports',
    'std-env', // we need to statically replace process.env when used in runtime code
  )
  options.alias['vue-demi'] = resolve(options.appDir, 'compat/vue-demi')
  options.alias['@vue/composition-api'] = resolve(options.appDir, 'compat/capi')
  if (options.telemetry !== false && !process.env.NUXT_TELEMETRY_DISABLED) {
    options._modules.push('@nuxt/telemetry')
  }

  // warn if user is using reserved namespaces
  const allowedKeys = new Set(['baseURL', 'buildAssetsDir', 'cdnURL', 'buildId'])
  for (const key in options.runtimeConfig.app) {
    if (!allowedKeys.has(key)) {
      logger.warn(`The \`app\` namespace is reserved for Nuxt and is exposed to the browser. Please move \`runtimeConfig.app.${key}\` to a different namespace.`)
      delete options.runtimeConfig.app[key]
    }
  }

  // Ensure we share key config between Nuxt and Nitro
  createPortalProperties(options.nitro.runtimeConfig, options, ['nitro.runtimeConfig', 'runtimeConfig'])
  createPortalProperties(options.nitro.routeRules, options, ['nitro.routeRules', 'routeRules'])

  // prevent replacement of options.nitro
  const nitroOptions = options.nitro
  Object.defineProperties(options, {
    nitro: {
      configurable: false,
      enumerable: true,
      get: () => nitroOptions,
      set (value) {
        Object.assign(nitroOptions, value)
      },
    },
  })

  const nuxt = createNuxt(options)

  nuxt.runWithContext(() => {
    if (nuxt.options.dev && !nuxt.options.test) {
      nuxt.hooks.hookOnce('build:done', () => {
        for (const dep of keyDependencies) {
          checkDependencyVersion(dep, nuxt._version)
            .catch(e => logger.warn(`Problem checking \`${dep}\` version.`, e))
        }
      })
    }

    // We register hooks layer-by-layer so any overrides need to be registered separately
    if (opts.overrides?.hooks) {
      nuxt.hooks.addHooks(opts.overrides.hooks)
    }

    if (
      nuxt.options.debug
      && nuxt.options.debug.hooks
      && (nuxt.options.debug.hooks === true || nuxt.options.debug.hooks.server)
    ) {
      createDebugger(nuxt.hooks, { tag: 'nuxt' })
    }
  })

  if (opts.ready !== false) {
    await nuxt.ready()
  }

  return nuxt
}

export async function checkDependencyVersion (name: string, nuxtVersion: string): Promise<void> {
  const path = resolveModulePath(name, { try: true })

  if (!path) { return }
  const { version } = await readPackageJSON(path)

  if (version && gt(nuxtVersion, version)) {
    console.warn(`[nuxt] Expected \`${name}\` to be at least \`${nuxtVersion}\` but got \`${version}\`. This might lead to unexpected behavior. Check your package.json or refresh your lockfile.`)
  }
}

const RESTART_RE = /^(?:app|error|app\.config)\.(?:js|ts|mjs|jsx|tsx|vue)$/i

function deduplicateArray<T = unknown> (maybeArray: T): T {
  if (!Array.isArray(maybeArray)) { return maybeArray }

  const fresh: any[] = []
  const hashes = new Set<string>()
  for (const item of maybeArray) {
    const _hash = hash(item)
    if (!hashes.has(_hash)) {
      hashes.add(_hash)
      fresh.push(item)
    }
  }
  return fresh as T
}

function createPortalProperties (sourceValue: any, options: NuxtOptions, paths: string[]) {
  let sharedValue = sourceValue

  for (const path of paths) {
    const segments = path.split('.')
    const key = segments.pop()!
    let parent: Record<string, any> = options

    while (segments.length) {
      const key = segments.shift()!
      parent = parent[key] ||= {}
    }

    delete parent[key]

    Object.defineProperties(parent, {
      [key]: {
        configurable: false,
        enumerable: true,
        get: () => sharedValue,
        set (value) {
          sharedValue = value
        },
      },
    })
  }
}

function resolveModule (
  definition: NuxtModule<any> | string | false | undefined | null | [(NuxtModule | string)?, Record<string, any>?],
  nuxt: Nuxt,
): { resolvedPath?: string, module: string | NuxtModule<any>, options: Record<string, any> } | undefined {
  const [module, options = {}] = Array.isArray(definition) ? definition : [definition, {}]

  if (!module) {
    return
  }

  if (typeof module !== 'string') {
    return {
      module,
      options,
    }
  }

  const modAlias = resolveAlias(module)
  const modPath = resolveModulePath(modAlias, {
    try: true,
    from: nuxt.options.modulesDir.map(m => directoryToURL(m.replace(/\/node_modules\/?$/, '/'))),
    suffixes: ['nuxt', 'nuxt/index', 'module', 'module/index', '', 'index'],
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  })

  return {
    module,
    resolvedPath: modPath || modAlias,
    options,
  }
}

async function resolveModules (nuxt: Nuxt) {
  const modules = new Map<string | NuxtModule, Record<string, any>>()
  const paths = new Set<string>()
  const resolvedModulePaths = new Set<string>()

  // Loop layers in reverse order, so that the extends are loaded first and project is the last
  const configs = nuxt.options._layers.map(layer => layer.config).reverse()
  for (const config of configs) {
    // First register modules defined in layer's config
    const definedModules = config.modules ?? []
    for (const module of definedModules) {
      const resolvedModule = resolveModule(module, nuxt)
      if (resolvedModule && (!resolvedModule.resolvedPath || !resolvedModulePaths.has(resolvedModule.resolvedPath))) {
        modules.set(resolvedModule.module, resolvedModule.options)
        const path = resolvedModule.resolvedPath || typeof resolvedModule.module
        if (typeof path === 'string') {
          resolvedModulePaths.add(path)
        }
      }
    }

    // Secondly automatically register modules from layer's module directory
    const modulesDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : config.dir)?.modules || 'modules'
    const layerModules = await resolveFiles(config.srcDir, [
      `${modulesDir}/*{${nuxt.options.extensions.join(',')}}`,
      `${modulesDir}/*/index{${nuxt.options.extensions.join(',')}}`,
    ])

    for (const module of layerModules) {
      // add path to watch
      paths.add(module)

      if (!modules.has(module)) {
        modules.set(module, {})
      }
    }
  }

  // Lastly register private modules and modules added after loading config
  for (const key of ['modules', '_modules'] as const) {
    for (const module of nuxt.options[key as 'modules']) {
      const resolvedModule = resolveModule(module, nuxt)

      if (resolvedModule && !modules.has(resolvedModule.module) && (!resolvedModule.resolvedPath || !resolvedModulePaths.has(resolvedModule.resolvedPath))) {
        modules.set(resolvedModule.module, resolvedModule.options)
        const path = resolvedModule.resolvedPath || typeof resolvedModule.module
        if (typeof path === 'string') {
          resolvedModulePaths.add(path)
        }
      }
    }
  }

  return {
    paths,
    modules,
  }
}
