import process from 'node:process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { isAbsolute, join, normalize, relative, resolve } from 'pathe'
import type { Hookable } from 'hookable'
import { createDebugger, createHooks } from 'hookable'
import ignore from 'ignore'
import type { LoadNuxtOptions } from '@nuxt/kit'
import { addBuildPlugin, ensureDependencyInstalled, getAddDependencyCommand, getLayerDirectories, loadNuxtConfig, nuxtCtx, resolveAlias, resolveIgnorePatterns, runWithNuxtContext } from '@nuxt/kit'
import { configDiagnostics, createServerBuild, installModules } from '@nuxt/kit/internal'
import type { PackageJson } from 'pkg-types'
import { readPackageJSON } from 'pkg-types'
import { hash } from 'ohash'
import { formatDate, resolveCompatibilityDatesFromEnv } from 'compatx'
import type { DateString } from 'compatx'
import escapeRE from 'escape-string-regexp'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { defu } from 'defu'
import { hasTTY, isCI } from 'std-env'
import { link } from 'clickable-path'
import type { DevServerHandler, NitroConfig, Nuxt, NuxtHooks, NuxtOptions, ServerHandler } from 'nuxt/schema'

import { installNuxtModule } from '../core/features.ts'
import pagesModule from '../pages/module.ts'
import metaModule from '../head/module.ts'
import componentsModule from '../components/module.ts'
import importsModule from '../imports/module.ts'
import compilerModule from '../compiler/module.ts'

import { resolveDevAppSecret } from './app-secret.ts'
import { assertRuntimeConfigWithoutSchemas, checkRuntimeConfig } from './runtime-config.ts'
import { restoreCachedBuildId } from './cache.ts'
import { distDir, pkgDir } from '../dirs.ts'
import { runtimeDependencies } from '../../meta.js'
import pkg from '../../package.json' with { type: 'json' }
import { scriptsStubsPreset } from '../imports/presets.ts'
import { linkToAlias, logger } from '../utils.ts'
import { installProxyDispatcher } from './utils/proxy.ts'
import { NavigateToEarlyReturnPlugin } from './plugins/navigate-to.ts'
import { addModuleTranspiles, resolveModules } from './modules.ts'
import { bundleServer } from './server.ts'
import { NuxtPerfProfiler } from './perf.ts'
import schemaModule from './schema.ts'
import { setupTemplateDiagnostics } from './template-diagnostics.ts'
import { setupTypes } from './typescript.ts'
import { addCoreBuildPlugins } from './build-plugins.ts'
import { addAppPlugin, addBuiltinsAfterModules, addBuiltinsAfterServer, addBuiltinsBeforeModules } from './builtins.ts'
import { stripDebugProxies, trackModuleMutations } from './debug-module-mutation.ts'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = createHooks<NuxtHooks>()

  const { callHook, callHookParallel, callHookWith } = hooks
  if (options.experimental.asyncCallHook) {
    hooks.callHook = (...args) => Promise.resolve().then(() => runWithNuxtContext(nuxt, () => callHook(...args)))
    hooks.callHookParallel = (...args) => Promise.resolve().then(() => runWithNuxtContext(nuxt, () => callHookParallel(...args)) ?? [])
  } else {
    hooks.callHook = (...args) => runWithNuxtContext(nuxt, () => callHook(...args))
    hooks.callHookParallel = (...args) => runWithNuxtContext(nuxt, () => callHookParallel(...args))
  }
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
    close: async () => { await hooks.callHook('close', nuxt) },
    vfs: {},
    apps: {},
    buildOutputs: {
      ssrStyles: () => 'export default {}\nexport const inlinedCSS = {}',
      serverEntry: () => `export default () => { throw new Error('[nuxt] nuxt/internal/entry was not replaced by a builder. Ensure a Nuxt builder (Vite, Webpack, or Rspack) is configured.') }`,
      clientManifest: () => 'export default {}',
      clientPrecomputed: () => 'export default undefined',
      entryChunkName: () => 'export const entryFileName = undefined',
      entryIds: () => 'export default []',
    },
    serverBuild: createServerBuild(options),
    runWithContext: fn => runWithNuxtContext(nuxt, fn),
    options,
  }

  if (options.experimental.debugModuleMutation) {
    trackModuleMutations(nuxt, options)
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

// TODO: remove in Nuxt 6, with `NUXT_B5030`
const REMOVED_EXPERIMENTAL_OPTIONS = ['externalVue', 'renderJsonPayloads', 'routeTypedFetch', 'viteEnvironmentApi']

let warnedAboutCompatDate = false

async function initNuxt (nuxt: Nuxt) {
  nuxt._perf?.startPhase('init')

  const layerDirs = getLayerDirectories(nuxt)

  // Register user hooks
  for (const config of nuxt.options._layers.map(layer => layer.config).reverse()) {
    if (config.hooks) {
      nuxt.hooks.addHooks(config.hooks)
    }
  }

  if (nuxt.options.dev) {
    nuxt.hook('listen', (server) => {
      nuxt._devServerListener = server
    })
  }

  nuxt.options.compatibilityDate = resolveCompatibilityDatesFromEnv(nuxt.options.compatibilityDate)

  if (!nuxt.options.compatibilityDate.default) {
    nuxt.options.compatibilityDate.default = fallbackCompatibilityDate

    if (nuxt.options.dev && hasTTY && !isCI && !nuxt.options.test && !warnedAboutCompatDate) {
      warnedAboutCompatDate = true
      configDiagnostics.NUXT_B5001({ fallback: fallbackCompatibilityDate, latest: formatDate('latest') })
    }
  }

  // Restart Nuxt when layer directories are added or removed
  const layersDir = withTrailingSlash(resolve(nuxt.options.rootDir, 'layers'))
  nuxt.hook('builder:watch', (event, relativePath) => {
    if ((event === 'addDir' || event === 'unlinkDir') && resolve(nuxt.options.srcDir, relativePath).startsWith(layersDir)) {
      return nuxt.callHook('restart', { hard: true })
    }
  })

  const packageJSON = await readPackageJSON(nuxt.options.rootDir).catch(() => ({}) as PackageJson)
  nuxt._dependencies = new Set([...Object.keys(packageJSON.dependencies || {}), ...Object.keys(packageJSON.devDependencies || {})])
  nuxt['~runtimeDependencies'] = [...runtimeDependencies]

  setupTypes(nuxt)

  // Prompt to install `@nuxt/scripts` if user has configured it
  // @ts-expect-error scripts types are not present as the module is not installed
  if (nuxt.options.scripts && !nuxt.options._modules.some(m => m === '@nuxt/scripts' || m === '@nuxt/scripts-nightly')) {
    installNuxtModule('@nuxt/scripts')
  }

  addCoreBuildPlugins(nuxt)

  if (nuxt.options.dev) {
    // warn when layouts are defined without `<NuxtLayout>` being instantiated
    addAppPlugin(nuxt, 'check-if-layout-used')
    addAppPlugin(nuxt, 'warn.dev.server')
  }

  // Registered before `installModules` so module `build:manifest` hooks can attach to these
  if (!nuxt.options.dev) {
    nuxt.hook('build:manifest', (manifest) => {
      for (const src of nuxt.options._noScriptsPageSources) {
        manifest[src] ||= { file: '', src }
      }
    })

    // Do not prefetch the default error page chunks
    nuxt.hook('build:manifest', (manifest) => {
      const errorPageSources = new Set(['error-404.vue', 'error-500.vue'].map(f => relative(nuxt.options.vite.root || nuxt.options.srcDir, resolve(nuxt.options.appDir, 'components', f))))
      for (const chunk of Object.values(manifest)) {
        if (chunk.isEntry && chunk.dynamicImports) {
          chunk.dynamicImports = chunk.dynamicImports.filter(i => !errorPageSources.has(i))
        }
      }
    })

    // TODO: [Experimental] Avoid emitting assets when flag is enabled
    if (nuxt.options.features.noScripts) {
      nuxt.hook('build:manifest', async (manifest) => {
        for (const chunk of Object.values(manifest)) {
          if (chunk.resourceType === 'script') {
            await rm(resolve(nuxt.options.buildDir, 'dist/client', withoutLeadingSlash(nuxt.options.app.buildAssetsDir), chunk.file), { force: true })
            chunk.file = ''
          }
        }
      })
    }
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
    if (dirs.root !== rootWithTrailingSlash && locallyScannedLayersDirs.every(dir => !dirs.root.startsWith(dir))) {
      nuxt.options.modulesDir.push(join(dirs.root, 'node_modules'))
    }
  }

  nuxt._perf?.endPhase('init')
  nuxt._perf?.startPhase('modules')
  await nuxt.callHook('modules:before')

  const { paths: watchedModulePaths, resolvedModulePaths, modules } = await resolveModules(nuxt)

  nuxt.options.watch.push(...watchedModulePaths)

  addBuiltinsBeforeModules(nuxt)

  await installModules(modules, resolvedModulePaths, nuxt)

  // Registered after modules so its `post` transform runs after auto-import injection.
  if (nuxt.options.experimental.navigateToEarlyReturn) {
    addBuildPlugin(NavigateToEarlyReturnPlugin())
  }

  if (nuxt.options.experimental.templateDiagnostics) {
    setupTemplateDiagnostics(nuxt)
  }

  if (nuxt.options.experimental.debugModuleMutation) {
    stripDebugProxies(nuxt.options)
  }

  // (Re)initialise ignore handler with resolved ignores from modules
  nuxt._ignore = ignore(nuxt.options.ignoreOptions)
  nuxt._ignore.add(resolveIgnorePatterns())

  await nuxt.callHook('modules:done')
  assertRuntimeConfigWithoutSchemas(nuxt)
  nuxt._perf?.endPhase('modules')
  nuxt._perf?.collectModuleTimings(nuxt.options._installedModules)

  // remove duplicate css after modules are done
  nuxt.options.css = nuxt.options.css
    .filter((value, index, array) => !array.includes(value, index + 1))

  warnUnresolvableGlobalCss(nuxt)

  if (!nuxt.options._prepare) {
    checkRuntimeConfig(nuxt)
  }

  await addBuiltinsAfterModules(nuxt)

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
      logger.info(`\`${linkToAlias(path, nuxt)}/\` created`)
      return nuxt.callHook('restart', { hard: true })
    }

    // Core Nuxt files: app.vue, error.vue and app.config.ts
    if ((event === 'add' || event === 'unlink') && RESTART_RE.test(path)) {
      logger.info(`\`${linkToAlias(path, nuxt)}\` ${event === 'add' ? 'created' : 'removed'}`)
      return nuxt.callHook('restart')
    }
  })

  // Normalize windows transpile paths added by modules
  nuxt.options.build.transpile = nuxt.options.build.transpile.map(t => typeof t === 'string' ? normalize(t).split('node_modules/').pop()! : t)

  addModuleTranspiles(nuxt)

  await bundleServer(nuxt)
  nuxt._perf?.startPhase('ready')

  addBuiltinsAfterServer(nuxt)

  await nuxt.callHook('ready', nuxt)
  nuxt._perf?.endPhase('ready')
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  await installProxyDispatcher()

  // Early-init profiler when CLI passes perf overrides (captures config loading).
  // Otherwise, create after config resolves from nuxt.config / env vars.
  let perf: NuxtPerfProfiler | undefined
  const cliStartTime = (globalThis as any).__nuxt_cli__?.startTime as number | undefined
  const perfOverride = typeof opts.overrides?.debug === 'object' && opts.overrides.debug.perf
  if (perfOverride) {
    perf = new NuxtPerfProfiler({ startTime: cliStartTime })
    perf.startPhase('config')
  }

  const options = await loadNuxtConfig(opts)

  if (!perf && typeof options.debug === 'object' && options.debug.perf) {
    perf = new NuxtPerfProfiler({ startTime: cliStartTime })
  }
  perf?.endPhase('config')

  // Temporary until finding better placement for each
  options.appDir = options.alias['#app'] = withTrailingSlash(resolve(distDir, 'app'))
  options.alias['nuxt/app'] ||= options.appDir
  options._majorVersion = 4

  // De-duplicate key arrays
  for (const key in options.app.head || {}) {
    options.app.head[key as 'link'] = deduplicateArray(options.app.head[key as 'link'])
  }

  // Nuxt DevTools only works for Vite
  if (options.builder === '@nuxt/vite-builder') {
    const isDevToolsEnabled = typeof options.devtools === 'boolean'
      ? options.devtools
      : options.devtools?.enabled !== false

    if (isDevToolsEnabled && !options._modules.some(m => m === '@nuxt/devtools-onboard' || m === '@nuxt/devtools' || m === '@nuxt/devtools-nightly' || m === '@nuxt/devtools-edge')) {
      options._modules.push('@nuxt/devtools-onboard')
    }
  }

  if (!options._modules.some(m => m === '@nuxt/scripts' || m === '@nuxt/scripts-nightly')) {
    options.imports = defu(options.imports, {
      presets: [scriptsStubsPreset],
    })
  }

  // Nuxt Webpack Builder is currently opt-in
  if (options.builder === '@nuxt/webpack-builder') {
    if (!await ensureDependencyInstalled('@nuxt/webpack-builder', {
      rootDir: options.rootDir,
      searchPaths: options.modulesDir,
    })) {
      configDiagnostics.NUXT_B5002({ rootDir: options.rootDir, installCommand: await getAddDependencyCommand('@nuxt/webpack-builder', options.rootDir, { dev: true }) })
    }
  }

  // Add core modules
  options._modules.push(pagesModule, metaModule, componentsModule)
  options._modules.push(compilerModule)
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
      configDiagnostics.NUXT_B5003({ key })
      delete options.runtimeConfig.app[key]
    }
  }

  const removedExperimental = REMOVED_EXPERIMENTAL_OPTIONS.filter(key => key in options.experimental)
  if (removedExperimental.length > 0) {
    configDiagnostics.NUXT_B5030({ options: removedExperimental.map(key => `\`experimental.${key}\``).join(', ') })
  }

  // Ensure we share key config between Nuxt and Nitro
  const nitroOptions: NitroConfig = options.nitro
  createPortalProperties(nitroOptions.runtimeConfig, options, ['nitro.runtimeConfig', 'runtimeConfig'])
  createPortalProperties(nitroOptions.routeRules, options, ['nitro.routeRules', 'routeRules'])
  createPortalProperties(nitroOptions.prerender, options, ['nitro.prerender', 'prerender'])
  // an entry written straight into the builder's own config is typed by the builder, and is a
  // superset of what Nuxt collects
  if (nitroOptions.handlers?.length && nitroOptions.handlers !== options.serverHandlers) {
    options.serverHandlers.unshift(...nitroOptions.handlers as ServerHandler[])
  }
  createPortalProperties(options.serverHandlers, options, ['nitro.handlers', 'serverHandlers'])
  if (nitroOptions.devHandlers?.length && nitroOptions.devHandlers !== options.devServerHandlers) {
    options.devServerHandlers.unshift(...nitroOptions.devHandlers as DevServerHandler[])
  }
  createPortalProperties(options.devServerHandlers, options, ['nitro.devHandlers', 'devServerHandlers'])
  createPortalProperties(nitroOptions.tracingChannel, options, ['nitro.tracingChannel', 'tracingChannel'])
  const serverTsConfig = defu(options.typescript.serverTsConfig, nitroOptions.typescript?.tsConfig)
  createPortalProperties(serverTsConfig, options, ['nitro.typescript.tsConfig', 'typescript.serverTsConfig'])

  // must follow the `runtimeConfig` portal, which repoints `options.runtimeConfig`
  if (options.dev) {
    await resolveDevAppSecret(options)
  }

  // prevent replacement of options.nitro
  Object.defineProperties(options, {
    nitro: {
      configurable: true,
      enumerable: true,
      get: () => nitroOptions,
      set (value) {
        Object.assign(nitroOptions, value)
      },
    },
  })

  const nuxt = createNuxt(options)

  if (perf) {
    perf.attach(nuxt)
  }

  nuxt.runWithContext(() => {
    // We register hooks layer-by-layer so any overrides need to be registered separately
    if (opts.overrides?.hooks) {
      nuxt.hooks.addHooks(opts.overrides.hooks)
    }

    const { debug } = nuxt.options
    if (debug && debug.hooks && (debug.hooks === true || debug.hooks.server)) {
      createDebugger(nuxt.hooks as Hookable<NuxtHooks>, { tag: 'nuxt' })
    }
  })

  // Restore cached buildId before modules are initialised so that the nitro
  // module (which captures buildId at init time) uses the correct value.
  if (!nuxt.options._prepare && !nuxt.options.dev && nuxt.options.experimental.buildCache) {
    nuxt.hooks.hookOnce('modules:before', () => restoreCachedBuildId(nuxt))
  }

  if (opts.ready !== false) {
    await nuxt.ready()
  }

  return nuxt
}

const RESTART_RE = /^(?:app|error|app\.config)\.(?:js|ts|mjs|jsx|tsx|vue)$/i

function deduplicateArray<T = unknown> (maybeArray: T): T {
  if (!Array.isArray(maybeArray)) { return maybeArray }

  const hashes = new Set<string>()
  return maybeArray.filter((item) => {
    const _hash = hash(item)
    if (hashes.has(_hash)) { return false }
    hashes.add(_hash)
    return true
  }) as T
}

function createPortalProperties (sourceValue: any, options: NuxtOptions, paths: string[]) {
  let sharedValue = sourceValue

  for (const path of paths) {
    const segments = path.split('.')
    const key = segments.pop()!
    let parent: Record<string, any> = options

    for (const segment of segments) {
      parent = parent[segment] ||= {}
    }

    delete parent[key]

    Object.defineProperty(parent, key, {
      configurable: true,
      enumerable: true,
      get: () => sharedValue,
      set (value) {
        sharedValue = value
      },
    })
  }
}

const RELATIVE_CSS_ENTRY_RE = /^\.{1,2}\//
/**
 * Warn about `css` entries that cannot resolve, which otherwise fail silently:
 * the dev server emits a `<link>` to a URL nothing serves, and production
 * builds drop the styles entirely.
 */
function warnUnresolvableGlobalCss (nuxt: Nuxt) {
  for (const entry of nuxt.options.css) {
    if (typeof entry !== 'string') { continue }

    if (RELATIVE_CSS_ENTRY_RE.test(entry)) {
      const absolute = resolve(nuxt.options.rootDir, entry)
      const asAlias = '~/' + relative(nuxt.options.srcDir, absolute)
      configDiagnostics.NUXT_B5025({ entry, replacement: existsSync(absolute) ? `\`${link(absolute, { formatter: () => asAlias })}\`` : 'an aliased or absolute path' })
      continue
    }

    // build-dir entries are generated later in startup, and bare specifiers may
    // be resolved by builder-specific aliases, so neither can be checked here
    const resolved = resolveAlias(entry, nuxt.options.alias)
    if (isAbsolute(resolved) && !resolved.startsWith(nuxt.options.buildDir) && !existsSync(resolved)) {
      configDiagnostics.NUXT_B5026({ entry, resolved: resolved === entry ? undefined : linkToAlias(resolved, nuxt) })
    }
  }
}
