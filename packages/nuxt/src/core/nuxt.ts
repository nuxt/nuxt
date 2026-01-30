import process from 'node:process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { join, normalize, relative, resolve } from 'pathe'
import { createDebugger, createHooks } from 'hookable'
import ignore from 'ignore'
import type { LoadNuxtOptions } from '@nuxt/kit'
import { addBuildPlugin, addComponent, addPlugin, addPluginTemplate, addRouteMiddleware, addTypeTemplate, addVitePlugin, getLayerDirectories, installModules, loadNuxtConfig, nuxtCtx, resolveFiles, resolveIgnorePatterns, resolveModuleWithOptions, resolvePath, runWithNuxtContext } from '@nuxt/kit'
import type { PackageJson } from 'pkg-types'
import { readPackageJSON } from 'pkg-types'
import { hash } from 'ohash'
import { consola } from 'consola'
import onChange from 'on-change'
import { colors } from 'consola/utils'
import { formatDate, resolveCompatibilityDatesFromEnv } from 'compatx'
import type { DateString } from 'compatx'
import escapeRE from 'escape-string-regexp'
import { withoutLeadingSlash } from 'ufo'
import { ImpoundPlugin } from 'impound'
import { defu } from 'defu'
import { coerce, satisfies } from 'semver'
import { hasTTY, isCI } from 'std-env'
import { genImport, genString } from 'knitwork'
import { resolveModulePath } from 'exsolve'
import type { Nuxt, NuxtHooks, NuxtModule, NuxtOptions } from 'nuxt/schema'
import type { Unimport } from 'unimport'

import { installNuxtModule } from '../core/features.ts'
import pagesModule from '../pages/module.ts'
import metaModule from '../head/module.ts'
import componentsModule from '../components/module.ts'
import importsModule from '../imports/module.ts'

import { distDir, pkgDir } from '../dirs.ts'
import { runtimeDependencies } from '../../meta.js'
import pkg from '../../package.json' with { type: 'json' }
import { scriptsStubsPreset } from '../imports/presets.ts'
import { logger } from '../utils.ts'
import { resolveTypePath } from './utils/types.ts'
import { createImportProtectionPatterns } from './plugins/import-protection.ts'
import { UnctxTransformPlugin } from './plugins/unctx.ts'
import { TreeShakeComposablesPlugin } from './plugins/tree-shake.ts'
import { DevOnlyPlugin } from './plugins/dev-only.ts'
import { LayerAliasingPlugin } from './plugins/layer-aliasing.ts'
import { addModuleTranspiles } from './modules.ts'
import { bundleServer } from './server.ts'
import schemaModule from './schema.ts'
import { RemovePluginMetadataPlugin } from './plugins/plugin-metadata.ts'
import { AsyncContextInjectionPlugin } from './plugins/async-context.ts'
import { KeyedFunctionsPlugin } from './plugins/keyed-functions.ts'
import { PrehydrateTransformPlugin } from './plugins/prehydrate.ts'
import { ExtractAsyncDataHandlersPlugin } from './plugins/extract-async-data-handlers.ts'
import { VirtualFSPlugin } from './plugins/virtual.ts'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = createHooks<NuxtHooks>()

  const { callHook, callHookParallel, callHookWith } = hooks
  hooks.callHook = (...args) => runWithNuxtContext(nuxt, () => callHook(...args))
  hooks.callHookParallel = (...args) => runWithNuxtContext(nuxt, () => callHookParallel(...args))
  hooks.callHookWith = (...args) => runWithNuxtContext(nuxt, () => callHookWith(...args))

  const nuxt: Nuxt = {
    __name: randomUUID(),
    _version: pkg.version,
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

  // TODO: remove in nuxt v5
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (!nuxtCtx.tryUse()) {
    // backward compatibility with 3.x
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    nuxtCtx.set(nuxt)
    nuxt.hook('close', () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      nuxtCtx.unset()
    })
  }

  hooks.hookOnce('close', () => { hooks.removeAllHooks() })

  return nuxt
}

const fallbackCompatibilityDate = '2025-07-15' as DateString

const nightlies = {
  'nitropack': 'nitropack-nightly',
  'nitro': 'nitro-nightly',
  'h3': 'h3-nightly',
  'nuxt': 'nuxt-nightly',
  '@nuxt/schema': '@nuxt/schema-nightly',
  '@nuxt/kit': '@nuxt/kit-nightly',
}

export const keyDependencies: string[] = [
  '@nuxt/kit',
]

let warnedAboutCompatDate = false

async function initNuxt (nuxt: Nuxt) {
  const layerDirs = getLayerDirectories(nuxt)

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

  addTypeTemplate({
    filename: 'types/nitro-layouts.d.ts',
    getContents: ({ app }) => {
      return [
        `export type LayoutKey = ${Object.keys(app.layouts).map(name => genString(name)).join(' | ') || 'string'}`,
        'declare module \'nitropack\' {',
        '  interface NitroRouteConfig {',
        '    appLayout?: LayoutKey | false',
        '  }',
        '  interface NitroRouteRules {',
        '    appLayout?: LayoutKey | false',
        '  }',
        '}',
        'declare module \'nitropack/types\' {',
        '  interface NitroRouteConfig {',
        '    appLayout?: LayoutKey | false',
        '  }',
        '  interface NitroRouteRules {',
        '    appLayout?: LayoutKey | false',
        '  }',
        '}',
      ].join('\n')
    },
  }, { nuxt: true, nitro: true, node: true })

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
  nuxt._dependencies = new Set([...Object.keys(packageJSON.dependencies || {}), ...Object.keys(packageJSON.devDependencies || {})])
  nuxt['~runtimeDependencies'] = [...runtimeDependencies]

  // Set nitro resolutions for types that might be obscured with shamefully-hoist=false
  let paths: Record<string, [string]> | undefined
  nuxt.hook('nitro:config', async (nitroConfig) => {
    paths ||= await resolveTypescriptPaths(nuxt)
    nitroConfig.typescript = defu(nitroConfig.typescript, {
      tsConfig: { compilerOptions: { paths: { ...paths } } },
    })
  })

  const serverBuilderReference = typeof nuxt.options.server.builder === 'string'
    ? nuxt.options.server.builder === '@nuxt/nitro-server'
      ? { path: resolveModulePath(nuxt.options.server.builder, { from: import.meta.url }).replace('.mjs', '.d.mts') }
      : { types: nuxt.options.server.builder }
    : undefined

  // Add nuxt types
  nuxt.hook('prepare:types', async (opts) => {
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/plugins.d.ts') })
    // Add vue shim
    if (nuxt.options.typescript.shim) {
      opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/vue-shim.d.ts') })
    }

    // Add shims for `#build/*` imports that do not already have matching types
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/build.d.ts') })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/app.config.d.ts') })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/runtime-config.d.ts') })
    opts.references.push({ types: 'nuxt/app' })

    // Add module augmentations directly to NuxtConfig
    opts.nodeReferences.push({ path: resolve(nuxt.options.buildDir, 'types/modules.d.ts') })
    opts.nodeReferences.push({ path: resolve(nuxt.options.buildDir, 'types/runtime-config.d.ts') })
    opts.nodeReferences.push({ path: resolve(nuxt.options.buildDir, 'types/app.config.d.ts') })
    opts.nodeReferences.push({ types: 'nuxt' })
    opts.nodeReferences.push({ path: resolveModulePath('@nuxt/vite-builder', { from: import.meta.url }).replace('.mjs', '.d.mts') })
    if (typeof nuxt.options.builder === 'string' && nuxt.options.builder !== '@nuxt/vite-builder') {
      opts.nodeReferences.push({ types: nuxt.options.builder })
    }

    if (serverBuilderReference) {
      opts.references.push(serverBuilderReference)
      opts.nodeReferences.push(serverBuilderReference)
    }

    opts.sharedReferences.push({ path: resolve(nuxt.options.buildDir, 'types/runtime-config.d.ts') })
    opts.sharedReferences.push({ path: resolve(nuxt.options.buildDir, 'types/app.config.d.ts') })
    opts.sharedReferences.push({ path: resolve(nuxt.options.buildDir, 'types/shared-imports.d.ts') })

    // Set Nuxt resolutions for types that might be obscured with shamefully-hoist=false
    paths ||= await resolveTypescriptPaths(nuxt)
    opts.tsConfig.compilerOptions = defu(opts.tsConfig.compilerOptions, { paths: { ...paths } })
    opts.nodeTsConfig.compilerOptions = defu(opts.nodeTsConfig.compilerOptions, { paths: { ...paths } })
    opts.sharedTsConfig.compilerOptions = defu(opts.sharedTsConfig.compilerOptions, { paths: { ...paths } })

    for (const dirs of layerDirs) {
      const declaration = join(dirs.root, 'index.d.ts')
      if (existsSync(declaration)) {
        opts.references.push({ path: declaration })
        opts.nodeReferences.push({ path: declaration })
        opts.sharedReferences.push({ path: declaration })
      }
    }
  })

  // Add nitro types
  nuxt.hook('nitro:prepare:types', (opts) => {
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/app.config.d.ts') })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/runtime-config.d.ts') })

    if (serverBuilderReference) {
      opts.references.push(serverBuilderReference)
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
  addBuildPlugin(VirtualFSPlugin(nuxt, {
    mode: 'client',
    alias: {
      '#internal/nitro': join(nuxt.options.buildDir, 'nitro.client.mjs'),
      'nitro/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
      'nitropack/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
    },
  }), { server: false })

  // Add plugin normalization plugin
  addBuildPlugin(RemovePluginMetadataPlugin(nuxt))

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

    // shared folder import protection
    const sharedDir = withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared))
    const relativeSharedDir = withTrailingSlash(relative(nuxt.options.rootDir, resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))
    const sharedPatterns = [/^#shared\//, new RegExp('^' + escapeRE(sharedDir)), new RegExp('^' + escapeRE(relativeSharedDir))]
    const sharedProtectionConfig = {
      cwd: nuxt.options.rootDir,
      include: sharedPatterns,
      patterns: createImportProtectionPatterns(nuxt, { context: 'shared' }),
    }
    addBuildPlugin({
      vite: () => ImpoundPlugin.vite(sharedProtectionConfig),
      webpack: () => ImpoundPlugin.webpack(sharedProtectionConfig),
      rspack: () => ImpoundPlugin.rspack(sharedProtectionConfig),
    }, { server: false })

    // Add import protection
    const nuxtProtectionConfig = {
      cwd: nuxt.options.rootDir,
      // Exclude top-level resolutions by plugins
      exclude: [relative(nuxt.options.rootDir, join(nuxt.options.srcDir, 'index.html')), ...sharedPatterns],
      patterns: createImportProtectionPatterns(nuxt, { context: 'nuxt-app' }),
    }
    addBuildPlugin({
      webpack: () => ImpoundPlugin.webpack(nuxtProtectionConfig),
      rspack: () => ImpoundPlugin.rspack(nuxtProtectionConfig),
    })
    // TODO: remove in nuxt v5 when we can use vite env api
    addVitePlugin(() => Object.assign(ImpoundPlugin.vite({ ...nuxtProtectionConfig, error: false }), { name: 'nuxt:import-protection' }), { client: false })
    addVitePlugin(() => Object.assign(ImpoundPlugin.vite({ ...nuxtProtectionConfig, error: true }), { name: 'nuxt:import-protection' }), { server: false })
  })

  if (!nuxt.options.dev) {
    // DevOnly component tree-shaking - build time only
    addBuildPlugin(DevOnlyPlugin({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
    }))

    // Extract async data handlers into separate chunks for better performance
    if (nuxt.options.experimental.extractAsyncDataHandlers) {
      addBuildPlugin(ExtractAsyncDataHandlersPlugin({
        sourcemap: !!nuxt.options.sourcemap.client,
        rootDir: nuxt.options.rootDir,
      }), { server: false })
    }
  }

  if (nuxt.options.dev) {
    // Add plugin to check if layouts are defined without NuxtLayout being instantiated
    addPlugin(resolve(nuxt.options.appDir, 'plugins/check-if-layout-used'))

    // add plugin to make warnings less verbose in dev mode
    addPlugin(resolve(nuxt.options.appDir, 'plugins/warn.dev.server'))
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
  for (const layer of layerDirs) {
    if (layer.root.includes('node_modules')) {
      nuxt.options.build.transpile.push(layer.root.replace(/\/$/, ''))
    }
  }

  // Ensure we can resolve dependencies within layers - filtering out local `~~/layers` directories
  const locallyScannedLayersDirs = layerDirs.map(l => join(l.root, 'layers/'))
  const rootWithTrailingSlash = withTrailingSlash(nuxt.options.rootDir)
  for (const dirs of layerDirs) {
    if (dirs.root === rootWithTrailingSlash) {
      continue
    }
    if (locallyScannedLayersDirs.every(dir => !dirs.root.startsWith(dir))) {
      nuxt.options.modulesDir.push(join(dirs.root, 'node_modules'))
    }
  }

  // Init user modules
  await nuxt.callHook('modules:before')

  const { paths: watchedModulePaths, resolvedModulePaths, modules } = await resolveModules(nuxt)

  nuxt.options.watch.push(...watchedModulePaths)

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
  if (nuxt.options.builder === '@nuxt/webpack-builder' || nuxt.options.builder === '@nuxt/rspack-builder') {
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

  await installModules(modules, resolvedModulePaths, nuxt)

  // (Re)initialise ignore handler with resolved ignores from modules
  nuxt._ignore = ignore(nuxt.options.ignoreOptions)
  nuxt._ignore.add(resolveIgnorePatterns())

  // will be assigned after `modules:done`
  let unimport: Unimport | undefined
  nuxt.hook('imports:context', (ctx) => {
    unimport = ctx
  })

  await nuxt.callHook('modules:done')

  // Add keys for useFetch, useAsyncData, etc.
  const normalizedKeyedFunctions = await Promise.all(nuxt.options.optimization.keyedComposables.map(async ({ source, ...rest }) => ({
    ...rest,
    source: typeof source === 'string'
      ? await resolvePath(source, { fallbackToOriginal: true }) ?? source
      : source,
  })))

  addBuildPlugin(KeyedFunctionsPlugin({
    sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
    keyedFunctions: normalizedKeyedFunctions,
    alias: nuxt.options.alias,
    getAutoImports: unimport!.getImports,
  }))

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

  addRouteMiddleware({
    name: 'manifest-route-rule',
    path: resolve(nuxt.options.appDir, 'middleware/route-rules'),
    global: true,
  })

  if (nuxt.options.experimental.appManifest) {
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
    if (watchedModulePaths.has(path)) {
      return nuxt.callHook('restart', { hard: true })
    }

    // User provided patterns
    const layerRelativePaths = new Set(getLayerDirectories(nuxt).map(l => relative(l.app, path)))
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

  nuxt.options.build.transpile = nuxt.options.build.transpile.map((t) => {
    if (typeof t !== 'string') {
      return t
    }
    // Normalize windows transpile paths added by modules
    return normalize(t).split('node_modules/').pop()!
  })

  addModuleTranspiles(nuxt)

  // Init nitro
  await bundleServer(nuxt)

  // Add prerender payload support
  if (nuxt.options.experimental.payloadExtraction) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/payload.client'))
  }

  // Show compatibility version banner when Nuxt is running with a compatibility version
  // that is different from the current major version
  if (!(satisfies(coerce(nuxt._version) ?? nuxt._version, nuxt.options.future.compatibilityVersion + '.x'))) {
    logger.info(`Running with compatibility version \`${nuxt.options.future.compatibilityVersion}\``)
  }

  await nuxt.callHook('ready', nuxt)
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  const options = await loadNuxtConfig(opts)

  // Temporary until finding better placement for each
  options.appDir = options.alias['#app'] = withTrailingSlash(resolve(distDir, 'app'))
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
    if (!await import('./features.ts').then(r => r.ensurePackageInstalled('@nuxt/webpack-builder', {
      rootDir: options.rootDir,
      searchPaths: options.modulesDir,
    }))) {
      logger.warn('Failed to install `@nuxt/webpack-builder`, please install it manually, or change the `builder` option to vite in `nuxt.config`')
    }
  }

  // Add core modules
  options._modules.push(pagesModule, metaModule, componentsModule)
  const importIncludes: RegExp[] = []
  for (const layer of options._layers) {
    if (layer.cwd && layer.cwd.includes('node_modules')) {
      importIncludes.push(new RegExp(`(^|\\/)${escapeRE(layer.cwd.split('node_modules/').pop()!)}(\\/|$)(?!node_modules\\/)`))
    }
  }
  options._modules.push([importsModule, {
    transform: {
      include: importIncludes,
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
  if (options.experimental.typescriptPlugin) {
    options._modules.push('@dxup/nuxt')
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
  const nitroOptions = options.nitro
  createPortalProperties(nitroOptions.runtimeConfig, options, ['nitro.runtimeConfig', 'runtimeConfig'])
  createPortalProperties(nitroOptions.routeRules, options, ['nitro.routeRules', 'routeRules'])

  // prevent replacement of options.nitro
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
      const resolvedModule = resolveModuleWithOptions(module, nuxt)
      if (resolvedModule && (!resolvedModule.resolvedPath || !resolvedModulePaths.has(resolvedModule.resolvedPath))) {
        modules.set(resolvedModule.module, resolvedModule.options)
        const path = resolvedModule.resolvedPath || resolvedModule.module
        if (typeof path === 'string') {
          resolvedModulePaths.add(path)
        }
      }
    }

    // Secondly automatically register modules from layer's module directory
    const modulesDir = resolve(config.srcDir, (config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : config.dir)?.modules || 'modules')
    const layerModules = await resolveFiles(modulesDir, [
      `*{${nuxt.options.extensions.join(',')}}`,
      `*/index{${nuxt.options.extensions.join(',')}}`,
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
      const resolvedModule = resolveModuleWithOptions(module, nuxt)

      if (resolvedModule && !modules.has(resolvedModule.module) && (!resolvedModule.resolvedPath || !resolvedModulePaths.has(resolvedModule.resolvedPath))) {
        modules.set(resolvedModule.module, resolvedModule.options)
        const path = resolvedModule.resolvedPath || resolvedModule.module
        if (typeof path === 'string') {
          resolvedModulePaths.add(path)
        }
      }
    }
  }

  return {
    paths,
    resolvedModulePaths,
    modules,
  }
}

const NESTED_PKG_RE = /^[^@]+\//
async function resolveTypescriptPaths (nuxt: Nuxt): Promise<Record<string, [string]>> {
  nuxt.options.typescript.hoist ||= []
  const paths = Object.fromEntries(await Promise.all(nuxt.options.typescript.hoist.map(async (pkg) => {
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

  return paths
}

function withTrailingSlash (dir: string) {
  return dir.replace(/[^/]$/, '$&/')
}
