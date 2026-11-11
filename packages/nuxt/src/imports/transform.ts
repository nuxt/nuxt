import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { createUnimport } from 'unimport'
import type { Import, Unimport } from 'unimport'
import escapeRE from 'escape-string-regexp'
import { normalize } from 'pathe'
import { tryUseNuxt } from '@nuxt/kit'

import { JS_ID_RE, VUE_SCRIPT_TEMPLATE_ID_FILTER, isJS, isVue } from '../core/utils/index.ts'
import { installNuxtModule } from '../core/features.ts'
import type { ImportsOptions } from 'nuxt/schema'

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const IMPORTS_RE = /(['"])#imports\1/
const DOLLAR_FETCH_RE = /(?<![\w$.])\$fetch\b/
const SCRIPT_STUBS = '#app/composables/script-stubs'

interface TransformPluginOptions {
  ctx: Pick<Unimport, 'injectImports' | 'getNativeInject'>
  options: Partial<ImportsOptions>
  sourcemap?: boolean
  /**
   * Rescan a changed file for the imports it provides, returning a promise only when the file is
   * one we scan for imports.
   */
  refreshImports?: (file: string) => void | Promise<void>
}

function isTransformed (options: Partial<ImportsOptions>, id: string) {
  if (options.transform?.include?.some(pattern => pattern.test(id))) {
    return true
  }
  if (options.transform?.exclude?.some(pattern => pattern.test(id))) {
    return false
  }
  return isVue(id, { type: ['script', 'template'] }) || isJS(id)
}

const ANY = '[\\s\\S]*?'
const joinSources = (patterns: RegExp[]) => patterns.map(re => re.source).join('|')

/** `injectFilter` lets `exclude` win, but `transform.include` wins in `isTransformed`. */
function excludeUnlessIncluded (exclude: RegExp[], include: RegExp[]) {
  const notIncluded = include.length ? `(?!${ANY}(?:${joinSources(include)}))` : ''
  return new RegExp(`^${notIncluded}${ANY}(?:${joinSources(exclude)})`)
}

export const TransformPlugin = ({ ctx, options, sourcemap, refreshImports }: TransformPluginOptions) => createUnplugin(() => {
  // `$fetch` is not a global on the client, so code that relies on the global (including
  // module runtime code, which is not auto-imported) receives an import instead
  const fetchCtx = createUnimport({
    parser: 'oxc',
    injectAtEnd: true,
    imports: [{ name: '$fetch', from: '#build/fetch' }],
    addons: { addons: [] },
  })

  const transform = {
    filter: undefined as { code: RegExp } | undefined,
    async handler (code: string, id: string) {
      id = normalize(id)
      const isNodeModule = NODE_MODULES_RE.test(id) && !options.transform?.include?.some(pattern => pattern.test(id))
      const usesFetch = DOLLAR_FETCH_RE.test(code)
      // For modules in node_modules, we only transform `#imports` but not doing imports
      if (isNodeModule && !usesFetch && !IMPORTS_RE.test(code)) {
        return
      }

      const { s, imports } = isNodeModule && !IMPORTS_RE.test(code)
        ? { s: new MagicString(code), imports: [] }
        : await ctx.injectImports(code, id, { autoImport: options.autoImport && !isNodeModule })
      if (usesFetch && !imports.some(i => (i.as ?? i.name) === '$fetch')) {
        await fetchCtx.injectImports(s, id, { autoImport: true })
      }
      if (imports.some(i => i.from === '#app/composables/script-stubs') && tryUseNuxt()?.options.test === false) {
        installNuxtModule('@nuxt/scripts')
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }

  let isServe = false

  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude: id => isTransformed(options, id),
    transform,
    vite: {
      configResolved (config) {
        isServe = config.command === 'serve'
      },
      // Rolldown injects the auto-imports itself, so the JS transform only runs where it is still needed
      async options (rolldownOptions) {
        transform.filter = undefined
        const include = options.transform?.include ?? []
        const exclude = [NODE_MODULES_RE, ...options.transform?.exclude ?? []]
        // `inject` does not run in dev, and the patterns are joined into one regex below
        if (!options.nativeInject || options.autoImport === false || isServe || [...include, ...exclude].some(re => re.flags)) {
          return
        }
        const native = await ctx.getNativeInject()
        if (!native) {
          return
        }

        // `$fetch` and script stubs need the JS transform
        const triggers = [DOLLAR_FETCH_RE.source]
        const stubs: string[] = []
        for (const [name, source] of Object.entries(native.inject)) {
          if (Array.isArray(source) && source[0] === SCRIPT_STUBS) {
            stubs.push(escapeRE(name))
            delete native.inject[name]
          }
        }
        if (stubs.length) {
          triggers.push(`(?<![\\w$.])(?:${stubs.join('|')})\\b`)
        }
        if (native.transformFilter) {
          triggers.push(native.transformFilter.source)
        }
        transform.filter = { code: new RegExp(triggers.join('|')) }

        return {
          ...rolldownOptions,
          transform: {
            ...rolldownOptions.transform,
            inject: { ...native.inject, ...rolldownOptions.transform?.inject },
            // TODO: drop the cast once Vite ships a Rolldown with `injectFilter` (rolldown/rolldown#11290)
            injectFilter: {
              include: [JS_ID_RE, ...VUE_SCRIPT_TEMPLATE_ID_FILTER, ...include],
              exclude: excludeUnlessIncluded(exclude, include),
            },
          } as NonNullable<typeof rolldownOptions.transform>,
        }
      },
      hotUpdate: {
        order: 'pre',
        async handler ({ file, modules }) {
          // The exports a file provides can change with its contents, so it has to be rescanned
          // before its consumers are transformed again - otherwise they keep the imports it used
          // to provide, and the module they resolve to no longer has them.
          const pending = refreshImports?.(normalize(file))
          if (!pending) { return }
          await pending

          // The injected imports live in the consumers' transform output, which is only
          // regenerated if their modules are invalidated as well.
          for (const mod of modules) {
            for (const importer of mod.importers) {
              this.environment.moduleGraph.invalidateModule(importer)
            }
          }
        },
      },
    },
  }
})

interface RemovedImportsPluginOptions {
  ctx: Pick<Unimport, 'injectImports'>
  options: Partial<ImportsOptions>
  imports: Import[]
  onRemovedImports: (id: string, imports: Import[]) => void
}

/** Reports former auto-imports that app code uses without importing or declaring them. */
export const RemovedImportsPlugin = ({ ctx, options, imports, onRemovedImports }: RemovedImportsPluginOptions) => createUnplugin(() => {
  const removedCtx = createUnimport({ parser: 'oxc', imports, addons: { addons: [] } })

  return {
    name: 'nuxt:imports-removed',
    enforce: 'post',
    transformInclude: id => options.autoImport !== false && isTransformed(options, id),
    transform: {
      filter: {
        code: { include: new RegExp(`\\b(?:${imports.map(i => escapeRE(i.as ?? i.name)).join('|')})\\b`) },
      },
      async handler (code, id) {
        id = normalize(id)
        if (NODE_MODULES_RE.test(id) && !options.transform?.include?.some(pattern => pattern.test(id))) {
          return
        }
        const { imports: used } = await removedCtx.injectImports(code, id, { autoImport: true })
        if (used.length === 0) {
          return
        }
        const { imports: provided } = await ctx.injectImports(code, id, { autoImport: true })
        const providedNames = new Set(provided.map(i => i.as ?? i.name))
        const removed = used.filter(i => !providedNames.has(i.as ?? i.name))
        if (removed.length > 0) {
          onRemovedImports(id, removed)
        }
      },
    },
  }
})
