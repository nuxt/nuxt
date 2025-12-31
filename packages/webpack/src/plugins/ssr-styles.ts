import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { isAbsolute, relative, resolve } from 'pathe'
import { parseURL, withTrailingSlash } from 'ufo'
import { genArrayFromRaw, genObjectFromRawEntries } from 'knitwork'
import type { Nuxt } from '@nuxt/schema'
import { resolveAlias, useNitro } from '@nuxt/kit'
import type { Compilation, Compiler, Module, NormalModule } from 'webpack'
import type { CssModule } from 'mini-css-extract-plugin'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { createHash } from 'node:crypto'

const CSS_URL_RE = /url\((['"]?)(\/[^)]+?)\1\)/g

const isVueFile = (id: string) => /\.vue(?:\?|$)/.test(id)
const isCSSLike = (name: string) => /\.(?:css|scss|sass|less|styl(?:us)?|postcss|pcss)(?:\?|$)/.test(name)

function normalizePath (nuxt: Nuxt, id?: string | null): string | null {
  if (!id) { return null }
  const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  const rel = relative(nuxt.options.srcDir, pathname)
  if (rel.startsWith('..')) { return null }
  return rel
}

function resolveFilePath (id?: string | null): string | null {
  if (!id) { return null }
  return parseURL(decodeURIComponent(pathToFileURL(id).href)).pathname || null
}

function sanitizeStyleAssetName (rel: string) {
  return rel.replace(/[\\/]/g, '_').replace(/\.{2,}/g, '_')
}

function normalizeCSSContent (css: string) {
  return css
    .trim()
    .replace(/(--[^:]+):\s*'([^']*)'/g, '$1:"$2"')
    .replace(/:\s+/g, ':')
    .replace(/\s*\{\s*/g, '{')
    .replace(/;\s*\}/g, '}')
    .replace(/\s*\}\s*/g, '}')
}

// Fallback to extract styles directly from .vue files
// (for server-only components not in client build)
// Uses vue-compiler-sfc to properly process scoped styles
function extractVueStyles (filePath: string): string[] {
  try {
    const src = readFileSync(filePath, 'utf8')
    const { descriptor } = parse(src, { filename: filePath })
    const styles: string[] = []

    // Generate scope ID using the same format as vue-loader (8-char hex hash)
    const scopeId = createHash('sha256').update(filePath).digest('hex').slice(0, 8)

    for (let i = 0; i < descriptor.styles.length; i++) {
      const style = descriptor.styles[i]!
      const result = compileStyle({
        source: style.content,
        filename: filePath,
        id: `data-v-${scopeId}`,
        scoped: style.scoped,
      })

      if (!result.errors.length && result.code) {
        styles.push(normalizeCSSContent(result.code))
      }
    }

    return styles
  } catch {
    return []
  }
}

export class SSRStylesPlugin {
  private nuxt: Nuxt
  private clientCSSByIssuer = new Map<string, Set<string>>()
  private chunksWithInlinedCSS = new Set<string>()
  private globalCSSPaths = new Set<string>()

  constructor (nuxt: Nuxt) {
    this.nuxt = nuxt
    this.globalCSSPaths = this.resolveGlobalCSS()

    // Remove CSS entries from manifest for global CSS and files that will have inlined styles
    nuxt.hook('build:manifest', (manifest) => {
      for (const [id, chunk] of Object.entries(manifest)) {
        if (chunk.isEntry && chunk.src) {
          // Track entry modules
          this.chunksWithInlinedCSS.add(chunk.src)
        } else if (this.chunksWithInlinedCSS.has(id)) {
          // Remove CSS for chunks with inlined styles
          chunk.css &&= []
        }

        // Remove global CSS from all chunks
        if (chunk.css?.length) {
          chunk.css = chunk.css.filter((cssPath) => {
            // Check if this CSS file corresponds to a global CSS module
            for (const globalPath of this.globalCSSPaths) {
              if (cssPath.includes(globalPath.split('/').pop() || '')) {
                return false
              }
            }
            return true
          })
        }
      }
    })
  }

  private escapeTemplateLiteral (str: string) {
    return str.replace(/[`\\$]/g, m => m === '$' ? '\\$' : `\\${m}`)
  }

  private isBuildAsset (url: string) {
    const buildDir = withTrailingSlash(this.nuxt.options.app.buildAssetsDir || '/_nuxt/')
    return url.startsWith(buildDir)
  }

  private isPublicAsset (url: string, nitro: ReturnType<typeof useNitro>) {
    const cleaned = url.replace(/[?#].*$/, '')
    for (const dir of nitro.options.publicAssets) {
      const base = withTrailingSlash(dir.baseURL || '/')
      if (!url.startsWith(base)) { continue }
      const path = cleaned.replace(base, withTrailingSlash(dir.dir))
      if (existsSync(path)) {
        return true
      }
    }
    return false
  }

  private rewriteStyle (css: string, nitro: ReturnType<typeof useNitro>) {
    let changed = false
    let needsPublicAsset = false
    let needsBuildAsset = false
    let lastIndex = 0
    let out = '`'

    for (const match of css.matchAll(CSS_URL_RE)) {
      const index = match.index ?? 0
      const before = css.slice(lastIndex, index)
      if (before) {
        out += this.escapeTemplateLiteral(before)
      }

      const full = match[0]
      const rawUrl = match[2] || ''
      const stripped = rawUrl.replace(/[?#].*$/, '')

      if (this.isPublicAsset(stripped, nitro)) {
        needsPublicAsset = true
        changed = true
        out += '${publicAssetsURL(' + JSON.stringify(rawUrl) + ')}'
      } else if (this.isBuildAsset(stripped)) {
        needsBuildAsset = true
        changed = true
        out += '${buildAssetsURL(' + JSON.stringify(rawUrl) + ')}'
      } else {
        out += this.escapeTemplateLiteral(full)
      }

      lastIndex = index + full.length
    }

    const tail = css.slice(lastIndex)
    if (tail) {
      out += this.escapeTemplateLiteral(tail)
    }
    out += '`'

    return {
      code: changed ? out : JSON.stringify(css),
      needsPublicAsset,
      needsBuildAsset,
    }
  }

  private resolveGlobalCSS (): Set<string> {
    const req = createRequire(this.nuxt.options.rootDir)
    const resolved = new Set<string>()
    const entries = (this.nuxt.options.css as GlobalCSSEntry[] | undefined) || []

    for (const entry of entries) {
      const src = typeof entry === 'string' ? entry : entry?.src
      if (!src) { continue }
      const path = this.resolveCSSRequest(src, req)
      if (path) {
        resolved.add(path)
      }
    }

    return resolved
  }

  private resolveCSSRequest (request: string, req: ReturnType<typeof createRequire>): string | null {
    const candidates = new Set<string>()

    const resolved = resolveAlias(request, this.nuxt.options.alias)
    if (isAbsolute(resolved)) {
      candidates.add(resolved)
    } else {
      candidates.add(resolve(this.nuxt.options.srcDir, resolved))
    }

    try {
      candidates.add(req.resolve(request))
    } catch {
      // ignore modules that can't be found
    }

    for (const candidate of candidates) {
      const path = resolveFilePath(candidate)
      if (path) {
        return path
      }
    }

    return null
  }

  private normalizeResourcePath (resource?: string | null): string | null {
    if (!resource) { return null }
    const withoutQuery = resource.split('?')[0]
    return resolveFilePath(withoutQuery)
  }

  apply (compiler: Compiler) {
    if (this.nuxt.options.dev) { return }
    const isClient = compiler.options.name === 'client'
    const isServer = compiler.options.name === 'server'
    if (!isClient && !isServer) { return }

    compiler.hooks.thisCompilation.tap('SSRStylesPlugin', (compilation) => {
      // Server build may have server-only components (islands) not in client build
      this.collectCSS(compilation)

      if (isClient) {
        this.removeGlobalCSSFromClient(compilation)
      }

      if (isServer) {
        this.emitServerStyles(compilation)
      }
    })
  }

  private emitServerStyles (compilation: Compilation) {
    const { webpack } = compilation.compiler
    const stage = webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
    compilation.hooks.processAssets.tap({ name: 'SSRStylesPlugin', stage }, () => {
      const nitro = useNitro()
      // Start with client CSS as baseline, then add server-specific CSS from bundle parsing
      // Client CSS includes styles from mini-css-extract-plugin that may not appear in server bundle
      const collected = new Map<string, Set<string>>(this.clientCSSByIssuer)

      // Collect entry module IDs first (including CSS files and Vue files)
      const entryModules = new Set<string>()
      for (const entrypoint of compilation.entrypoints.values()) {
        const primaryChunk = typeof entrypoint.getEntrypointChunk === 'function' ? entrypoint.getEntrypointChunk() : undefined
        const chunks = primaryChunk ? [primaryChunk] : entrypoint.chunks
        for (const chunk of chunks) {
          for (const mod of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
            if ('resource' in mod && typeof mod.resource === 'string') {
              // For entry modules, use resolveFilePath to get the absolute path
              const resolved = resolveFilePath(mod.resource)
              if (resolved) {
                // Try normalized path first (relative to srcDir)
                const rel = normalizePath(this.nuxt, resolved)
                if (rel) {
                  entryModules.add(rel)
                } else {
                  // For files outside srcDir, use the absolute path
                  entryModules.add(resolved)
                }
              }
            }
          }
        }
      }

      // Fallback: extract styles from server-only Vue components
      for (const module of compilation.modules) {
        const normal = module as NormalModule
        const resource = normal.resource
        if (!resource || !isVueFile(resource)) { continue }
        const rel = normalizePath(this.nuxt, resource)
        if (!rel) { continue }
        if (collected.has(rel)) { continue }

        const vueStyles = extractVueStyles(resolveFilePath(resource) || resource)
        if (vueStyles.length) {
          collected.set(rel, new Set(vueStyles))
        }
      }

      const emitted: Record<string, string> = {}
      const rawSource = webpack.sources.RawSource

      for (const [rel, cssSet] of collected.entries()) {
        if (!cssSet.size) { continue }
        const stylesArray = Array.from(cssSet)
        const transformed = stylesArray.map(style => this.rewriteStyle(style, nitro))
        const needsPublicAssets = transformed.some(t => t.needsPublicAsset)
        const needsBuildAssets = transformed.some(t => t.needsBuildAsset)
        const imports: string[] = []
        if (needsPublicAssets || needsBuildAssets) {
          const names = [] as string[]
          if (needsBuildAssets) { names.push('buildAssetsURL') }
          if (needsPublicAssets) { names.push('publicAssetsURL') }
          imports.push(`import { ${names.join(', ')} } from '#internal/nuxt/paths'`)
        }
        const moduleSource = [
          ...imports,
          `export default ${genArrayFromRaw(transformed.map(t => t.code))}`,
        ].filter(Boolean).join('\n')
        const styleModuleName = `${sanitizeStyleAssetName(rel)}-styles.mjs`
        compilation.emitAsset(styleModuleName, new rawSource(moduleSource))
        emitted[rel] = styleModuleName
        this.chunksWithInlinedCSS.add(rel)
      }

      const stylesSource = [
        'const interopDefault = r => r.default || r || []',
        `export default ${genObjectFromRawEntries(
          Object.entries(emitted).map(([key, value]) => [key, `() => import('./${value}').then(interopDefault)`]) as [string, string][],
        )}`,
      ].join('\n')

      compilation.emitAsset('styles.mjs', new rawSource(stylesSource))

      const entryIds = Array.from(this.chunksWithInlinedCSS).filter(id => entryModules.has(id))
      nitro.options.virtual['#internal/nuxt/entry-ids.mjs'] = () => `export default ${JSON.stringify(entryIds)}`
      nitro.options._config.virtual ||= {}
      nitro.options._config.virtual['#internal/nuxt/entry-ids.mjs'] = nitro.options.virtual['#internal/nuxt/entry-ids.mjs']
    })
  }

  private findIssuerPath (compilation: Compilation, mod: Module): string | null {
    let issuer: Module | null | undefined = compilation.moduleGraph.getIssuer(mod)
    while (issuer) {
      if ('resource' in issuer && typeof issuer.resource === 'string') {
        return issuer.resource
      }
      issuer = compilation.moduleGraph.getIssuer(issuer)
    }
    return null
  }

  private removeGlobalCSSFromClient (compilation: Compilation) {
    // this runs at stage 650, before the main CSS collection at stage 700.
    const stage = 650

    compilation.hooks.processAssets.tap({ name: 'SSRStylesPlugin:RemoveGlobalCSS', stage }, () => {
      for (const chunk of compilation.chunks) {
        if (chunk.name === 'nuxt-global-css') {
          // collect CSS from this chunk before deleting
          const cssAssets: string[] = []
          for (const file of Array.from(chunk.files)) {
            const filename = String(file)
            if (isCSSLike(filename)) {
              const asset = compilation.getAsset(filename)
              const source = asset?.source
              const content = source && typeof source.source === 'function' ? source.source() : null
              const text = typeof content === 'string' ? content : (content instanceof Buffer ? content.toString('utf8') : '')
              if (text) {
                cssAssets.push(text)
              }
            }
          }

          // store CSS for all modules in this chunk
          if (cssAssets.length > 0) {
            for (const mod of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
              const issuerPath = this.findIssuerPath(compilation, mod) || ('resource' in mod && typeof mod.resource === 'string' ? mod.resource : null)
              const normalized = normalizePath(this.nuxt, issuerPath)
              if (!normalized) { continue }
              const set = this.clientCSSByIssuer.get(normalized) || new Set<string>()
              for (const css of cssAssets) {
                set.add(normalizeCSSContent(css))
              }
              this.clientCSSByIssuer.set(normalized, set)
            }
          }

          // delete the CSS files from the client build
          for (const file of Array.from(chunk.files)) {
            const filename = String(file)
            if (isCSSLike(filename)) {
              compilation.deleteAsset(filename)
              chunk.files.delete(file)
            }
          }
        }
      }
    })
  }

  private collectCSS (compilation: Compilation) {
    const { webpack } = compilation.compiler
    const isServer = compilation.compiler.options.name === 'server'
    const stage = isServer
      ? webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
      : webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER

    const chunkCSSMeta = new Map<any, { files: string[], modules: NormalModule[] }>()

    compilation.hooks.processAssets.tap({ name: 'SSRStylesPlugin', stage }, () => {
      // First, associate emitted CSS assets with the modules in their chunks
      const cssAssetsByChunk = new Map<any, string[]>()
      for (const chunk of compilation.chunks) {
        const cssAssets: string[] = []
        const chunkCSSFiles: string[] = []
        for (const file of chunk.files) {
          if (!isCSSLike(file)) { continue }
          chunkCSSFiles.push(file)
          const asset = compilation.getAsset(file)
          const source = asset?.source
          const content = source && typeof source.source === 'function' ? source.source() : null
          const text = typeof content === 'string' ? content : (content instanceof Buffer ? content.toString('utf8') : '')
          if (text) {
            cssAssets.push(text)
          }
        }
        if (chunkCSSFiles.length) {
          const chunkCSSModules = Array.from(compilation.chunkGraph.getChunkModulesIterable(chunk)) as NormalModule[]
          chunkCSSMeta.set(chunk, { files: chunkCSSFiles, modules: chunkCSSModules })
        }
        if (cssAssets.length) {
          cssAssetsByChunk.set(chunk, cssAssets)
        }
      }

      for (const [chunk, cssAssets] of cssAssetsByChunk) {
        for (const mod of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
          const issuerPath = this.findIssuerPath(compilation, mod) || ('resource' in mod && typeof mod.resource === 'string' ? mod.resource : null)
          const normalized = normalizePath(this.nuxt, issuerPath)
          if (!normalized) { continue }
          const set = this.clientCSSByIssuer.get(normalized) || new Set<string>()
          for (const css of cssAssets) {
            set.add(normalizeCSSContent(css))
          }
          this.clientCSSByIssuer.set(normalized, set)
        }
      }

      for (const mod of compilation.modules) {
        const issuerPath = this.findIssuerPath(compilation, mod)
        const normalized = normalizePath(this.nuxt, issuerPath)
        if (!normalized) {
          continue
        }

        const cssChunks = this.getModuleCSS(mod, compilation)

        if (!cssChunks.length) { continue }
        const set = this.clientCSSByIssuer.get(normalized) || new Set<string>()
        set.add(cssChunks.join('\n'))
        this.clientCSSByIssuer.set(normalized, set)
      }
    })
  }

  private getModuleCSS (mod: Module, _compilation: Compilation): string[] {
    const cssModule = mod as CssModule
    const cssChunks: string[] = []

    // Extract from mini-css-extract-plugin modules which have processed CSS
    if (mod.type === 'css/mini-extract' && Array.isArray(cssModule.content)) {
      for (const part of cssModule.content as Array<[string, string]>) {
        const css = part?.[1]
        if (css && typeof css === 'string') {
          cssChunks.push(normalizeCSSContent(css))
        }
      }
    }

    return cssChunks
  }
}

type GlobalCSSEntry = string | { src?: string }
