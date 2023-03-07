import { join, normalize, relative, resolve } from 'pathe'
import { createHooks, createDebugger } from 'hookable'
import type { LoadNuxtOptions } from '@nuxt/kit'
import { resolvePath, resolveAlias, resolveFiles, loadNuxtConfig, nuxtCtx, installModule, addComponent, addVitePlugin, addWebpackPlugin, tryResolveModule, addPlugin } from '@nuxt/kit'

import escapeRE from 'escape-string-regexp'
import fse from 'fs-extra'
import { withoutLeadingSlash } from 'ufo'
/* eslint-disable import/no-restricted-paths */
import pagesModule from '../pages/module'
import metaModule from '../head/module'
import componentsModule from '../components/module'
import importsModule from '../imports/module'
/* eslint-enable */
import { distDir, pkgDir } from '../dirs'
import { version } from '../../package.json'
import { ImportProtectionPlugin, vueAppPatterns } from './plugins/import-protection'
import { UnctxTransformPlugin } from './plugins/unctx'
import type { TreeShakeComposablesPluginOptions } from './plugins/tree-shake'
import { TreeShakeComposablesPlugin } from './plugins/tree-shake'
import { DevOnlyPlugin } from './plugins/dev-only'
import { addModuleTranspiles } from './modules'
import { initNitro } from './nitro'
import schemaModule from './schema'
import type { Nuxt, NuxtOptions, NuxtHooks } from 'nuxt/schema'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = createHooks<NuxtHooks>()

  const nuxt: Nuxt = {
    _version: version,
    options,
    hooks,
    callHook: hooks.callHook,
    addHooks: hooks.addHooks,
    hook: hooks.hook,
    ready: () => initNuxt(nuxt),
    close: () => Promise.resolve(hooks.callHook('close', nuxt)),
    vfs: {}
  }

  return nuxt
}

async function initNuxt (nuxt: Nuxt) {
  // Register user hooks
  nuxt.hooks.addHooks(nuxt.options.hooks)

  // Set nuxt instance for useNuxt
  nuxtCtx.set(nuxt)
  nuxt.hook('close', () => nuxtCtx.unset())

  // Add nuxt types
  nuxt.hook('prepare:types', (opts) => {
    opts.references.push({ types: 'nuxt' })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/plugins.d.ts') })
    // Add vue shim
    if (nuxt.options.typescript.shim) {
      opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/vue-shim.d.ts') })
    }
    // Add module augmentations directly to NuxtConfig
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/schema.d.ts') })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/app.config.d.ts') })

    for (const layer of nuxt.options._layers) {
      const declaration = join(layer.cwd, 'index.d.ts')
      if (fse.existsSync(declaration)) {
        opts.references.push({ path: declaration })
      }
    }
  })

  // Add import protection
  const config = {
    rootDir: nuxt.options.rootDir,
    // Exclude top-level resolutions by plugins
    exclude: [join(nuxt.options.rootDir, 'index.html')],
    patterns: vueAppPatterns(nuxt)
  }
  addVitePlugin(ImportProtectionPlugin.vite(config))
  addWebpackPlugin(ImportProtectionPlugin.webpack(config))

  nuxt.hook('modules:done', () => {
    // Add unctx transform
    addVitePlugin(UnctxTransformPlugin(nuxt).vite({ sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client }))
    addWebpackPlugin(UnctxTransformPlugin(nuxt).webpack({ sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client }))

    // Add composable tree-shaking optimisations
    const serverTreeShakeOptions : TreeShakeComposablesPluginOptions = {
      sourcemap: nuxt.options.sourcemap.server,
      composables: nuxt.options.optimization.treeShake.composables.server
    }
    if (Object.keys(serverTreeShakeOptions.composables).length) {
      addVitePlugin(TreeShakeComposablesPlugin.vite(serverTreeShakeOptions), { client: false })
      addWebpackPlugin(TreeShakeComposablesPlugin.webpack(serverTreeShakeOptions), { client: false })
    }
    const clientTreeShakeOptions : TreeShakeComposablesPluginOptions = {
      sourcemap: nuxt.options.sourcemap.client,
      composables: nuxt.options.optimization.treeShake.composables.client
    }
    if (Object.keys(clientTreeShakeOptions.composables).length) {
      addVitePlugin(TreeShakeComposablesPlugin.vite(clientTreeShakeOptions), { server: false })
      addWebpackPlugin(TreeShakeComposablesPlugin.webpack(clientTreeShakeOptions), { server: false })
    }
  })

  if (!nuxt.options.dev) {
    // DevOnly component tree-shaking - build time only
    addVitePlugin(DevOnlyPlugin.vite({ sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client }))
    addWebpackPlugin(DevOnlyPlugin.webpack({ sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client }))
  }

  // TODO: [Experimental] Avoid emitting assets when flag is enabled
  if (nuxt.options.experimental.noScripts && !nuxt.options.dev) {
    nuxt.hook('build:manifest', async (manifest) => {
      for (const file in manifest) {
        if (manifest[file].resourceType === 'script') {
          await fse.rm(resolve(nuxt.options.buildDir, 'dist/client', withoutLeadingSlash(nuxt.options.app.buildAssetsDir), manifest[file].file), { force: true })
          manifest[file].file = ''
        }
      }
    })
  }

  // Transpile #app if it is imported directly from subpath export
  nuxt.options.build.transpile.push('nuxt/app')

  // Transpile layers within node_modules
  nuxt.options.build.transpile.push(
    ...nuxt.options._layers.filter(i => i.cwd.includes('node_modules')).map(i => i.cwd as string)
  )

  // Init user modules
  await nuxt.callHook('modules:before')
  const modulesToInstall = []

  const watchedPaths = new Set<string>()
  const specifiedModules = new Set<string>()

  for (const _mod of nuxt.options.modules) {
    const mod = Array.isArray(_mod) ? _mod[0] : _mod
    if (typeof mod !== 'string') { continue }
    const modPath = await resolvePath(resolveAlias(mod))
    specifiedModules.add(modPath)
  }

  // Automatically register user modules
  for (const config of nuxt.options._layers.map(layer => layer.config).reverse()) {
    const layerModules = await resolveFiles(config.srcDir, [
      `${config.dir?.modules || 'modules'}/*{${nuxt.options.extensions.join(',')}}`,
      `${config.dir?.modules || 'modules'}/*/index{${nuxt.options.extensions.join(',')}}`
    ])
    for (const mod of layerModules) {
      watchedPaths.add(relative(config.srcDir, mod))
      if (specifiedModules.has(mod)) { continue }
      specifiedModules.add(mod)
      modulesToInstall.push(mod)
    }
  }

  // Register user and then ad-hoc modules
  modulesToInstall.push(...nuxt.options.modules, ...nuxt.options._modules)

  nuxt.hooks.hookOnce('builder:watch', (event, path) => {
    if (watchedPaths.has(path)) { nuxt.callHook('restart', { hard: true }) }
  })

  // Add <NuxtWelcome>
  addComponent({
    name: 'NuxtWelcome',
    priority: 10, // built-in that we do not expect the user to override
    filePath: tryResolveModule('@nuxt/ui-templates/templates/welcome.vue')!
  })

  addComponent({
    name: 'NuxtLayout',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/layout')
  })

  // Add <NuxtErrorBoundary>
  addComponent({
    name: 'NuxtErrorBoundary',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-error-boundary')
  })

  // Add <ClientOnly>
  addComponent({
    name: 'ClientOnly',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/client-only')
  })

  // Add <DevOnly>
  addComponent({
    name: 'DevOnly',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/dev-only')
  })

  // Add <ServerPlaceholder>
  addComponent({
    name: 'ServerPlaceholder',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/server-placeholder')
  })

  // Add <NuxtLink>
  addComponent({
    name: 'NuxtLink',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-link')
  })

  // Add <NuxtLoadingIndicator>
  addComponent({
    name: 'NuxtLoadingIndicator',
    priority: 10, // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-loading-indicator')
  })

  // Add <NuxtIsland>
  if (nuxt.options.experimental.componentIslands) {
    addComponent({
      name: 'NuxtIsland',
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, 'components/nuxt-island')
    })
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
  if (nuxt.options.experimental.emitRouteChunkError === 'reload') {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/chunk-reload.client'))
  }

  // Track components used to render for webpack
  if (nuxt.options.builder === '@nuxt/webpack-builder') {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/preload.server'))
  }

  // Add nuxt app debugger
  if (nuxt.options.debug) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/debug'))
  }

  for (const m of modulesToInstall) {
    if (Array.isArray(m)) {
      await installModule(m[0], m[1])
    } else {
      await installModule(m, {})
    }
  }

  await nuxt.callHook('modules:done')

  // Normalize windows transpile paths added by modules
  nuxt.options.build.transpile = nuxt.options.build.transpile.map(t => typeof t === 'string' ? normalize(t) : t)

  addModuleTranspiles()

  // Init nitro
  await initNitro(nuxt)

  await nuxt.callHook('ready', nuxt)
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  const options = await loadNuxtConfig(opts)

  // Temporary until finding better placement for each
  options.appDir = options.alias['#app'] = resolve(distDir, 'app')
  options._majorVersion = 3
  options._modules.push(pagesModule, metaModule, componentsModule)
  options._modules.push([importsModule, {
    transform: {
      include: options._layers
        .filter(i => i.cwd && i.cwd.includes('node_modules'))
        .map(i => new RegExp(`(^|\\/)${escapeRE(i.cwd!.split('node_modules/').pop()!)}(\\/|$)(?!node_modules\\/)`))
    }
  }])
  options._modules.push(schemaModule)
  options.modulesDir.push(resolve(options.workspaceDir, 'node_modules'))
  options.modulesDir.push(resolve(pkgDir, 'node_modules'))
  options.build.transpile.push('@nuxt/ui-templates')
  options.alias['vue-demi'] = resolve(options.appDir, 'compat/vue-demi')
  options.alias['@vue/composition-api'] = resolve(options.appDir, 'compat/capi')
  if (options.telemetry !== false && !process.env.NUXT_TELEMETRY_DISABLED) {
    options._modules.push('@nuxt/telemetry')
  }

  const nuxt = createNuxt(options)

  if (nuxt.options.debug) {
    createDebugger(nuxt.hooks, { tag: 'nuxt' })
  }

  if (opts.ready !== false) {
    await nuxt.ready()
  }

  return nuxt
}
