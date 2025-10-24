import { existsSync } from 'node:fs'
import { isAbsolute, join, normalize, relative, resolve } from 'pathe'
import { addBuildPlugin, addImportsSources, addPluginTemplate, addTemplate, addTypeTemplate, addVitePlugin, defineNuxtModule, findPath, resolveAlias } from '@nuxt/kit'

import { resolveModulePath } from 'exsolve'
import { distDir } from '../dirs'
import { DECLARATION_EXTENSIONS, isDirectorySync, logger } from '../utils'
import { lazyHydrationMacroPreset } from '../imports/presets'
import { componentNamesTemplate, componentsDeclarationTemplate, componentsIslandsTemplate, componentsMetadataTemplate, componentsPluginTemplate, componentsTypeTemplate } from './templates'
import { scanComponents } from './scan'

import { LoaderPlugin } from './plugins/loader'
import { ComponentsChunkPlugin, IslandsTransformPlugin } from './plugins/islands-transform'
import { TransformPlugin } from './plugins/transform'
import { TreeShakeTemplatePlugin } from './plugins/tree-shake'
import { ComponentNamePlugin } from './plugins/component-names'
import { LazyHydrationTransformPlugin } from './plugins/lazy-hydration-transform'
import { LazyHydrationMacroTransformPlugin } from './plugins/lazy-hydration-macro-transform'
import type { Component, ComponentsDir, ComponentsOptions } from 'nuxt/schema'

const isPureObjectOrString = (val: unknown): val is object | string => (!Array.isArray(val) && typeof val === 'object') || typeof val === 'string'
const SLASH_SEPARATOR_RE = /[\\/]/
/**
 * Compare two directory entries by the number of path segments.
 *
 * Returns a sort comparator value based on the count of path segments (split on slashes). Deeper (more segments) paths are ordered before shallower ones.
 *
 * @param dirA - First directory
 * @param dirA.path - Path string
 * @param dirB - Second directory
 * @param dirB.path - Path string
 * @returns A negative number if the first directory should come before the second, positive if after, or 0 if equal
 */
function compareDirByPathLength ({ path: pathA }: { path: string }, { path: pathB }: { path: string }) {
  return pathB.split(SLASH_SEPARATOR_RE).filter(Boolean).length - pathA.split(SLASH_SEPARATOR_RE).filter(Boolean).length
}

const DEFAULT_COMPONENTS_DIRS_RE = /\/components(?:\/(?:global|islands))?$/
const STARTER_DOT_RE = /^\./g

export type getComponentsT = (mode?: 'client' | 'server' | 'all') => Component[]

export default defineNuxtModule<ComponentsOptions>({
  meta: {
    name: 'nuxt:components',
    configKey: 'components',
  },
  defaults: {
    dirs: [],
  },
  async setup (moduleOptions, nuxt) {
    let componentDirs: ComponentsDir[] = []
    const context = {
      components: [] as Component[],
    }

    const getComponents: getComponentsT = (mode) => {
      return (mode && mode !== 'all')
        ? context.components.filter(c => c.mode === mode || c.mode === 'all' || (c.mode === 'server' && !context.components.some(otherComponent => otherComponent.mode !== 'server' && otherComponent.pascalName === c.pascalName)))
        : context.components
    }

    // TODO: remove in Nuxt v5
    if (nuxt.options.experimental.normalizeComponentNames) {
      addBuildPlugin(ComponentNamePlugin({ sourcemap: !!nuxt.options.sourcemap.client, getComponents }), { server: false })
      addBuildPlugin(ComponentNamePlugin({ sourcemap: !!nuxt.options.sourcemap.server, getComponents }), { client: false })
    }

    // Resolve dirs
    nuxt.hook('app:resolve', async () => {
      // components/ dirs from all layers
      const allDirs: ComponentsDir[] = []
      for (const layer of nuxt.options._layers) {
        const layerDirs = normalizeDirs(layer.config.components, layer.config.srcDir, { priority: layer.config.srcDir === nuxt.options.srcDir ? 1 : 0 })
        allDirs.push(...layerDirs)
      }

      await nuxt.callHook('components:dirs', allDirs)

      const userComponentDirs: ComponentsDir[] = []
      const libraryComponentDirs: ComponentsDir[] = []

      for (const dir of allDirs) {
        if (!isPureObjectOrString(dir)) {
          continue
        }

        const dirOptions = typeof dir === 'object' ? dir : { path: dir }
        const dirPath = resolveAlias(dirOptions.path)
        const extensions = (dirOptions.extensions || nuxt.options.extensions).map(e => e.replace(STARTER_DOT_RE, ''))
        const _transpile = typeof dirOptions.transpile === 'boolean' ? dirOptions.transpile : 'auto'
        const transpile = _transpile === 'auto' ? dirPath.includes('node_modules') : _transpile
        if (transpile) {
          nuxt.options.build.transpile.push(dirPath)
        }

        const present = isDirectorySync(dirPath)
        if (!present && !DEFAULT_COMPONENTS_DIRS_RE.test(dirOptions.path)) {
          logger.warn('Components directory not found: `' + dirPath + '`')
        }

        const dirs = dirPath.includes('node_modules') ? libraryComponentDirs : userComponentDirs

        dirs.push({
          global: moduleOptions.global,
          ...dirOptions,
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || (extensions.length > 1 ? `**/*.{${extensions.join(',')}}` : `**/*.${extensions[0] || '*'}`),
          ignore: [
            '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}', // ignore mixins
            `**/*.{${DECLARATION_EXTENSIONS.join(',')}}`, // .d.ts files
            ...(dirOptions.ignore || []),
          ],
          transpile,
        })
      }

      componentDirs = [
        ...userComponentDirs,
        ...libraryComponentDirs,
      ]
    })

    // components.d.ts
    addTemplate(componentsDeclarationTemplate)
    // types/components.d.ts
    addTypeTemplate(componentsTypeTemplate)
    // components.plugin.mjs
    addPluginTemplate(componentsPluginTemplate)
    // component-names.mjs
    addTemplate(componentNamesTemplate)
    // components.islands.mjs
    addTemplate(componentsIslandsTemplate)

    if (moduleOptions.generateMetadata) {
      addTemplate(componentsMetadataTemplate)
    }

    const serverComponentRuntime = await findPath(join(distDir, 'components/runtime/server-component')) ?? join(distDir, 'components/runtime/server-component')
    addBuildPlugin(TransformPlugin(nuxt, { getComponents, serverComponentRuntime, mode: 'server' }), { server: true, client: false })
    addBuildPlugin(TransformPlugin(nuxt, { getComponents, serverComponentRuntime, mode: 'client' }), { server: false, client: true })

    // Do not prefetch global components chunks
    nuxt.hook('build:manifest', (manifest) => {
      const sourceFiles = new Set<string>()
      for (const c of getComponents()) {
        if (c.global) {
          sourceFiles.add(relative(nuxt.options.srcDir, c.filePath))
        }
      }

      for (const chunk of Object.values(manifest)) {
        if (chunk.isEntry) {
          chunk.dynamicImports = chunk.dynamicImports?.filter(i => !sourceFiles.has(i))
        }
      }
    })

    // Restart dev server when component directories are added/removed
    const restartEvents = new Set(['addDir', 'unlinkDir'])
    // const restartPaths
    nuxt.hook('builder:watch', (event, relativePath) => {
      if (!restartEvents.has(event)) {
        return
      }

      const path = resolve(nuxt.options.srcDir, relativePath)
      if (componentDirs.some(dir => dir.path === path)) {
        logger.info(`Directory \`${relativePath}/\` ${event === 'addDir' ? 'created' : 'removed'}`)
        return nuxt.callHook('restart')
      }
    })

    const serverPlaceholderPath = await findPath(join(distDir, 'app/components/server-placeholder')) ?? join(distDir, 'app/components/server-placeholder')

    // Scan components and add to plugin
    nuxt.hook('app:templates', async (app) => {
      const newComponents = await scanComponents(componentDirs, nuxt.options.srcDir!)
      await nuxt.callHook('components:extend', newComponents)
      // add server placeholder for .client components server side. issue: #7085
      for (const component of newComponents) {
        if (!(component as any /* untyped internal property */)._scanned && !(component.filePath in nuxt.vfs) && isAbsolute(component.filePath) && !existsSync(component.filePath)) {
          // attempt to resolve component path
          component.filePath = resolveModulePath(resolveAlias(component.filePath), { try: true, extensions: nuxt.options.extensions }) ?? component.filePath
        }
        if (component.mode === 'client' && !newComponents.some(c => c.pascalName === component.pascalName && c.mode === 'server')) {
          newComponents.push({
            ...component,
            _raw: true,
            mode: 'server',
            filePath: serverPlaceholderPath,
            chunkName: 'components/' + component.kebabName,
          })
        }
        if (component.mode === 'server' && !nuxt.options.ssr && !newComponents.some(other => other.pascalName === component.pascalName && other.mode === 'client')) {
          logger.warn(`Using server components with \`ssr: false\` is not supported with auto-detected component islands. If you need to use server component \`${component.pascalName}\`, set \`experimental.componentIslands\` to \`true\`.`)
        }
      }
      context.components = newComponents
      app.components = newComponents
    })

    nuxt.hook('prepare:types', ({ tsConfig }) => {
      tsConfig.compilerOptions!.paths['#components'] = [resolve(nuxt.options.buildDir, 'components')]
    })

    addBuildPlugin(TreeShakeTemplatePlugin({ sourcemap: !!nuxt.options.sourcemap.server, getComponents }), { client: false })

    const clientDelayedComponentRuntime = await findPath(join(distDir, 'components/runtime/lazy-hydrated-component')) ?? join(distDir, 'components/runtime/lazy-hydrated-component')

    const sharedLoaderOptions = {
      getComponents,
      clientDelayedComponentRuntime,
      serverComponentRuntime,
      srcDir: nuxt.options.srcDir,
      transform: typeof nuxt.options.components === 'object' && !Array.isArray(nuxt.options.components) ? nuxt.options.components.transform : undefined,
      experimentalComponentIslands: !!nuxt.options.experimental.componentIslands,
    }

    addBuildPlugin(LoaderPlugin({ ...sharedLoaderOptions, sourcemap: !!nuxt.options.sourcemap.client, mode: 'client' }), { server: false })
    addBuildPlugin(LoaderPlugin({ ...sharedLoaderOptions, sourcemap: !!nuxt.options.sourcemap.server, mode: 'server' }), { client: false })

    if (nuxt.options.experimental.lazyHydration) {
      addBuildPlugin(LazyHydrationTransformPlugin({
        ...sharedLoaderOptions,
        sourcemap: !!(nuxt.options.sourcemap.server || nuxt.options.sourcemap.client),
      }), { prepend: true })

      addBuildPlugin(LazyHydrationMacroTransformPlugin({
        ...sharedLoaderOptions,
        sourcemap: !!(nuxt.options.sourcemap.server || nuxt.options.sourcemap.client),
        alias: nuxt.options.alias,
      }))

      addImportsSources(lazyHydrationMacroPreset)
    }

    if (nuxt.options.experimental.componentIslands) {
      const selectiveClient = typeof nuxt.options.experimental.componentIslands === 'object' && nuxt.options.experimental.componentIslands.selectiveClient

      addVitePlugin({
        name: 'nuxt-server-component-hmr',
        handleHotUpdate (ctx) {
          const components = getComponents()
          const filePath = normalize(ctx.file)
          const comp = components.find(c => c.filePath === filePath)
          if (comp?.mode === 'server') {
            ctx.server.ws.send({
              event: `nuxt-server-component:${comp.pascalName}`,
              type: 'custom',
            })
          }
        },
      }, { server: false })

      addBuildPlugin(IslandsTransformPlugin({ getComponents, selectiveClient }), { client: false, prepend: true })

      if (selectiveClient && nuxt.options.builder === '@nuxt/vite-builder') {
        addVitePlugin(() => ComponentsChunkPlugin({ dev: nuxt.options.dev, getComponents }))
      } else {
        addTemplate({
          filename: 'component-chunk.mjs',
          getContents: () => `export default {}`,
        })
      }
    }
  },
})

/**
 * Normalize the various user-provided `components.dirs` shapes into a flat array of ComponentsDir entries.
 *
 * Handles:
 * - Arrays (recursively flattened and sorted by path depth),
 * - `true`/`undefined` (returns default islands, global, and components dirs under `cwd`),
 * - Strings (resolved against `cwd` and alias resolution),
 * - Objects (either a single dir shape or an object with a `dirs` array).
 *
 * Each resulting entry has its `path` resolved via `resolveAlias` and `cwd`, receives a `priority` from `options.priority` (default 0), and entries without a `path` are skipped. The final list is sorted by path depth (shallowest first).
 *
 * @param dir - The raw `dirs` configuration value (single entry, array, true/undefined for defaults, or an options object).
 * @param cwd - Base directory used to resolve relative `path` values.
 * @param options - Optional settings; currently supports `priority` to assign a priority to all returned entries.
 * @param options.priority - Priority number to assign to all returned entries (default 0).
 * @returns A normalized, flat, and sorted array of ComponentsDir objects ready for component scanning.
 */
function normalizeDirs (dir: undefined | boolean | ComponentsOptions | ComponentsOptions['dirs'] | ComponentsOptions['dirs'][number], cwd: string, options?: { priority?: number }): ComponentsDir[] {
  if (Array.isArray(dir)) {
    return dir.map(dir => normalizeDirs(dir, cwd, options)).flat().sort(compareDirByPathLength)
  }
  if (dir === true || dir === undefined) {
    return [
      { priority: options?.priority || 0, path: resolve(cwd, 'components/islands'), island: true },
      { priority: options?.priority || 0, path: resolve(cwd, 'components/global'), global: true },
      { priority: options?.priority || 0, path: resolve(cwd, 'components') },
    ]
  }
  if (typeof dir === 'string') {
    return [
      { priority: options?.priority || 0, path: resolve(cwd, resolveAlias(dir)) },
    ]
  }
  if (!dir) {
    return []
  }

  const normalizedDirs: ComponentsDir[] = []
  for (const d of ('dirs' in dir ? dir.dirs || [] : [dir])) {
    const normalizedDir = typeof d === 'string' ? { path: d } : d
    if (!normalizedDir.path) {
      continue
    }
    normalizedDirs.push({
      priority: options?.priority || 0,
      ...normalizedDir,
      path: resolve(cwd, resolveAlias(normalizedDir.path)),
    })
  }

  return normalizedDirs.sort(compareDirByPathLength)
}
