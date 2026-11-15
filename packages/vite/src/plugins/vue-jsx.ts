import type { Plugin, ResolvedConfig } from 'vite'
import type { Options } from '@vitejs/plugin-vue-jsx'

type HookName = 'transform' | 'resolveId' | 'load' | 'configResolved'

const SSR_REGISTER_HELPER_RE = /^\/__vue-jsx-ssr-register-helper$/
const DECORATOR_PARSER_PLUGINS = new Set(['decorators', 'decorators-legacy'])

// Parses 2023-11 decorators so `DecoratorsPlugin` can lower them after this Babel pass.
function decoratorsSyntaxPlugin () {
  return {
    name: 'nuxt:syntax-decorators',
    manipulateOptions (_options: unknown, parserOpts: { plugins: Array<string | [string, unknown]> }) {
      if (!parserOpts.plugins.some(plugin => DECORATOR_PARSER_PLUGINS.has(Array.isArray(plugin) ? plugin[0] : plugin))) {
        parserOpts.plugins.push(['decorators', { allowCallParenthesized: false }], 'decoratorAutoAccessors')
      }
    },
  }
}

function handlerOf<K extends HookName> (plugin: Plugin, name: K) {
  const hook = plugin[name] as Plugin[K]
  return (typeof hook === 'function' ? hook : hook?.handler) as Extract<Plugin[K], (...args: any[]) => any> | undefined
}

function toIdFilter (pattern: string | RegExp) {
  return typeof pattern === 'string'
    ? `${pattern}{?*,}`
    : new RegExp(pattern.source.replace(/(?<!\\)\$/g, '(?:\\?.*)?$'), pattern.flags)
}

function toIdFilters (pattern: Options['include']) {
  if (!pattern) { return }
  return Array.isArray(pattern) ? pattern.map(toIdFilter) : toIdFilter(pattern as string | RegExp)
}

function parseDefine (value: unknown) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return value
  }
}

/** `@vitejs/plugin-vue-jsx`, imported on the first module it handles as it pulls in Babel. */
export function VueJsxPlugin (options: Options = {}, decorators = false): Plugin {
  const { include = /\.[jt]sx$/, exclude, tsTransform } = options
  let plugin: Promise<Plugin> | undefined
  let resolvedConfig: ResolvedConfig | undefined

  function loadPlugin () {
    plugin ||= import('@vitejs/plugin-vue-jsx').then(async ({ default: vueJsx }) => {
      const resolved = vueJsx(decorators
        ? { ...options, babelPlugins: [...options.babelPlugins ?? [], decoratorsSyntaxPlugin] }
        : options)
      if (resolvedConfig) {
        await handlerOf(resolved, 'configResolved')?.call({} as any, resolvedConfig)
      }
      return resolved
    })
    return plugin
  }

  return {
    name: 'vite:vue-jsx',
    config (config) {
      const isRolldownVite = this && 'rolldownVersion' in this.meta
      return {
        [isRolldownVite ? 'oxc' : 'esbuild']: tsTransform === 'built-in' ? { exclude: /\.jsx?$/ } : { include: /\.ts$/ },
        define: {
          __VUE_OPTIONS_API__: parseDefine(config.define?.__VUE_OPTIONS_API__) ?? true,
          __VUE_PROD_DEVTOOLS__: parseDefine(config.define?.__VUE_PROD_DEVTOOLS__) ?? false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: parseDefine(config.define?.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__) ?? false,
        },
        optimizeDeps: isRolldownVite ? { rolldownOptions: { transform: { jsx: 'preserve' } } } : {},
      }
    },
    configResolved (config) {
      resolvedConfig = config
      return plugin?.then(resolved => handlerOf(resolved, 'configResolved')?.call(this, config))
    },
    resolveId: {
      filter: { id: SSR_REGISTER_HELPER_RE },
      async handler (id, importer, resolveOptions) {
        return handlerOf(await loadPlugin(), 'resolveId')?.call(this, id, importer, resolveOptions)
      },
    },
    load: {
      filter: { id: SSR_REGISTER_HELPER_RE },
      async handler (id, loadOptions) {
        return handlerOf(await loadPlugin(), 'load')?.call(this, id, loadOptions)
      },
    },
    transform: {
      order: tsTransform === 'built-in' ? 'pre' : undefined,
      filter: { id: { include: toIdFilters(include), exclude: toIdFilters(exclude) } },
      async handler (code, id, transformOptions) {
        return handlerOf(await loadPlugin(), 'transform')?.call(this, code, id, transformOptions)
      },
    },
  }
}
