import process from 'node:process'
import { pathToFileURL } from 'node:url'
import type { Plugin, Rollup } from 'vite'
import { basename, dirname, relative, resolve } from 'pathe'
import { genArrayFromRaw, genImport, genObjectFromRawEntries } from 'knitwork'
import { filename as _filename } from 'pathe/utils'
import { setBuildOutput } from '@nuxt/kit'
import type { Nuxt, NuxtPage } from '@nuxt/schema'
import { generateTransform, rolldownString } from 'rolldown-string'
import genericNames from 'generic-names'

import { IS_CSS_RE, isCSS, isVue, parseModuleId } from '../utils/index.ts'
import { withInlineQuery } from '../utils/inline-styles.ts'
import { resolveClientEntry } from '../utils/config.ts'
import escapeStringRegexp from 'escape-string-regexp'

const SUPPORTED_FILES_RE = /\.(?:vue|(?:[cm]?j|t)sx?)$/
const QUERY_RE = /\?.+$/
const MACRO_QUERY_RE = /[?&]macro(?:=|&|$)/
const NUXT_COMPONENT_QUERY_RE = /[?&]nuxt_component=/
const STYLE_QUERY_RE = /[?&]type=style/

/**
 * Wrap a string `generateScopedName` pattern into a function that strips any
 * Vite query string (e.g. `?inline&used`) from the resource path before it is
 * hashed.
 *
 * When `features.inlineStyles` is enabled, this plugin imports CSS files with
 * `?inline&used` appended to the module id. For string patterns Vite delegates
 * scoped-name generation to `generic-names`, which folds the full resource path
 * (query included) into the `[hash]`. The client build processes the same file
 * without the query, so it produces a different hash and therefore different
 * class names, leaving the SSR markup mismatched against the inlined `<style>`
 * tags (see https://github.com/nuxt/nuxt/issues/35591 and
 * https://github.com/vitejs/vite/issues/22957).
 *
 * Delegating to `generic-names` with `process.cwd()` (the same context Vite
 * uses) means the generated names stay byte-identical to the client build for
 * every supported token, not just `[local]`/`[hash]`.
 */
function wrapStringGenerateScopedName (
  pattern: string,
  hashPrefix: string,
): (localName: string, resourcePath: string) => string {
  const generate = genericNames(pattern, { context: process.cwd(), hashPrefix })
  return (localName, resourcePath) => generate(localName, resourcePath.replace(QUERY_RE, ''))
}

export function SSRStylesPlugin (nuxt: Nuxt): Plugin | undefined {
  if (nuxt.options.dev) { return }

  const envApi = nuxt.options.experimental.nitroViteEnvironment

  const chunksWithInlinedCSS = new Set<string>()
  // Client module graph (ids and importers with any query stripped), used to
  // check which components a CSS source can be reached from.
  const clientImporters = new Map<string, Set<string>>()
  // For each emitted CSS asset (base file name), the CSS source module ids
  // bundled into it.
  const cssSourcesByCSSFile = new Map<string, Set<string>>()
  const clientCSSMap: Record<string, Set<string>> = {}

  const stripQuery = (id: string) => id.replace(QUERY_RE, '')

  // For each CSS source module id (with `?...` query stripped) whose styles are
  // inlined into the SSR response, the `cssMap` keys of the components it is
  // inlined for. Built up in `build:manifest` from the components whose styles
  // are actually emitted as inline `<style>` tags (i.e. those with
  // `inBundle && files.length`). We can't populate this during `transform`
  // because at that point we don't yet know which components will actually have
  // inline styles emitted.
  const inlinedCSSConsumers = new Map<string, Set<string>>()

  // A CSS source is only safe to drop when every path from it up through the
  // client module graph reaches a component that inlines it. With a
  // function-valued `inlineStyles` (the default is one) a shared CSS source can
  // be inlined for one importer while another still relies on the link.
  const isInlinedForEveryImporter = (cssId: string) => {
    const consumers = inlinedCSSConsumers.get(cssId)
    if (!consumers) { return false }
    const seen = new Set<string>()
    const queue = [cssId]
    while (queue.length) {
      const importer = queue.shift()!
      if (seen.has(importer)) { continue }
      seen.add(importer)
      if (consumers.has(relativeToSrcDir(importer))) { continue }
      const parents = clientImporters.get(importer)
      if (!parents?.size) { return false }
      queue.push(...parents)
    }
    return true
  }

  const isDroppableCSSFile = (file: string) => {
    const sources = cssSourcesByCSSFile.get(basename(file))
    if (!sources?.size) { return false }
    for (const cssId of sources) {
      if (!isInlinedForEveryImporter(cssId)) { return false }
    }
    return true
  }

  // For each emitted CSS file (base name) whose link is only safe to drop on
  // requests that actually rendered the components inlining it, the groups of
  // component ids that inline each of its CSS sources. A request may drop the
  // link when every group has at least one module in `ssrContext.modules`.
  const inlinedCSSConditions = new Map<string, string[][]>()

  const serializeInlinedCSSConditions = () => JSON.stringify(Object.fromEntries(inlinedCSSConditions))

  /**
   * Decide how a droppable CSS file should be handled, recording a render-time
   * condition when some of its sources are only inlined for components that may
   * not be server-rendered on a given request (for example a component used
   * inside `<ClientOnly>` on one route and server-rendered on another).
   *
   * Returns `true` when the link can be removed from the manifest outright,
   * i.e. every CSS source is inlined for an entry module, which is always in
   * `ssrContext.modules`.
   */
  const dropCSSFile = (file: string, entryIds: Set<string>) => {
    const cssFile = basename(file)
    const sources = cssSourcesByCSSFile.get(cssFile)!
    const conditions: string[][] = []
    for (const cssId of sources) {
      const consumers = inlinedCSSConsumers.get(cssId)
      if (!consumers?.size) { continue }
      let alwaysRendered = false
      for (const consumer of consumers) {
        if (entryIds.has(consumer)) {
          alwaysRendered = true
          break
        }
      }
      if (!alwaysRendered) {
        conditions.push(Array.from(consumers))
      }
    }
    if (!conditions.length) { return true }
    inlinedCSSConditions.set(cssFile, conditions)
    return false
  }

  /**
   * Record a render-time condition for CSS files attributed to a single
   * component, used for rolldown-generated chunks whose CSS is matched to the
   * component by filename rather than through the module graph.
   */
  const dropComponentCSSFile = (file: string, componentId: string, entryIds: Set<string>) => {
    if (entryIds.has(componentId)) { return true }
    inlinedCSSConditions.set(basename(file), [[componentId]])
    return false
  }

  // Remove CSS entries for files that will have inlined styles
  nuxt.hook('build:manifest', (manifest) => {
    const entryIds = new Set<string>()

    // The set of components whose CSS is inlined is derived from `cssMap`
    // directly (entries with bundled, non-empty CSS). `build:manifest` can fire
    // before the styles `generateBundle` has run, so we must not depend on the
    // separately-tracked `chunksWithInlinedCSS` being populated yet.
    for (const [id, { cssIds, files, inBundle }] of Object.entries(cssMap)) {
      if (!inBundle || !files.length) { continue }
      chunksWithInlinedCSS.add(id)
      if (!cssIds) { continue }
      for (const cssId of cssIds) {
        const consumers = inlinedCSSConsumers.get(cssId) ?? new Set()
        inlinedCSSConsumers.set(cssId, consumers)
        consumers.add(id)
      }
    }

    for (const id of chunksWithInlinedCSS) {
      const chunk = manifest[id]
      if (chunk?.isEntry && chunk.src) {
        entryIds.add(chunk.src)
      }
    }

    for (const id of chunksWithInlinedCSS) {
      const chunk = manifest[id]
      if (!chunk) {
        continue
      }
      // Rolldown may split a component into a facade chunk (with no CSS) and
      // a shared code chunk (with CSS). Also clear CSS from directly imported
      // chunks when they are rolldown-generated internal chunks whose CSS belongs
      // to the same component (matched by filename prefix).
      if (chunk.imports && chunk.src) {
        const componentBaseName = _filename(chunk.src)
        for (const imp of chunk.imports) {
          const imported = manifest[imp]
          if (imported?.css?.length && !imported.isEntry && !imported.src) {
            // Only clear if ALL CSS files in the chunk match this component
            const allMatch = imported.css.every((css: string) => css.startsWith(componentBaseName + '.'))
            if (allMatch) {
              imported.css = imported.css.filter(file => !dropComponentCSSFile(file, id, entryIds))
            }
          }
        }
      }
    }

    // Drop a CSS link when every CSS source module bundled into that asset has
    // already been inlined as a `<style>` tag during SSR. This prevents
    // duplicate styles when `inlineStyles` is enabled. (#30435)
    //
    // Whether the styles are inlined is only fully known per request: the
    // `<style>` tags are emitted for the components in `ssrContext.modules`. A
    // link is therefore only removed here when every source is inlined for an
    // entry module; otherwise it is kept and the renderer drops it for the
    // requests that did inline it. (#36058)
    for (const chunk of Object.values(manifest)) {
      if (!chunk.css?.length) { continue }
      chunk.css = chunk.css.filter(file => !(isDroppableCSSFile(file) && dropCSSFile(file, entryIds)))
    }

    setBuildOutput('entryIds', () => `export default ${JSON.stringify(Array.from(entryIds))}`, nuxt)
  })

  const cssMap: Record<string, { files: string[], inBundle?: boolean, cssIds?: Set<string> }> = {}
  // Track emitted CSS chunk refs globally to avoid duplicate emissions across transform calls.
  const emittedFileRefs: Record<string, string> = {}
  // map for source file to a unique chunk-name prefix
  const chunkNamePrefixes = new Map<string, string>()
  const usedChunkNamePrefixes = new Set<string>()

  const options = {
    shouldInline: nuxt.options.features.inlineStyles,
    globalCSS: nuxt.options.css,
  }

  // relative file lookup has duplicate checks
  const relativeCache = new Map<string, string>()
  const relativeToSrcDir = (path: string) => {
    let cached = relativeCache.get(path)
    if (cached === undefined) {
      cached = relative(nuxt.options.srcDir, path)
      relativeCache.set(path, cached)
    }
    return cached
  }

  const warnCache = new Set<string>()
  const components = nuxt.apps.default!.components || []
  const islands = components.filter(component =>
    component.island ||
    // .server components without a corresponding .client component will need to be rendered as an island
    (component.mode === 'server' && !components.some(c => c.pascalName === component.pascalName && c.mode === 'client')),
  )
  const islandPaths = new Set(islands.map(c => c.filePath))

  // Server pages (.server.vue) are not in the components list but still need
  // their CSS extracted for inline delivery via the island handler.
  const flattenPages = (pages?: NuxtPage[]): NuxtPage[] =>
    pages?.flatMap(p => [p, ...flattenPages(p.children)]) ?? []
  const pages = flattenPages(nuxt.apps.default!.pages)
  const serverPages = pages.filter(({ mode, file }) => mode === 'server' && file)
  const serverPagePaths = new Set(serverPages.map(({ file }) => file!))

  let entry: string

  return {
    name: 'ssr-styles',
    config (config) {
      if (!nuxt.options.features.inlineStyles) { return }
      const modules = config.css?.modules
      if (typeof modules !== 'object' || !modules || typeof modules.generateScopedName !== 'string') { return }
      const hashPrefix = typeof modules.hashPrefix === 'string' ? modules.hashPrefix : ''
      modules.generateScopedName = wrapStringGenerateScopedName(modules.generateScopedName, hashPrefix)
    },
    configResolved (config) {
      entry = resolveClientEntry(config)
    },
    applyToEnvironment (environment) {
      if (environment.name !== 'client' && environment.name !== 'ssr') { return false }
      return {
        name: `nuxt:ssr-styles:${environment.name}`,
        enforce: 'pre',
        buildStart () {
          if (!envApi && this.environment.name === 'ssr') {
            const stylesPath = resolve(this.environment.config.build.outDir, 'styles.mjs')
            setBuildOutput('ssrStyles', () => [
              `export { default } from ${JSON.stringify(pathToFileURL(stylesPath).href)}`,
              `export const inlinedCSS = ${serializeInlinedCSSConditions()}`,
            ].join('\n'), nuxt)
          }
        },
        resolveId: {
          order: 'pre',
          filter: {
            id: {
              include: [/^#build\/css$/, /\.vue$/, IS_CSS_RE],
            },
          },
          async handler (id, importer, _options) {
            // We want to remove side effects (namely, emitting CSS) from `.vue` files and explicitly imported `.css` files
            // but only as long as we are going to inline that CSS.
            if ((options.shouldInline === false || (typeof options.shouldInline === 'function' && !options.shouldInline(importer)))) {
              return
            }

            const res = await this.resolve(id, importer, { ..._options, skipSelf: true })
            if (res) {
              return {
                ...res,
                moduleSideEffects: false,
              }
            }
          },
        },
        generateBundle (outputOptions, bundle) {
          if (environment.name === 'client') {
            for (const chunk of Object.values(bundle)) {
              if (chunk.type !== 'chunk') { continue }
              for (const moduleId of chunk.moduleIds) {
                const id = stripQuery(moduleId)
                const importers = clientImporters.get(id) ?? new Set()
                clientImporters.set(id, importers)
                for (const importer of this.getModuleInfo(moduleId)?.importers ?? []) {
                  const importerId = stripQuery(importer)
                  if (importerId !== id) {
                    importers.add(importerId)
                  }
                }
              }
              const cssSources = new Set<string>()
              for (const moduleId of chunk.moduleIds) {
                if (isCSS(moduleId)) {
                  cssSources.add(stripQuery(moduleId))
                }
              }
              if (cssSources.size) {
                for (const file of chunk.viteMetadata?.importedCss ?? []) {
                  const cssFile = basename(file)
                  const sources = cssSourcesByCSSFile.get(cssFile) ?? new Set<string>()
                  cssSourcesByCSSFile.set(cssFile, sources)
                  for (const cssId of cssSources) {
                    sources.add(cssId)
                  }
                }
              }
            }
            return
          }

          const emitted: Record<string, string> = {}
          const usedNames = new Set<string>()
          for (const [file, { files, inBundle }] of Object.entries(cssMap)) {
            // File has been tree-shaken out of build (or there are no styles to inline)
            if (!files.length || !inBundle) { continue }
            const baseName = filename(file)
            let assetName = `${baseName}-styles.mjs`
            for (let i = 2; usedNames.has(assetName); i++) {
              assetName = `${baseName}-styles-${i}.mjs`
            }
            usedNames.add(assetName)
            const base = typeof outputOptions.assetFileNames === 'string'
              ? outputOptions.assetFileNames
              : outputOptions.assetFileNames({
                  type: 'asset',
                  name: assetName,
                  names: [assetName],
                  originalFileName: assetName,
                  originalFileNames: [assetName],
                  source: '',
                })

            const baseDir = dirname(base)

            const cssImports = new Set<string>()
            const exportNames = new Set<string>()
            const importStatements = new Set<string>()
            let i = 0
            for (const css of files) {
              const file = this.getFileName(css)
              if (cssImports.has(file)) {
                continue
              }
              cssImports.add(file)
              const name = `style_${i++}`
              importStatements.add(genImport(`./${relative(baseDir, file)}`, name))
              exportNames.add(name)
            }
            emitted[file] = this.emitFile({
              type: 'asset',
              name: assetName,
              source: [
                ...importStatements,
                `export default ${genArrayFromRaw([...exportNames])}`,
              ].join('\n'),
            })
          }

          for (const key in emitted) {
            // Track the chunks we are inlining CSS for so we can omit including links to the .css files
            chunksWithInlinedCSS.add(key)
          }

          // TODO: remove css from vite preload arrays

          const stylesMapEntries = Object.entries(emitted).map(([key, value]) =>
            [key, `() => import('./${this.getFileName(value)}').then(interopDefault)`]) as [string, string][]
          this.emitFile({
            type: 'asset',
            fileName: 'styles.mjs',
            originalFileName: 'styles.mjs',
            source: [
              'const interopDefault = r => r.default || r || []',
              `export default ${genObjectFromRawEntries(stylesMapEntries)}`,
            ].join('\n'),
          })
          if (envApi) {
            const envEntries = Object.entries(emitted).map(([key, value]) =>
              [key, `() => import('./${basename(this.getFileName(value))}').then(r => r.default || r || [])`]) as [string, string][]
            setBuildOutput('ssrStyles', () => [
              `export default ${genObjectFromRawEntries(envEntries)}`,
              `export const inlinedCSS = ${serializeInlinedCSSConditions()}`,
            ].join('\n'), nuxt)
          }
        },
        renderChunk (_code, chunk) {
          const isEntry = chunk.facadeModuleId === entry
          if (isEntry) {
            clientCSSMap[chunk.facadeModuleId!] ||= new Set()
          }
          for (const moduleId of [chunk.facadeModuleId, ...chunk.moduleIds].filter(Boolean) as string[]) {
            // 'Teleport' CSS chunks that made it into the bundle on the client side
            // to be inlined on server rendering
            if (environment.name === 'client') {
              const moduleMap = clientCSSMap[moduleId] ||= new Set()
              if (isCSS(moduleId)) {
                // Vue files can (also) be their own entrypoints as they are tracked separately
                if (isVue(moduleId)) {
                  moduleMap.add(moduleId)
                  const parent = moduleId.replace(/\?.+$/, '')
                  const parentMap = clientCSSMap[parent] ||= new Set()
                  parentMap.add(moduleId)
                }
                // Track CSS in the chunk's facade so it gets inlined alongside the
                // owning Vue component (or the entry chunk) at SSR time. Without this
                // step, CSS imported as a side effect from a non-Vue JS module
                // is never attributed to a `.vue` ancestor that the SSR renderer can
                // ask for via `ssrContext.modules`
                if (chunk.facadeModuleId && (isEntry || isVue(chunk.facadeModuleId))) {
                  const facadeMap = clientCSSMap[chunk.facadeModuleId] ||= new Set()
                  facadeMap.add(moduleId)
                }
              }
              continue
            }

            const relativePath = relativeToSrcDir(stripQuery(moduleId))
            if (relativePath in cssMap) {
              cssMap[relativePath]!.inBundle = cssMap[relativePath]!.inBundle ?? ((isVue(stripQuery(moduleId)) && !!relativePath) || isEntry)
            }
          }

          return null
        },
        transform: {
          filter: {
            id: {
              include: environment.name === 'client'
                ? new RegExp('^' + escapeStringRegexp(entry) + '$')
                : undefined,
              exclude: environment.name === 'client' ? [] : [/\?.*macro=/, /\?.*nuxt_component=/],
            },
          },
          async handler (code, id, meta?: unknown) {
            if (environment.name === 'client') {
              // We will either teleport global CSS to the 'entry' chunk on the server side
              // or include it here in the client build so it is emitted in the CSS.
              if (id === entry && (options.shouldInline === true || (typeof options.shouldInline === 'function' && options.shouldInline(id)))) {
                const idClientCSSMap = clientCSSMap[id] ||= new Set()
                if (!options.globalCSS.length) { return }

                const s = rolldownString(code, id, meta)
                for (const file of options.globalCSS) {
                  const resolved = await this.resolve(file) ?? await this.resolve(file, id)
                  const fileInline = withInlineQuery(file)
                  const res = await this.resolve(fileInline) ?? await this.resolve(fileInline, id)
                  if (!resolved || !res) {
                    if (!warnCache.has(file)) {
                      warnCache.add(file)
                      this.warn(`[nuxt] Cannot extract styles for \`${file}\`. Its styles will not be inlined when server-rendering.`)
                    }
                    s.prepend(`${genImport(file)}\n`)
                    continue
                  }
                  idClientCSSMap.add(resolved.id)
                }
                return generateTransform(s, id)
              }
              return
            }

            const { pathname, search } = parseModuleId(id)

            if (!(id in clientCSSMap) && !islandPaths.has(pathname) && !serverPagePaths.has(pathname) && !isVue(pathname)) { return }

            if (MACRO_QUERY_RE.test(search) || NUXT_COMPONENT_QUERY_RE.test(search)) { return }

            const isEntryModule = pathname === entry

            if (!isEntryModule && !islandPaths.has(pathname) && !serverPagePaths.has(pathname)) {
              if (options.shouldInline === false || (typeof options.shouldInline === 'function' && !options.shouldInline(id))) { return }
            }

            if (isEntryModule && options.shouldInline === false) { return }

            const relativeId = relativeToSrcDir(stripQuery(id))
            const idMap = cssMap[relativeId] ||= { files: [] }
            const idCssIds = idMap.cssIds ||= new Set()

            const emittedIds = new Set<string>()
            let chunkNamePrefix = chunkNamePrefixes.get(relativeId)
            if (chunkNamePrefix === undefined) {
              const baseName = filename(id) || 'styles'
              chunkNamePrefix = baseName
              for (let i = 2; usedChunkNamePrefixes.has(chunkNamePrefix); i++) {
                chunkNamePrefix = `${baseName}-${i}`
              }
              usedChunkNamePrefixes.add(chunkNamePrefix)
              chunkNamePrefixes.set(relativeId, chunkNamePrefix)
            }

            let styleCtr = 0
            const ids = clientCSSMap[id] || []
            for (const file of ids) {
              if (isEntryModule && typeof options.shouldInline === 'function' && !options.shouldInline(file)) { continue }
              if (emittedIds.has(file)) { continue }
              const fileInline = withInlineQuery(file)
              const resolved = await this.resolve(file) ?? await this.resolve(file, id)
              const res = await this.resolve(fileInline) ?? await this.resolve(fileInline, id)
              if (!resolved || !res) {
                if (!warnCache.has(file)) {
                  warnCache.add(file)
                  this.warn(`[nuxt] Cannot extract styles for \`${file}\`. Its styles will not be inlined when server-rendering.`)
                }
                continue
              }
              emittedIds.add(file)
              idCssIds.add(stripQuery(resolved.id))

              // Reuse ref from a previous emission of the same file to avoid rolldown
              // returning incorrect refs when the same chunk ID is emitted multiple times
              const resolvedInlineId = res.id
              let ref = emittedFileRefs[resolvedInlineId]
              if (!ref) {
                ref = this.emitFile({
                  type: 'chunk',
                  name: `${chunkNamePrefix}-styles-${++styleCtr}.mjs`,
                  id: fileInline,
                })
                emittedFileRefs[resolvedInlineId] = ref
              }

              idMap.files.push(ref)
            }

            // a `.vue` id can still carry CSS as its module contents (`?type=style&lang.css`)
            if (!SUPPORTED_FILES_RE.test(pathname) || STYLE_QUERY_RE.test(search) || isCSS(search)) { return }

            for (const specifier of getStaticImportSpecifiers(this.parse(code))) {
              if (!IS_CSS_RE.test(specifier) && !STYLE_QUERY_RE.test(specifier)) { continue }

              const resolved = await this.resolve(specifier, id)
              if (!resolved) { continue }
              const resolvedIdInline = withInlineQuery(resolved.id)
              const res = await this.resolve(resolvedIdInline)
              if (!res) {
                if (!warnCache.has(resolved.id)) {
                  warnCache.add(resolved.id)
                  this.warn(`[nuxt] Cannot extract styles for \`${specifier}\`. Its styles will not be inlined when server-rendering.`)
                }
                continue
              }

              if (emittedIds.has(resolved.id)) { continue }
              idCssIds.add(stripQuery(resolved.id))

              // Reuse ref from a previous emission of the same file
              const resolvedInlineId = res.id
              let ref = emittedFileRefs[resolvedInlineId]
              if (!ref) {
                ref = this.emitFile({
                  type: 'chunk',
                  name: `${chunkNamePrefix}-styles-${++styleCtr}.mjs`,
                  id: resolvedIdInline,
                })
                emittedFileRefs[resolvedInlineId] = ref
              }

              idMap.files.push(ref)
            }
          },
        },
      }
    },
  }
}

function filename (name: string) {
  return _filename(name.replace(QUERY_RE, ''))
}

function getStaticImportSpecifiers (program: ReturnType<Rollup.PluginContext['parse']>) {
  const specifiers: string[] = []
  for (const node of program.body) {
    if (node.type === 'ImportDeclaration') {
      specifiers.push(node.source.value)
    }
  }
  return specifiers
}
