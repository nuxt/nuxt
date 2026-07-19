import { existsSync } from 'node:fs'
import { genArrayFromRaw, genDynamicImport, genExport, genImport, genObjectFromRawEntries, genSafeVariableName, genString } from 'knitwork'
import { join, relative, resolve } from 'pathe'
import type { JSValue } from 'untyped'
import { generateTypes, resolveSchema } from 'untyped'
import escapeRE from 'escape-string-regexp'
import { resolveModulePath } from 'exsolve'
import { hash } from 'ohash'
import { camelCase } from 'scule'
import { filename, reverseResolveAlias } from 'pathe/utils'
import { useNitro } from '@nuxt/kit'

import { annotatePlugins, checkForCircularDependencies, filterPluginDependencies, hasIslandOptOutPlugins, hasParallelPlugins, hasPluginDependencies, hasPluginHooks, sortPluginsByDependsOn } from './app.ts'
import { setPluginDependenciesForMode } from './plugins/plugin-metadata.ts'
import { EXTENSION_RE } from './utils/index.ts'
import type { NuxtApp, NuxtOptions, NuxtTemplate } from 'nuxt/schema'
import type { Nitro } from 'nitro/types'

const defuPath = resolveModulePath('defu', { try: true, from: import.meta.url }) ?? 'defu'

export const vueShim: NuxtTemplate = {
  filename: 'types/vue-shim.d.ts',
  getContents: ({ nuxt }) => {
    if (!nuxt.options.typescript.shim) {
      return ''
    }

    return [
      'declare module \'*.vue\' {',
      '  import { DefineComponent } from \'vue\'',
      '  const component: DefineComponent<{}, {}, any>',
      '  export default component',
      '}',
    ].join('\n')
  },
}

// TODO: Use an alias
export const appComponentTemplate: NuxtTemplate = {
  filename: 'app-component.mjs',
  getContents: ctx => genExport(ctx.app.mainComponent!, ['default']),
}
// TODO: Use an alias
export const rootComponentTemplate: NuxtTemplate = {
  filename: 'root-component.mjs',
  // TODO: fix upstream in vite - this ensures that vite generates a module graph for islands
  // but should not be necessary (and has a warmup performance cost). See https://github.com/nuxt/nuxt/pull/24584.
  getContents: ctx => (ctx.nuxt.options.dev ? 'import \'#build/components.islands.mjs\';\n' : '') + genExport(ctx.app.rootComponent!, ['default']),
}
// TODO: Use an alias
export const errorComponentTemplate: NuxtTemplate = {
  filename: 'error-component.mjs',
  getContents: ctx => genExport(ctx.app.errorComponent!, ['default']),
}
export const islandRendererTemplate: NuxtTemplate = {
  filename: 'island-renderer.mjs',
  getContents (ctx) {
    if (!shouldEnableComponentIslands(ctx.nuxt, ctx.app)) {
      return 'const IslandRenderer = () => null\nexport default IslandRenderer'
    }

    const islandRenderer = resolve(ctx.nuxt.options.appDir, 'components/island-renderer')
    return [
      'import { defineAsyncComponent } from \'vue\'',
      `const IslandRenderer = import.meta.server ? defineAsyncComponent(() => ${genDynamicImport(islandRenderer, { wrapper: false })}.then(r => r.default || r)) : () => null`,
      'export default IslandRenderer',
    ].join('\n')
  },
}
// TODO: Use an alias
export const testComponentWrapperTemplate: NuxtTemplate = {
  filename: 'test-component-wrapper.mjs',
  getContents: ctx => genExport(resolve(ctx.nuxt.options.appDir, 'components/test-component-wrapper'), ['default']),
}

export const cssTemplate: NuxtTemplate = {
  filename: 'css.mjs',
  getContents: ctx => ctx.nuxt.options.css.map(i => genImport(i)).join('\n'),
}

const PLUGIN_TEMPLATE_RE = /_(?:45|46|47)/g
export const clientPluginTemplate: NuxtTemplate = {
  filename: 'plugins.client.mjs',
  async getContents (ctx) {
    const allPlugins = await annotatePlugins(ctx.nuxt, ctx.app.plugins.filter(p => ctx.nuxt.options.dev || !p.mode || p.mode !== 'server'))
    const clientPlugins = sortPluginsByDependsOn(filterPluginDependencies(allPlugins.filter(p => !p.mode || p.mode !== 'server'), { warn: ctx.nuxt.options.dev, mode: 'client', allPlugins }))
    setPluginDependenciesForMode(ctx.nuxt, 'client', clientPlugins)
    checkForCircularDependencies(clientPlugins)
    const exports: string[] = []
    const imports: string[] = []
    for (const plugin of clientPlugins) {
      const path = relative(ctx.nuxt.options.rootDir, plugin.src)
      const variable = genSafeVariableName(filename(plugin.src) || path).replace(PLUGIN_TEMPLATE_RE, '_') + '_' + hash(path).replace(/-/g, '_')
      exports.push(variable)
      imports.push(genImport(plugin.src, variable))
    }
    return [
      ...imports,
      `export default ${genArrayFromRaw(exports)}`,
    ].join('\n')
  },
}

export const serverPluginTemplate: NuxtTemplate = {
  filename: 'plugins.server.mjs',
  async getContents (ctx) {
    const allPlugins = await annotatePlugins(ctx.nuxt, ctx.app.plugins.filter(p => ctx.nuxt.options.dev || !p.mode || p.mode !== 'client'))
    const serverPlugins = sortPluginsByDependsOn(filterPluginDependencies(allPlugins.filter(p => !p.mode || p.mode !== 'client'), { warn: ctx.nuxt.options.dev, mode: 'server', allPlugins }))
    setPluginDependenciesForMode(ctx.nuxt, 'server', serverPlugins)
    checkForCircularDependencies(serverPlugins)
    const exports: string[] = []
    const imports: string[] = []
    for (const plugin of serverPlugins) {
      const path = relative(ctx.nuxt.options.rootDir, plugin.src)
      const variable = genSafeVariableName(filename(plugin.src) || path).replace(PLUGIN_TEMPLATE_RE, '_') + '_' + hash(path).replace(/-/g, '_')
      exports.push(variable)
      imports.push(genImport(plugin.src, variable))
    }
    return [
      ...imports,
      `export default ${genArrayFromRaw(exports)}`,
    ].join('\n')
  },
}

const TS_RE = /\.[cm]?tsx?$/
const JS_LETTER_RE = /\.(?<letter>[cm])?jsx?$/
export const pluginsDeclaration: NuxtTemplate = {
  filename: 'types/plugins.d.ts',
  getContents: async ({ nuxt, app }) => {
    const EXTENSION_RE = new RegExp(`(?<=\\w)(${nuxt.options.extensions.map(e => escapeRE(e)).join('|')})$`, 'g')

    const typesDir = join(nuxt.options.buildDir, 'types')
    const tsImports: string[] = []
    const pluginNames: string[] = []

    function exists (path: string) {
      return app.templates.some(t => t.write && path === t.dst) || existsSync(path)
    }

    for (const plugin of await annotatePlugins(nuxt, app.plugins)) {
      if (plugin.name) {
        pluginNames.push(`'${plugin.name}'`)
      }

      const pluginPath = resolve(typesDir, plugin.src)
      const relativePath = relative(typesDir, pluginPath)

      const correspondingDeclaration = pluginPath.replace(JS_LETTER_RE, '.d.$<letter>ts')
      // if `.d.ts` file exists alongside a `.js` plugin, or if `.d.mts` file exists alongside a `.mjs` plugin, we can use the entire path
      if (correspondingDeclaration !== pluginPath && exists(correspondingDeclaration)) {
        tsImports.push(relativePath)
        continue
      }

      // if there is no declaration we only want to remove the extension if it's a TypeScript file
      if (exists(pluginPath)) {
        if (TS_RE.test(pluginPath)) {
          tsImports.push(relativePath.replace(EXTENSION_RE, ''))
          continue
        }
        tsImports.push(relativePath)
      }

      // No declaration found that TypeScript can use
    }

    return `// Generated by Nuxt'
import type { Plugin } from '#app'

type Decorate<T extends Record<string, any>> = { [K in keyof T as K extends string ? \`$\${K}\` : never]: T[K] }

type InjectionType<A extends Plugin> = A extends {default: Plugin<infer T>} ? Decorate<T> : unknown

type NuxtAppInjections = \n  ${tsImports.map(p => `InjectionType<typeof ${genDynamicImport(p, { wrapper: false })}>`).join(' &\n  ')}

declare module '#app' {
  interface NuxtApp extends NuxtAppInjections { }

  interface NuxtAppLiterals {
    pluginName: ${pluginNames.join(' | ')}
  }
}

declare module 'vue' {
  interface ComponentCustomProperties extends NuxtAppInjections { }
}

export { }
`
  },
}

const IMPORT_NAME_RE = /\.\w+$/
const GIT_RE = /^git\+/
export const schemaTemplate: NuxtTemplate = {
  filename: 'types/runtime-config.d.ts',
  getContents: async ({ nuxt }) => {
    const privateRuntimeConfig = Object.create(null)
    for (const key in nuxt.options.runtimeConfig) {
      if (key !== 'public' && key !== 'nitro') {
        privateRuntimeConfig[key] = nuxt.options.runtimeConfig[key]
      }
    }

    return [
      `import { RuntimeConfig as UserRuntimeConfig, PublicRuntimeConfig as UserPublicRuntimeConfig } from 'nuxt/schema'`,
      generateTypes(await resolveSchema(privateRuntimeConfig as Record<string, JSValue>),
        {
          interfaceName: 'SharedRuntimeConfig',
          addExport: false,
          addDefaults: false,
          allowExtraKeys: false,
          indentation: 2,
        }),
      generateTypes(await resolveSchema(nuxt.options.runtimeConfig.public as Record<string, JSValue>),
        {
          interfaceName: 'SharedPublicRuntimeConfig',
          addExport: false,
          addDefaults: false,
          allowExtraKeys: false,
          indentation: 2,
        }),
      `declare module '@nuxt/schema' {`,
      `  interface RuntimeConfig extends UserRuntimeConfig {}`,
      `  interface PublicRuntimeConfig extends UserPublicRuntimeConfig {}`,
      `}`,
      `declare module 'nuxt/schema' {`,
      `  interface RuntimeConfig extends SharedRuntimeConfig {}`,
      `  interface PublicRuntimeConfig extends SharedPublicRuntimeConfig {}`,
      '}',
      `declare module 'vue' {
        interface ComponentCustomProperties {
          $config: UserRuntimeConfig
        }
      }`,
    ].join('\n')
  },
}
export const schemaNodeTemplate: NuxtTemplate = {
  filename: 'types/modules.d.ts',
  getContents: ({ nuxt }) => {
    const relativeRoot = relative(resolve(nuxt.options.buildDir, 'types'), nuxt.options.rootDir)
    const getImportName = (name: string) => (name[0] === '.' ? './' + join(relativeRoot, name) : name).replace(IMPORT_NAME_RE, '')

    const modules: [string, string, NuxtOptions['_installedModules'][number]][] = []
    for (const m of nuxt.options._installedModules) {
      // modules without sufficient metadata
      if (!m.meta || !m.meta.configKey || !m.meta.name) {
        continue
      }
      // core nuxt modules
      if (m.meta.name.startsWith('nuxt:') || m.meta.name === 'nuxt-config-schema') {
        continue
      }
      modules.push([genString(m.meta.configKey), getImportName(m.entryPath || m.meta.name), m])
    }

    const moduleOptionsInterface = (options: { addJSDocTags: boolean, unresolved: boolean }) => [
      ...modules.flatMap(([configKey, importName, mod]) => {
        let link: string | undefined

        // If it's not a local module, provide a link based on its name
        if (!mod.meta?.rawPath) {
          link = `https://www.npmjs.com/package/${importName}`
        }

        if (typeof mod.meta?.docs === 'string') {
          link = mod.meta.docs
        } else if (mod.meta?.repository) {
          if (typeof mod.meta.repository === 'string') {
            link = mod.meta.repository
          } else if (typeof mod.meta.repository === 'object' && 'url' in mod.meta.repository && typeof mod.meta.repository.url === 'string') {
            link = mod.meta.repository.url
          }
          if (link) {
            if (link.startsWith('git+')) {
              link = link.replace(GIT_RE, '')
            }
            if (!link.startsWith('http')) {
              link = 'https://github.com/' + link
            }
          }
        }

        return [
          `    /**`,
          `     * Configuration for \`${importName}\``,
          ...options.addJSDocTags && link ? [`     * @see ${link}`] : [],
          `     */`,
          `    [${configKey}]${options.unresolved ? '?' : ''}: typeof ${genDynamicImport(importName, { wrapper: false })}.default extends NuxtModule<infer O, unknown, boolean> ? ${options.unresolved ? 'Partial<O>' : 'O'} | false : Record<string, any> | false`,
        ]
      }),
      modules.length > 0 && options.unresolved ? `    modules?: (undefined | null | false | NuxtModule<any> | string | [NuxtModule | string, Record<string, any>] | ${modules.map(([configKey, importName, mod]) => `[${genString(mod.meta?.rawPath || importName)}, Exclude<NuxtConfig[${configKey}], boolean>]`).join(' | ')})[],` : '',
    ].filter(Boolean)

    const moduleDependencies = modules.flatMap(([_configKey, importName, mod]) => [
      `    [${genString(mod.meta.name || importName)}]?: ModuleDependencyMeta<typeof ${genDynamicImport(importName, { wrapper: false })}.default extends NuxtModule<infer O> ? O | false : Record<string, unknown>> | false`,
    ]).join('\n')

    return [
      'import { NuxtModule, ModuleDependencyMeta } from \'@nuxt/schema\'',
      'declare module \'@nuxt/schema\' {',
      '  interface ModuleDependencies {',
      moduleDependencies,
      '  }',
      '  interface NuxtOptions {',
      ...moduleOptionsInterface({ addJSDocTags: false, unresolved: false }),
      '  }',
      '  interface NuxtConfig {',
      // TypeScript will duplicate the jsdoc tags if we augment it twice
      // So here we only generate tags for `nuxt/schema`
      ...moduleOptionsInterface({ addJSDocTags: false, unresolved: true }),
      '  }',
      '}',
      'declare module \'nuxt/schema\' {',
      '  interface ModuleDependencies {',
      moduleDependencies,
      '  }',
      '  interface NuxtOptions {',
      ...moduleOptionsInterface({ addJSDocTags: true, unresolved: false }),
      '  }',
      '  interface NuxtConfig {',
      ...moduleOptionsInterface({ addJSDocTags: true, unresolved: true }),
      '  }',
      '}',
    ].join('\n')
  },
}

// Add layouts template
export const layoutTemplate: NuxtTemplate = {
  filename: 'layouts.mjs',
  getContents ({ app }) {
    const layoutsObject = genObjectFromRawEntries(Object.values(app.layouts).map(({ name, file }) => {
      return [name, `defineAsyncComponent(${genDynamicImport(file, { interopDefault: true })})`]
    }))
    return [
      `import { defineAsyncComponent } from 'vue'`,
      `export default ${layoutsObject}`,
    ].join('\n')
  },
}

// Add middleware template
export const middlewareTemplate: NuxtTemplate = {
  filename: 'middleware.mjs',
  getContents ({ app, nuxt }) {
    const globalMiddleware = app.middleware.filter(mw => mw.global)
    const namedMiddleware = app.middleware.filter(mw => !mw.global)
    const alias = nuxt.options.dev ? { ...nuxt?.options.alias || {}, ...strippedAtAliases } : {}
    return [
      ...globalMiddleware.map(mw => genImport(mw.path, genSafeVariableName(mw.name))),
      ...!nuxt.options.dev
        ? [
            `export const globalMiddleware = ${genArrayFromRaw(globalMiddleware.map(mw => genSafeVariableName(mw.name)))}`,
            `export const namedMiddleware = ${genObjectFromRawEntries(namedMiddleware.map(mw => [mw.name, genDynamicImport(mw.path)]))}`,
          ]
        : [
            `const _globalMiddleware = ${genObjectFromRawEntries(globalMiddleware.map(mw => [reverseResolveAlias(mw.path, alias).pop() || mw.path, genSafeVariableName(mw.name)]))}`,
            `for (const path in _globalMiddleware) {`,
            `  Object.defineProperty(_globalMiddleware[path], '_path', { value: path, configurable: true })`,
            `}`,
            `export const globalMiddleware = Object.values(_globalMiddleware)`,
            `const _namedMiddleware = ${genArrayFromRaw(namedMiddleware.map(mw => ({
              name: genString(mw.name),
              path: genString(reverseResolveAlias(mw.path, alias).pop() || mw.path),
              import: genDynamicImport(mw.path),
            })))}`,
            `for (const mw of _namedMiddleware) {`,
            `  const i = mw.import`,
            `  mw.import = () => i().then(r => {`,
            `    Object.defineProperty(r.default || r, '_path', { value: mw.path, configurable: true })`,
            `    return r`,
            `  })`,
            `}`,
            `export const namedMiddleware = Object.fromEntries(_namedMiddleware.map(mw => [mw.name, mw.import]))`,
          ],

    ].join('\n')
  },
}

export const clientConfigTemplate: NuxtTemplate = {
  filename: 'nitro.client.mjs',
  getContents: ({ nuxt }) => {
    const appId = JSON.stringify(nuxt.options.appId)
    return [
      'export const useRuntimeConfig = () => ',
      (!nuxt.options.future.multiApp
        ? 'window?.__NUXT__?.config || window?.useNuxtApp?.().payload?.config'
        : `window?.__NUXT__?.[${appId}]?.config || window?.useNuxtApp?.(${appId}).payload?.config`)
        || {},
    ].join('\n')
  },
}

const APP_CONFIG_MERGE_TYPES = `type IsAny<T> = 0 extends 1 & T ? true : false

type MergedAppConfig<Resolved extends Record<string, unknown>, Custom extends Record<string, unknown>> = {
  [K in keyof (Resolved & Custom)]: K extends keyof Custom
    ? unknown extends Custom[K]
      ? Resolved[K]
      : IsAny<Custom[K]> extends true
        ? Resolved[K]
        : Custom[K] extends Record<string, any>
            ? Resolved[K] extends Record<string, any>
              ? MergedAppConfig<Resolved[K], Custom[K]>
              : Exclude<Custom[K], undefined>
            : Exclude<Custom[K], undefined>
    : Resolved[K]
}`

export const appConfigDeclarationTemplate: NuxtTemplate = {
  filename: 'types/app.config.d.ts',
  getContents ({ app, nuxt }) {
    const typesDir = join(nuxt.options.buildDir, 'types')
    const configPaths = app.configs.map(path => relative(typesDir, path).replace(EXTENSION_RE, ''))

    return `
import type { AppConfigInput, CustomAppConfig } from 'nuxt/schema'
import type { Defu } from 'defu'
${configPaths.map((id: string, index: number) => `import ${`cfg${index}`} from ${JSON.stringify(id)}`).join('\n')}

declare global {
  const defineAppConfig: <C extends AppConfigInput> (config: C) => C
}

declare const inlineConfig = ${JSON.stringify(nuxt.options.appConfig, null, 2)}
type ResolvedAppConfig = Defu<typeof inlineConfig, [${app.configs.map((_id: string, index: number) => `typeof cfg${index}`).join(', ')}]>
${APP_CONFIG_MERGE_TYPES}

declare module 'nuxt/schema' {
  interface AppConfig extends MergedAppConfig<ResolvedAppConfig, CustomAppConfig> { }
}
declare module '@nuxt/schema' {
  interface AppConfig extends MergedAppConfig<ResolvedAppConfig, CustomAppConfig> { }
}
`
  },
}

// This declaration must not import user `app.config` files: their import graph
// can rely on app auto-imports, which do not exist in the shared, node and
// server programs (https://github.com/nuxt/nuxt/issues/34140).
export const sharedAppConfigDeclarationTemplate: NuxtTemplate = {
  filename: 'types/shared-app.config.d.ts',
  getContents ({ nuxt }) {
    return `
import type { CustomAppConfig } from 'nuxt/schema'

declare const inlineConfig = ${JSON.stringify(nuxt.options.appConfig, null, 2)}
${APP_CONFIG_MERGE_TYPES}

declare module 'nuxt/schema' {
  interface AppConfig extends MergedAppConfig<typeof inlineConfig, CustomAppConfig> { }
}
declare module '@nuxt/schema' {
  interface AppConfig extends MergedAppConfig<typeof inlineConfig, CustomAppConfig> { }
}
`
  },
}

export const appConfigTemplate: NuxtTemplate = {
  filename: 'app.config.mjs',
  write: true,
  getContents ({ app, nuxt }) {
    return `
import { defuFn } from ${JSON.stringify(defuPath)}

const inlineConfig = ${JSON.stringify(nuxt.options.appConfig, null, 2)}

/** client **/
import { _replaceAppConfig } from '#app/config'

// Vite - webpack is handled directly in #app/config
if (import.meta.dev && !import.meta.nitro && import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    _replaceAppConfig(newModule.default)
  })
}
/** client-end **/

${app.configs.map((id: string, index: number) => `import ${`cfg${index}`} from ${JSON.stringify(id)}`).join('\n')}

export default /*@__PURE__*/ defuFn(${app.configs.map((_id: string, index: number) => `cfg${index}`).concat(['inlineConfig']).join(', ')})
`
  },
}

export const publicPathTemplate: NuxtTemplate = {
  filename: 'paths.mjs',
  getContents ({ nuxt }) {
    return [
      'import { joinRelativeURL } from \'ufo\'',
      !nuxt.options.dev && 'import { useRuntimeConfig } from \'nitro/runtime-config\'',

      nuxt.options.dev
        ? `const getAppConfig = () => (${JSON.stringify(nuxt.options.app)})`
        : 'const getAppConfig = () => useRuntimeConfig().app',

      'export const baseURL = () => getAppConfig().baseURL',
      'export const buildAssetsDir = () => getAppConfig().buildAssetsDir',

      'export const buildAssetsURL = (...path) => joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path)',

      'export const publicAssetsURL = (...path) => {',
      '  const appConfig = getAppConfig()',
      '  const publicBase = appConfig.cdnURL || appConfig.baseURL',
      '  return path.length ? joinRelativeURL(publicBase, ...path) : publicBase',
      '}',

      // On server these are registered directly in packages/nuxt/src/core/runtime/nitro/handlers/renderer.ts
      'if (import.meta.client) {',
      '  globalThis.__buildAssetsURL = buildAssetsURL',
      '  globalThis.__publicAssetsURL = publicAssetsURL',
      '}',
    ].filter(Boolean).join('\n')
  },
}

export const globalPolyfillsTemplate: NuxtTemplate = {
  filename: 'global-polyfills.mjs',
  getContents () {
    // Node.js compatibility
    return `
if (!("global" in globalThis)) {
  globalThis.global = globalThis;
}`
  },
}

export const dollarFetchTemplate: NuxtTemplate = {
  filename: 'fetch.server.mjs',
  getContents () {
    return [
      'import { $fetch as _$fetch } from \'ofetch\'',
      'import { baseURL } from \'#internal/nuxt/paths\'',
      'import { serverFetch } from "nitro";',
      'globalThis.fetch = serverFetch',
      'if (!globalThis.$fetch) {',
      '  globalThis.$fetch = _$fetch.create({',
      '    baseURL: baseURL()',
      '  })',
      '}',
      'export const $fetch = globalThis.$fetch',
    ].join('\n')
  },
}

export const dollarFetchClientTemplate: NuxtTemplate = {
  filename: 'fetch.client.mjs',
  getContents () {
    return [
      'import { $fetch as _$fetch } from \'ofetch\'',
      'import { baseURL } from \'#internal/nuxt/paths\'',
      'if (!globalThis.$fetch) {',
      '  globalThis.$fetch = _$fetch.create({',
      '    baseURL: baseURL()',
      '  })',
      '}',
      'export const $fetch = globalThis.$fetch',
    ].join('\n')
  },
}

export const dollarFetchTypeTemplate: NuxtTemplate = {
  filename: 'fetch.d.ts',
  getContents () {
    return 'export declare const $fetch: import(\'nitro/types\').$Fetch\n'
  },
}

function hasActiveComponentIslands (ctx: { nuxt: { options: NuxtOptions }, app: NuxtApp }) {
  return ctx.nuxt.options.experimental.componentIslands && (
    ctx.nuxt.options.experimental.componentIslands !== 'auto' ||
    ctx.app.pages?.some(p => p.mode === 'server') ||
    ctx.app.components?.some(c => c.mode === 'server' && !ctx.app.components!.some(other => other.pascalName === c.pascalName && other.mode === 'client'))
  )
}

function shouldEnableComponentIslands (nuxt: { options: NuxtOptions }, app: NuxtApp) {
  return nuxt.options.experimental.componentIslands && (
    nuxt.options.dev || hasActiveComponentIslands({ nuxt, app })
  )
}

// Allow direct access to specific exposed nuxt.config
export const nuxtConfigTemplate: NuxtTemplate = {
  filename: 'nuxt.config.mjs',
  async getContents (ctx) {
    const annotatedPlugins = ctx.nuxt.options.dev || ctx.nuxt.options.test
      ? null
      : await annotatePlugins(ctx.nuxt, ctx.app.plugins)
    const pluginsHaveDependencies = annotatedPlugins ? hasPluginDependencies(annotatedPlugins) : true
    const pluginsRunInParallel = annotatedPlugins ? hasParallelPlugins(annotatedPlugins) : true
    const pluginsHaveHooks = annotatedPlugins ? hasPluginHooks(annotatedPlugins) : true
    const pluginsHaveIslandOptOut = annotatedPlugins ? hasIslandOptOutPlugins(annotatedPlugins) : true
    const fetchDefaults = {
      ...ctx.nuxt.options.experimental.defaults.useFetch,
      baseURL: undefined,
      headers: undefined,
    }
    const componentIslandsActive = hasActiveComponentIslands(ctx)
    const componentIslands = shouldEnableComponentIslands(ctx.nuxt, ctx.app)
    const nitro = useNitro() as Nitro

    const hasCachedRoutes = nitro.routing.routeRules.routes.some(r => r.data.isr || r.data.cache)
    const payloadExtraction = !!ctx.nuxt.options.experimental.payloadExtraction && (nitro.options.static || hasCachedRoutes || (nitro.options.prerender.routes && nitro.options.prerender.routes.length > 0) || nitro.routing.routeRules.routes.some(r => r.data.prerender))
    return [
      ...Object.entries(ctx.nuxt.options.app).map(([k, v]) => `export const ${camelCase('app-' + k)} = ${JSON.stringify(v)}`),
      `export const componentIslands = ${componentIslands}`,
      `export const componentIslandsActive = ${componentIslandsActive}`,
      `export const payloadExtraction = ${payloadExtraction}`,
      `export const prefetchPreloadTags = ${!!ctx.nuxt.options.experimental.prefetchPreloadTags}`,
      `export const cookieStore = ${!!ctx.nuxt.options.experimental.cookieStore}`,
      `export const appManifest = ${!!ctx.nuxt.options.experimental.appManifest}`,
      `export const remoteComponentIslands = ${typeof ctx.nuxt.options.experimental.componentIslands === 'object' && ctx.nuxt.options.experimental.componentIslands.remoteIsland}`,
      `export const selectiveClient = ${typeof ctx.nuxt.options.experimental.componentIslands === 'object' && Boolean(ctx.nuxt.options.experimental.componentIslands.selectiveClient)}`,
      `export const devPagesDir = ${ctx.nuxt.options.dev ? JSON.stringify(ctx.nuxt.options.dir.pages) : 'null'}`,
      `export const devRootDir = ${ctx.nuxt.options.dev ? JSON.stringify(ctx.nuxt.options.rootDir) : 'null'}`,
      `export const devLogs = ${JSON.stringify(ctx.nuxt.options.features.devLogs)}`,
      `export const nuxtLinkDefaults = ${JSON.stringify(ctx.nuxt.options.experimental.defaults.nuxtLink)}`,
      `export const asyncDataDefaults = ${JSON.stringify(ctx.nuxt.options.experimental.defaults.useAsyncData)}`,
      `export const useStateDefaults = ${JSON.stringify(ctx.nuxt.options.experimental.defaults.useState)}`,
      `export const fetchDefaults = ${JSON.stringify(fetchDefaults)}`,
      `export const vueAppRootContainer = ${ctx.nuxt.options.app.rootAttrs.id ? `'#${ctx.nuxt.options.app.rootAttrs.id}'` : `'body > ${ctx.nuxt.options.app.rootTag}'`}`,
      `export const viewTransition = ${ctx.nuxt.options.experimental.viewTransition}`,
      `export const appId = ${JSON.stringify(ctx.nuxt.options.appId)}`,
      `export const outdatedBuildInterval = ${ctx.nuxt.options.experimental.checkOutdatedBuildInterval}`,
      `export const multiApp = ${!!ctx.nuxt.options.future.multiApp}`,
      `export const chunkErrorEvent = ${ctx.nuxt.options.experimental.emitRouteChunkError ? ctx.nuxt.options.builder === '@nuxt/vite-builder' ? '"vite:preloadError"' : '"nuxt:preloadError"' : 'false'}`,
      `export const crawlLinks = ${!!nitro.options.prerender.crawlLinks}`,
      `export const spaLoadingTemplateOutside = ${ctx.nuxt.options.experimental.spaLoadingTemplateLocation === 'body'}`,
      `export const purgeCachedData = ${!!ctx.nuxt.options.experimental.purgeCachedData}`,
      `export const granularCachedData = ${!!ctx.nuxt.options.experimental.granularCachedData}`,
      `export const pendingWhenIdle = ${!!ctx.nuxt.options.experimental.pendingWhenIdle}`,
      `export const alwaysRunFetchOnKeyChange = ${!!ctx.nuxt.options.experimental.alwaysRunFetchOnKeyChange}`,
      `export const asyncCallHook = ${!!ctx.nuxt.options.experimental.asyncCallHook}`,
      `export const clientNodePlaceholder = ${!!ctx.nuxt.options.experimental.clientNodePlaceholder}`,
      `export const tracingChannelNuxt = ${!!(ctx.nuxt.options.tracingChannel && typeof ctx.nuxt.options.tracingChannel === 'object' && ctx.nuxt.options.tracingChannel.nuxt)}`,
      `export const hasPluginDependencies = ${pluginsHaveDependencies}`,
      `export const hasParallelPlugins = ${pluginsRunInParallel}`,
      `export const hasPluginHooks = ${pluginsHaveHooks}`,
      `export const hasIslandOptOutPlugins = ${pluginsHaveIslandOptOut}`,
    ].join('\n\n')
  },
}

const TYPE_FILENAME_RE = /\.([cm])?[jt]s$/
const DECLARATION_RE = /\.d\.[cm]?ts$/
export const buildTypeTemplate: NuxtTemplate = {
  filename: 'types/build.d.ts',
  getContents ({ app }) {
    let declarations = ''

    for (const file of app.templates) {
      if (file.write || !file.filename || DECLARATION_RE.test(file.filename)) {
        continue
      }

      if (TYPE_FILENAME_RE.test(file.filename)) {
        const typeFilenames = new Set([file.filename.replace(TYPE_FILENAME_RE, '.d.$1ts'), file.filename.replace(TYPE_FILENAME_RE, '.d.ts')])
        if (app.templates.some(f => f.filename && typeFilenames.has(f.filename))) {
          continue
        }
      }

      // declare both extensioned (`#build/foo.mjs`) and bare (`#build/foo`) module specifiers
      const fullSpecifier = join('#build', file.filename)
      declarations += 'declare module ' + JSON.stringify(fullSpecifier) + ';\n'
      const bareSpecifier = fullSpecifier.replace(/\.m?js$/, '')
      if (bareSpecifier !== fullSpecifier) {
        declarations += 'declare module ' + JSON.stringify(bareSpecifier) + ';\n'
      }
    }

    return declarations
  },
}

const strippedAtAliases = {
  '@': '',
  '@@': '',
}
