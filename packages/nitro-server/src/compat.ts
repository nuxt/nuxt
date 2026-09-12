import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dirname, isAbsolute, join, normalize, resolve } from 'pathe'
import MagicString from 'magic-string'
import { withTrailingSlash } from 'ufo'
import { createUnimport } from 'unimport'
import type { Unimport } from 'unimport'
import { resolveModulePath } from 'exsolve'
import { getLayerDirectories, resolveAlias } from '@nuxt/kit'
import { trackPendingTemplate } from '@nuxt/kit/internal'
import type { Nuxt, ServerApi } from '@nuxt/schema'
import type { NitroConfig, NitroOptions } from 'nitro/types'

import { distDir, toArray } from './utils.ts'
import { nitroBuildDiagnostics } from './diagnostics.ts'
import { getH3ExportNames, getH3ImportsPreset, getNuxtServerImportsPreset, nuxtServerImportsPreset, v2ImportsPreset } from './imports.ts'
import { wrapLegacyHandler } from './runtime/compat/wrapper.ts'
import { migratedPlugins, serverApiOf } from './registrations.ts'

/**
 * Granular toggles for the opt-in `nitroLegacy` layer.
 *
 * Transitional: the whole compatibility layer is removed in Nuxt 6.
 */
export interface NitroLegacyOptions {
  /** Register the Nitro v2 auto-import names (`defineNitroPlugin`, `cachedEventHandler`, `useEvent`, …). */
  imports?: boolean
  /** Resolve `h3` to the bundled h3 v1 helper shim. */
  h3?: boolean
  /** Resolve `nitropack`, `nitropack/runtime` and `#internal/nitro` to their Nitro v3 equivalents. */
  specifiers?: boolean
  /** Support the `useRuntimeConfig(event)` signature and its per-request semantics. */
  runtimeConfig?: boolean
  /** Accept Nitro v2 config shapes (handlers without a `route`) and warn about removed options. */
  config?: boolean
}

export type ResolvedNitroLegacyOptions = Required<NitroLegacyOptions>

const LEGACY_KEYS = ['imports', 'h3', 'specifiers', 'runtimeConfig', 'config'] as const

/**
 * Resolve `nitroLegacy`. `true` enables every toggle; an object enables every
 * toggle it does not explicitly disable.
 */
export function resolveNitroLegacyOptions (input: boolean | NitroLegacyOptions | undefined): ResolvedNitroLegacyOptions {
  const enabled = input === true || (!!input && typeof input === 'object')
  const overrides = input && typeof input === 'object' ? input : {}
  return Object.fromEntries(LEGACY_KEYS.map(key => [key, overrides[key] ?? enabled])) as ResolvedNitroLegacyOptions
}

function isLegacyEnabled (options: ResolvedNitroLegacyOptions): boolean {
  return LEGACY_KEYS.some(key => options[key])
}

/**
 * Options which existed in Nitro v2 config and have no Nitro v3 equivalent. `externals` is
 * one of them: v3 configures externalization through `noExternals` and `traceOpts`.
 *
 * `imports` is deliberately absent: Nitro v3 no longer reads it, but Nuxt does, for the
 * server auto-imports it now owns itself.
 */
const REMOVED_NITRO_OPTIONS = ['analyze', 'appConfig', 'appConfigFiles', 'bundledStorage', 'esbuild', 'externals', 'moduleSideEffects', 'nodeModulesDirs', 'sourceMap', 'timing']

interface CompatScope {
  h3: boolean
  specifiers: boolean
  imports: boolean
}

const TAG_SCOPE: CompatScope = { h3: true, specifiers: true, imports: true }

const NITRO_V2_SPECIFIER_RE = /^(?:nitropack(?:\/|$)|#internal\/nitro(?:\/|$))/
const GLOB_SUFFIX_RE = /\/[^/*]*\*[\s\S]*$/
const TRANSFORMABLE_RE = /\.[cm]?[jt]sx?$/
const DECLARATION_RE = /\.d\.[cm]?ts$/
const OWN_VIRTUAL_RE = /^(?:#internal\/|#nuxt-compat\/|#build\/|#nitro|#spa-template|nuxt\/)/
/** Marks code written against Nitro v3 or `nuxt/server`: it must not be given v2 semantics. */
const MIGRATED_SPECIFIER_RE = /^(?:nitro|#nitro|nuxt\/server)(?:\/|$)/
const SPECIFIER_HINT_RE = /['"](?:h3(?:\/utils)?|nitropack|#internal\/nitro|#imports)(?:\/[^'"]*)?['"]/
const IMPORT_KEYWORD_RE = /(?:\bfrom|\bimport|\brequire)[\s(]*$/

interface ImportSpecifier {
  value: string
  /** Offset of the first character of the specifier, inside its quotes. */
  start: number
  end: number
}

/**
 * Collect module specifiers that are actually imported, skipping anything inside a comment
 * or a string literal, so that `throw new Error("import 'h3' directly")` is not rewritten.
 */
function findImportSpecifiers (code: string): ImportSpecifier[] {
  const specifiers: ImportSpecifier[] = []

  for (let index = 0; index < code.length; index++) {
    const char = code[index]!

    if (char === '/') {
      const next = code[index + 1]
      if (next === '/') {
        index = code.indexOf('\n', index + 2)
        if (index === -1) {
          return specifiers
        }
        continue
      }
      if (next === '*') {
        const end = code.indexOf('*/', index + 2)
        if (end === -1) {
          return specifiers
        }
        index = end + 1
        continue
      }
      continue
    }

    if (char !== '\'' && char !== '"' && char !== '`') {
      continue
    }

    // find the end of the literal, honouring escapes
    let end = index + 1
    while (end < code.length && code[end] !== char) {
      end += code[end] === '\\' ? 2 : 1
    }
    if (end >= code.length) {
      return specifiers
    }

    if (char !== '`' && IMPORT_KEYWORD_RE.test(code.slice(Math.max(0, index - 32), index))) {
      specifiers.push({ value: code.slice(index + 1, end), start: index + 1, end })
    }

    index = end
  }

  return specifiers
}

/** Specifiers only code written for nitro v2 / h3 v1 imports. */
const LEGACY_SPECIFIER_RE = /^(?:h3(?:\/utils)?$|#imports$|nitropack(?:\/|$)|#internal\/nitro(?:\/|$))/

/** The specifiers that say a file is nitro v2 code. A migrated specifier wins over a legacy one. */
function legacySpecifiers (code: string, migratedVirtuals?: Set<string>): string[] {
  const legacy = new Set<string>()
  for (const specifier of findImportSpecifiers(code)) {
    if (MIGRATED_SPECIFIER_RE.test(specifier.value) || migratedVirtuals?.has(specifier.value)) {
      return []
    }
    if (LEGACY_SPECIFIER_RE.test(specifier.value)) {
      legacy.add(specifier.value)
    }
  }
  return [...legacy]
}

/**
 * The files in the compat scope that are, by their imports, nitro v2 code, with the
 * specifiers that say so.
 *
 * Read up front rather than as the bundler reaches them: the answer is baked into the
 * error handler and decides whether the layer is installed at all.
 */
export function scanLegacyScope (files: Iterable<string>, dirs: Iterable<string>, exclude: Set<string> = new Set(), sources: Map<string, string> = new Map(), migratedVirtuals?: Set<string>): Map<string, string[]> {
  const found = new Map<string, string[]>()
  const seen = new Set<string>()
  for (const [id, code] of sources) {
    const specifiers = legacySpecifiers(code, migratedVirtuals)
    if (specifiers.length > 0) {
      found.set(id, specifiers)
    }
  }
  const check = (path: string) => {
    if (seen.has(path) || exclude.has(path) || !TRANSFORMABLE_RE.test(path) || DECLARATION_RE.test(path)) {
      return
    }
    seen.add(path)
    let code: string
    try {
      code = readFileSync(path, 'utf8')
    } catch {
      return
    }
    const specifiers = legacySpecifiers(code, migratedVirtuals)
    if (specifiers.length > 0) {
      found.set(path, specifiers)
    }
  }

  for (const path of files) {
    check(path)
  }

  const pending = [...dirs]
  while (pending.length > 0) {
    const dir = pending.pop()!
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        // a nested `node_modules` is a dependency of the module, not the module
        if (entry.name !== 'node_modules') {
          pending.push(path)
        }
      } else {
        check(path)
      }
    }
  }

  return found
}

/**
 * The virtual modules a module registered whose own contents are nitro v3 code. A module
 * that migrated behind a version-gated virtual of its own imports only that specifier, so
 * the files importing it are migrated too.
 */
function migratedVirtualIds (sources: Map<string, string>): Set<string> {
  const migrated = new Set<string>()
  for (const [id, code] of sources) {
    const specifiers = findImportSpecifiers(code)
    if (specifiers.length > 0 && specifiers.every(specifier => MIGRATED_SPECIFIER_RE.test(specifier.value))) {
      migrated.add(id)
    }
  }
  return migrated
}

/**
 * The files the server build can reach from a registered entry, by following their
 * imports. A module's runtime directory also holds its app-side (Vite-bundled) code, which
 * the server build never sees and which the layer therefore never transforms.
 *
 * @param roots Registered server entries: handlers, plugins, auto-import sources, module virtuals.
 * @param sources Contents of the virtual entries among the roots.
 * @param resolveImport Specifier and importer to a file path, or `undefined` for anything outside the scan.
 */
function reachableFiles (roots: Iterable<string>, sources: Map<string, string>, resolveImport: (specifier: string, importer: string) => string | undefined): Set<string> {
  const reached = new Set<string>()
  const pending: string[] = []
  const add = (path: string) => {
    if (!reached.has(path)) {
      reached.add(path)
      pending.push(path)
    }
  }

  for (const root of roots) {
    add(root)
  }

  while (pending.length > 0) {
    const importer = pending.pop()!
    let code = sources.get(importer)
    if (code === undefined) {
      if (!TRANSFORMABLE_RE.test(importer)) {
        continue
      }
      try {
        code = readFileSync(importer, 'utf8')
      } catch {
        continue
      }
    }
    for (const specifier of findImportSpecifiers(code)) {
      const resolved = resolveImport(specifier.value, importer)
      if (resolved) {
        add(resolved)
      }
    }
  }

  return reached
}

/** Every transformable file under the given directories, ignoring nested dependencies. */
function listFiles (roots: Iterable<string>): string[] {
  const found: string[] = []
  const pending = [...roots]
  while (pending.length > 0) {
    const dir = pending.pop()!
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          pending.push(path)
        }
      } else if (TRANSFORMABLE_RE.test(path) && !DECLARATION_RE.test(path)) {
        found.push(path)
      }
    }
  }
  return found
}

function compatRuntimePath (name: string) {
  const base = resolve(distDir, 'runtime/compat', name)
  for (const extension of ['.ts', '.mjs', '.js']) {
    if (existsSync(base + extension)) {
      return base + extension
    }
  }
  return base
}

export interface InstalledModule {
  /** Package root (or in-project directory) of the module. */
  dir: string
  /** The module's `meta.name`, for the build notice. */
  name?: string
  /** The module's `meta.compatibility.server`, when it declared one. */
  server?: ServerApi
}

/** Whether declared code has left nitro v2 behind. */
function isMigrated (compatibility: ServerApi | undefined): boolean {
  return compatibility === 'nitro3' || compatibility === 'nuxt'
}

export interface LegacyImportsPreset {
  from: string
  imports: Array<string | { name: string, as?: string }>
}

/** Render a set of auto-import presets as explicit re-exports for a barrel module. */
function renderPresetReExports (presets: LegacyImportsPreset[]): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const preset of presets) {
    const specifiers: string[] = []
    for (const entry of preset.imports) {
      const name = typeof entry === 'string' ? entry : entry.name
      const as = typeof entry === 'string' ? entry : entry.as || entry.name
      if (seen.has(as)) {
        continue
      }
      seen.add(as)
      specifiers.push(name === as ? name : `${name} as ${as}`)
    }
    if (specifiers.length > 0) {
      lines.push(`export { ${specifiers.join(', ')} } from ${JSON.stringify(preset.from)}`)
    }
  }
  return lines
}

/** Nitro subpaths that only exist for the builder, and should never be bundled into the server. */
const BUILDER_ONLY_NITRO_EXPORTS = new Set(['./builder', './vite', './vite/types', './types', './tsconfig', './package.json'])

/**
 * `nitro` and its subpaths, mapped to the copy `@nuxt/nitro-server` resolved.
 *
 * Used as a last resort by the resolution plugin, never as an alias: nitro is a dependency
 * of this package rather than of the user's project, so a bare `nitro/cache` import from
 * module code has no resolution base that can reach it, while nitro's own runtime must keep
 * resolving through nitro, or the dev server and the app end up with separate instances of
 * modules that hold state (the route rules among them).
 */
export function getNitroPackageResolutions (): Record<string, string> {
  const aliases: Record<string, string> = {}
  const manifest = resolveModulePath('nitro/package.json', { from: import.meta.url, try: true })
  if (!manifest) {
    return aliases
  }

  let exports: Record<string, unknown>
  try {
    exports = (JSON.parse(readFileSync(manifest, 'utf8')) as { exports?: Record<string, unknown> }).exports || {}
  } catch {
    return aliases
  }

  for (const key in exports) {
    if (key.includes('*') || BUILDER_ONLY_NITRO_EXPORTS.has(key)) {
      continue
    }
    // a conditional entry is left to the bundler, which resolves it for its own target
    if (typeof exports[key] !== 'string') {
      continue
    }
    const specifier = key === '.' ? 'nitro' : `nitro/${key.slice(2)}`
    const resolved = resolveModulePath(specifier, { from: import.meta.url, try: true })
    if (resolved) {
      aliases[specifier] = resolved
    }
  }

  return aliases
}

/**
 * Nitro v2 runtime specifiers, aliased for the whole server build rather than only for the
 * transform's scope: a dependency importing `nitropack/runtime` otherwise resolves the
 * installed nitro v2, whose internals then fail on Nitro v3's virtual modules.
 *
 * Only the exact specifiers are mapped; a deep import of copied nitro internals is a
 * documented break.
 */
export function getLegacyNitroAliases (): Record<string, string> {
  const barrel = compatRuntimePath('nitro-v2')
  return {
    'nitropack': barrel,
    'nitropack/runtime': barrel,
    'nitropack/runtime/meta': barrel,
    'nitropack/types': barrel,
    '#internal/nitro': barrel,
  }
}

/** A package's root, and its real path where the two differ, for a prefix comparison. */
function getPackageDirs (manifest: string, rootDir: string): string[] {
  const resolved = resolveModulePath(manifest, { from: [rootDir, import.meta.url], try: true })
  if (!resolved) {
    return []
  }
  const dir = dirname(normalize(resolved))
  const real = toRealPath(dir)
  return real === dir ? [withTrailingSlash(dir)] : [withTrailingSlash(dir), withTrailingSlash(real)]
}

const realpaths = new Map<string, string>()

/** Drop memoised realpaths, for a dev session where a symlink target changed. */
function clearRealPathCache (path?: string): void {
  if (path === undefined) {
    realpaths.clear()
  } else {
    realpaths.delete(path)
  }
}

/**
 * Bundler module ids are realpaths (`preserveSymlinks: false`), while registered paths
 * reach a pnpm module through its `node_modules/<name>` symlink, so the two only
 * prefix-match once both sides are resolved through the same real path.
 */
function toRealPath (path: string): string {
  const cached = realpaths.get(path)
  if (cached !== undefined) {
    return cached
  }
  let resolved = path
  try {
    resolved = normalize(realpathSync.native(path))
  } catch {
    // path does not exist (a glob root, a virtual id); keep it as-is
  }
  realpaths.set(path, resolved)
  return resolved
}

/** Nitro v3 resolves aliases in insertion order, so a prefix must never precede a longer key. */
export function sortAliasesByPrecedence<T> (aliases: Record<string, T>): Record<string, T> {
  const keys = Object.keys(aliases).sort((a, b) => b.split('/').length - a.split('/').length || b.length - a.length)
  return Object.fromEntries(keys.map(key => [key, aliases[key]!]))
}

function getLegacyH3ShimPath (): string {
  return compatRuntimePath('h3-v1')
}

export function getLegacyRuntimeConfigPath (): string {
  return compatRuntimePath('runtime-config')
}

/** The Nitro v2 auto-import names implemented by the compat runtime rather than by Nitro v3. */
function getLegacyImportsPreset (): Array<{ from: string, imports: string[], priority?: number }> {
  return [
    { from: compatRuntimePath('render'), imports: ['defineRenderHandler'] },
    { from: compatRuntimePath('event'), imports: ['useEvent'] },
    { from: resolve(distDir, 'runtime/utils/app-config'), imports: ['useAppConfig'], priority: -1 },
  ]
}

/** The portable names that take Nitro v2 semantics under the given toggles, and where each comes from. */
async function getLegacyImportOverrides (legacy: Pick<ResolvedNitroLegacyOptions, 'h3' | 'runtimeConfig'>): Promise<Record<string, string>> {
  const overrides: Record<string, string> = {}
  if (legacy.h3) {
    const h3Names = new Set(await getH3ExportNames())
    for (const name of nuxtServerImportsPreset.imports) {
      if (h3Names.has(name)) {
        overrides[name] = getLegacyH3ShimPath()
      }
    }
  }
  if (legacy.runtimeConfig) {
    overrides.useRuntimeConfig = getLegacyRuntimeConfigPath()
  }
  return overrides
}

/**
 * The server auto-import presets, with the names the `nitroLegacy` toggles affect
 * redirected to their Nitro v2 implementations. With every toggle off, the default list.
 */
export async function getServerImportsPresets (legacy: ResolvedNitroLegacyOptions): Promise<Array<{ from: string, imports: Array<string | { name: string, as?: string }>, priority?: number }>> {
  return [
    ...getNuxtServerImportsPreset(await getLegacyImportOverrides(legacy)),
    ...v2ImportsPreset,
    ...legacy.imports ? getLegacyImportsPreset() : [],
    await getH3ImportsPreset(legacy.h3 ? getLegacyH3ShimPath() : undefined),
  ]
}

/**
 * Set up Nitro v2 compatibility: a resolution transform scoped to nitro v2 code, plus a
 * runtime wrapper on declared v2 handler entries for what resolution cannot fix.
 *
 * Transitional, and removed in Nuxt 6. Installed only when the scope holds code importing
 * from `h3`, `nitropack` or `#imports`.
 *
 * Not covered, and expected to break: live storage and task introspection, handing the
 * node request/response to an external framework beyond the `event.node` bridge, imports
 * of copied nitro internals, `useStorage` cache key layout, render-hook body replacement.
 *
 * Removal checklist: this module and `runtime/compat/*`; the `nitroLegacy` option
 * (`augments.ts`, `schema/config/nitro.ts`); the aliases `getLegacyNitroAliases` adds; the
 * `#nuxt-compat/*` virtuals and their `tsdown` externals; the `render:response` hook,
 * `rememberRenderBody` in `utils/renderer/options.ts` and the `hasLegacyHookListener`
 * check in `handlers/renderer.ts`; the `legacyCompat` branches in `handlers/error.ts`,
 * `handlers/renderer.ts` and `utils/renderer/options.ts`; the `NUXT_B9001`-`B9004` and
 * `NUXT_E8008`-`E8010` diagnostics; the `nitro-legacy` and `nitro-module-compat` fixtures.
 *
 * Returns a callback that absorbs registrations made after the build config was assembled;
 * call it once the nitro instance exists.
 */
export async function setupNitroCompat (nuxt: Nuxt, nitroConfig: NitroConfig, legacy: ResolvedNitroLegacyOptions, modulePresets: LegacyImportsPreset[], installedModules: InstalledModule[] = [], unusedVariants: string[] = []): Promise<(nitro: { options: NitroOptions }) => void> {
  // a module may register its handler through an alias it added for the server build only
  const aliases: Record<string, string> = { ...nitroConfig.alias as Record<string, string>, ...nuxt.options.alias }
  const files = new Map<string, CompatScope>()
  const dirs: Array<[prefix: string, scope: CompatScope]> = []
  // every file in these is a server entry, unlike a module runtime directory, which also
  // holds app-side code
  const entryDirs: string[] = []
  const unrouted: string[] = []
  const widened: string[] = []
  let declaredLegacy = false

  // a variant the builder did not pick is still on disk next to the one in use, and must
  // count neither as scope nor as v2 evidence
  const unusedFiles = new Set<string>()
  for (const variant of unusedVariants) {
    const resolved = normalize(resolveAlias(variant, aliases))
    unusedFiles.add(resolved)
    unusedFiles.add(toRealPath(resolved))
    const file = resolveModulePath(resolved, { try: true, extensions: nuxt.options.extensions, from: [nuxt.options.rootDir, import.meta.url] })
    if (file) {
      unusedFiles.add(normalize(file))
      unusedFiles.add(toRealPath(normalize(file)))
    }
  }

  const addFile = (path: string, scope: CompatScope) => {
    const resolved = normalize(resolveAlias(path, aliases))
    files.set(resolved, scope)
    files.set(toRealPath(resolved), scope)
    return resolved
  }

  const wrapped = new Map<string, string>()
  const wrapperPath = compatRuntimePath('wrapper')
  const ownRuntime = withTrailingSlash(normalize(distDir))
  const layerServerDirs = getLayerDirectories(nuxt).map(layer => withTrailingSlash(normalize(layer.server)))
  // Nuxt's own runtime and generated code are nitro v3, and stay out of scope by
  // declaration rather than by the accident of how core modules are installed. Nitro's
  // own runtime is v3 by definition, and the bare `h3` its internal routes import is h3 v2.
  const protectedDirs = [ownRuntime, withTrailingSlash(normalize(nuxt.options.buildDir)), ...getPackageDirs('nuxt/package.json', nuxt.options.rootDir), ...getPackageDirs('nitro/package.json', nuxt.options.rootDir)]
  const isProtected = (path: string) => protectedDirs.some(dir => path.startsWith(dir))
  const isUserServerCode = (path: string) => layerServerDirs.some(dir => path.startsWith(dir))
  nitroConfig.virtual ||= {}
  const isModuleVirtual = (id: string) => id in nitroConfig.virtual! && !OWN_VIRTUAL_RE.test(id)
  let wrapperIndex = 0

  /**
   * The virtual module wrapping a v2 handler file, one per file and mounted base: a
   * handler mounted below a base saw `event.path` relative to it in nitro v2, so the
   * wrapper needs the base the registration was widened from.
   */
  const wrapHandlerFile = (target: string, base: string | undefined, virtuals: Record<string, string | (() => string | Promise<string>)>) => {
    const key = `${target}\0${base ?? ''}`
    const existing = wrapped.get(key)
    if (existing) {
      return existing
    }
    const virtual = `#nuxt-compat/handler-${wrapperIndex++}`
    wrapped.set(key, virtual)
    virtuals[virtual] = () => [
      `import { wrapLegacyHandler } from ${JSON.stringify(wrapperPath)}`,
      `import _handler from ${JSON.stringify(target)}`,
      `export default wrapLegacyHandler(_handler${base ? `, ${JSON.stringify(base)}` : ''})`,
    ].join('\n')
    return virtual
  }

  /**
   * Every path the scan could have keyed a registration under. A handler is registered
   * without an extension, while the scan keys the file it read, so the two only match
   * once the specifier is resolved to a file and through its symlink.
   */
  const registrationPaths = (path: string): string[] => {
    const target = normalize(resolveAlias(path, aliases))
    const paths = [target, toRealPath(target)]
    const file = resolveModulePath(target, { try: true, extensions: nuxt.options.extensions, from: [nuxt.options.rootDir, import.meta.url] })
    if (file) {
      const resolved = normalize(file)
      paths.push(resolved, toRealPath(resolved))
    }
    return paths
  }

  /**
   * Scope a directory of module code, dropping any glob suffix. Every file in an `entry`
   * directory is a server entry, as it is for a scanned auto-import directory, rather than
   * only the files the build reaches from one.
   */
  const addModuleScopeDir = (dir: string, entry = false) => {
    const target = normalize(resolveAlias(dir, aliases)).replace(GLOB_SUFFIX_RE, '')
    if (!isAbsolute(target) || isProtected(target) || isUserServerCode(target) || !existsSync(target)) {
      return
    }
    dirs.push([withTrailingSlash(target), TAG_SCOPE])
    if (entry) {
      entryDirs.push(withTrailingSlash(target))
    }
    const real = toRealPath(target)
    if (real !== target) {
      dirs.push([withTrailingSlash(real), TAG_SCOPE])
      if (entry) {
        entryDirs.push(withTrailingSlash(real))
      }
    }
  }

  const addModuleScope = (path: unknown) => {
    if (typeof path !== 'string' || !path) {
      return
    }
    if (isModuleVirtual(path)) {
      files.set(path, TAG_SCOPE)
      return
    }
    const target = normalize(resolveAlias(path, aliases))
    if (!isAbsolute(target) || isProtected(target) || isUserServerCode(target)) {
      return
    }
    files.set(target, TAG_SCOPE)
    files.set(toRealPath(target), TAG_SCOPE)
    dirs.push([withTrailingSlash(dirname(target)), TAG_SCOPE])
    const realDir = withTrailingSlash(dirname(toRealPath(target)))
    if (realDir !== withTrailingSlash(dirname(target))) {
      dirs.push([realDir, TAG_SCOPE])
    }
  }

  for (const handler of nitroConfig.handlers || []) {
    const entry = handler as typeof handler & { handler: unknown }
    const compatibility = serverApiOf(entry)
    if (isMigrated(compatibility) || typeof entry.handler !== 'string') {
      continue
    }
    if (compatibility === undefined) {
      addModuleScope(entry.handler)
      continue
    }
    if (compatibility === 'nitro2') {
      declaredLegacy = true
      normalizeLegacyHandlerRoute(entry, unrouted)
      const base = widenLegacyHandlerRoute(entry, widened)
      const target = addFile(entry.handler, TAG_SCOPE)
      // module runtime code lives next to its entry, unless the entry is userland code
      if (!isUserServerCode(target)) {
        dirs.push([withTrailingSlash(dirname(target)), TAG_SCOPE])
        const realDir = withTrailingSlash(dirname(toRealPath(target)))
        if (realDir !== withTrailingSlash(dirname(target))) {
          dirs.push([realDir, TAG_SCOPE])
        }
      }
      nitroConfig.virtual ||= {}
      entry.handler = wrapHandlerFile(target, base, nitroConfig.virtual)
    }
  }

  // dev handlers are live functions, so they are wrapped in place. An untagged one is v2 by
  // the same contract as an untagged `addServerHandler`, and there is no file to classify it by
  for (const handler of nuxt.options.devServerHandlers) {
    const entry = handler as typeof handler & { handler: unknown }
    const compatibility = serverApiOf(entry)
    if (compatibility === 'nitro2' || compatibility === undefined) {
      declaredLegacy ||= compatibility === 'nitro2'
      normalizeLegacyHandlerRoute(entry as { route?: string, middleware?: boolean, handler: string }, unrouted)
      const base = widenLegacyHandlerRoute(entry, widened)
      if (typeof entry.handler === 'function') {
        entry.handler = wrapLegacyHandler(entry.handler, base) as typeof entry.handler
      }
    }
  }

  const v3Plugins = migratedPlugins(nuxt)
  const isV3Plugin = (plugin: string) => {
    const resolved = normalize(resolveAlias(plugin, aliases))
    return v3Plugins.has(resolved) || v3Plugins.has(toRealPath(resolved))
  }
  for (const plugin of nuxt.options.nitro.plugins || []) {
    if (typeof plugin === 'string' && !isV3Plugin(plugin)) {
      addModuleScope(plugin)
    }
  }

  // module runtime code reaches the build in more ways than it is registered (a
  // module-owned alias, a deep import from a virtual), so scope the conventional runtime
  // directories of every module that has not declared itself migrated
  const v2ModuleDirs: string[] = []
  for (const module of installedModules) {
    if (isMigrated(module.server)) {
      continue
    }
    v2ModuleDirs.push(withTrailingSlash(normalize(module.dir)))
    addModuleScopeDir(resolve(module.dir, 'runtime'))
    addModuleScopeDir(resolve(module.dir, 'dist/runtime'))
  }

  // ... and any module-owned alias target outside those directories
  for (const alias of Object.values({ ...nuxt.options.alias, ...nitroConfig.alias })) {
    if (typeof alias !== 'string' || !isAbsolute(alias) || !v2ModuleDirs.some(dir => alias.startsWith(dir))) {
      continue
    }
    if (statSync(alias, { throwIfNoEntry: false })?.isDirectory()) {
      addModuleScopeDir(alias, true)
    } else {
      addModuleScope(alias)
    }
  }

  // an auto-import source, scanned directory or server template is classified by what the
  // file itself imports, since these registrations name no server API
  const nitroImports = nitroConfig.imports || undefined
  for (const entry of nitroImports?.imports || []) {
    const from = typeof entry === 'string' ? undefined : entry.from
    if (typeof from === 'string') {
      addModuleScope(from)
    }
  }

  for (const dir of nitroImports?.dirs || []) {
    if (typeof dir === 'string') {
      addModuleScopeDir(dir, true)
    }
  }

  for (const filename in nitroConfig.virtual) {
    if (isModuleVirtual(filename)) {
      files.set(filename, TAG_SCOPE)
    }
  }

  if (legacy.h3 || legacy.specifiers) {
    const userScope: CompatScope = { h3: legacy.h3, specifiers: legacy.specifiers, imports: legacy.imports }
    for (const layer of getLayerDirectories(nuxt)) {
      dirs.push([withTrailingSlash(normalize(layer.server)), userScope], [withTrailingSlash(normalize(layer.shared)), userScope])
      entryDirs.push(withTrailingSlash(normalize(layer.server)), withTrailingSlash(normalize(layer.shared)))
    }
  }

  // reported whether or not the app opted into the layer: a module can set one
  // (`nitro.ignore`) on its behalf
  const removed = REMOVED_NITRO_OPTIONS.filter(key => key in (nuxt.options.nitro as Record<string, unknown>))
  if (removed.length > 0) {
    nitroBuildDiagnostics.NUXT_B9001({ keys: removed.map(key => `\`${key}\``).join(', ') })
  }

  if (legacy.config) {
    for (const handler of nitroConfig.handlers || []) {
      const entry = handler as { route?: string, middleware?: boolean, handler: string }
      // Nuxt's own `route: ''` middleware is not something a user can act on
      normalizeLegacyHandlerRoute(entry, typeof entry.handler === 'string' && normalize(entry.handler).startsWith(ownRuntime) ? [] : unrouted)
    }
  }

  if (unrouted.length > 0) {
    nitroBuildDiagnostics.NUXT_B9002({ count: unrouted.length, handlers: unrouted.map(handler => `\`${handler}\``).join('\n  - ') })
  }

  if (widened.length > 0) {
    nitroBuildDiagnostics.NUXT_B9004({ count: widened.length, handlers: widened.join('\n  - ') })
  }

  nitroConfig.plugins = toArray(nitroConfig.plugins || [])

  // nothing below is installed until the scope is known to hold nitro v2 code, but the
  // layer stays registered: a module can still push v2 code into `nitro.options` later
  let active = isLegacyEnabled(legacy) || declaredLegacy
  const reported = new Set<string>()

  const reportLegacyScope = (found: Map<string, string[]>) => {
    const byModule = new Map<string, Set<string>>()
    for (const [path, specifiers] of found) {
      if (reported.has(path) || isUserServerCode(path)) {
        continue
      }
      reported.add(path)
      const module = installedModules.find(m => path.startsWith(withTrailingSlash(normalize(m.dir))))
      const key = module?.name || module?.dir || (virtualSources.has(path) ? path : dirname(path))
      const set = byModule.get(key) || new Set()
      byModule.set(key, set)
      for (const specifier of specifiers) {
        set.add(specifier)
      }
    }
    if (byModule.size > 0) {
      nitroBuildDiagnostics.NUXT_B9003({
        count: byModule.size,
        modules: [...byModule].map(([module, specifiers]) => `\`${module}\` (imports ${[...specifiers].map(s => `\`${s}\``).join(', ')})`).join('\n  - '),
      })
    }
  }

  // unshifted, not pushed: the hooks bridge observes registrations through the public
  // `hooks.hook`, so it initialises before module plugins run. It comes with the layer
  // itself, since module code registers `beforeResponse` without the app opting in.
  const runtimePlugins = [
    compatRuntimePath('event-plugin'),
    compatRuntimePath('hooks-plugin'),
  ]
  const activate = (plugins: string[]) => {
    active = true
    if (!plugins.includes(runtimePlugins[0]!)) {
      plugins.unshift(...runtimePlugins)
    }
  }

  /**
   * A specifier resolved the way the server build resolves it, for walking the import
   * graph of the registered entries. Nitro v2 and v3 specifiers lead nowhere in scope.
   */
  const resolveScopeImport = (specifier: string, importer: string): string | undefined => {
    if (LEGACY_SPECIFIER_RE.test(specifier) || MIGRATED_SPECIFIER_RE.test(specifier) || OWN_VIRTUAL_RE.test(specifier)) {
      return
    }
    const target = specifier[0] === '.' && isAbsolute(importer)
      ? resolve(dirname(importer), specifier)
      : normalize(resolveAlias(specifier, aliases))
    const file = resolveModulePath(target, { try: true, extensions: nuxt.options.extensions, from: [isAbsolute(importer) ? dirname(importer) : nuxt.options.rootDir, nuxt.options.rootDir] })
    return file ? normalize(file) : undefined
  }

  /** The scanned files the server build can reach, so app-side module code is left out. */
  const attributable = (found: Map<string, string[]>): Map<string, string[]> => {
    const roots = new Set<string>()
    for (const id of files.keys()) {
      // a registration names a specifier, while the scan keys the file it read
      for (const path of registrationPaths(id)) {
        roots.add(path)
      }
    }
    for (const path of listFiles(entryDirs)) {
      roots.add(path)
    }
    const reached = reachableFiles(roots, virtualSources, resolveScopeImport)
    const filtered = new Map<string, string[]>()
    for (const [path, specifiers] of found) {
      if (reached.has(path) || reached.has(toRealPath(path))) {
        filtered.set(path, specifiers)
      }
    }
    return filtered
  }

  const rescan = (plugins: string[], handlers: Array<{ route?: string, middleware?: boolean, handler?: unknown }> = [], virtuals?: Record<string, string | (() => string | Promise<string>)>) => {
    const found = attributable(scanLegacyScope(files.keys(), dirs.map(([prefix]) => prefix), unusedFiles, virtualSources, migratedVirtualIds(virtualSources)))
    if (found.size === 0) {
      return
    }
    reportLegacyScope(found)
    if (!active) {
      activate(plugins)
    }
    // an undeclared handler whose file turns out to be v2 gets the v2 route semantics too
    const late: string[] = []
    const lateWidened: string[] = []
    for (const entry of handlers) {
      if (typeof entry.handler !== 'string' || isMigrated(serverApiOf(entry))) {
        continue
      }
      const paths = registrationPaths(entry.handler)
      if (!paths.some(path => found.has(path))) {
        continue
      }
      if (!entry.route) {
        normalizeLegacyHandlerRoute(entry as { route?: string, middleware?: boolean, handler: string }, late)
      } else if (!paths.some(isUserServerCode)) {
        const base = widenLegacyHandlerRoute(entry, lateWidened)
        // the file is in scope, so its imports are rewritten either way; the wrapper is
        // what strips the base off the event, and only a widened handler needs it
        if (base && virtuals) {
          entry.handler = wrapHandlerFile(normalize(resolveAlias(entry.handler, aliases)), base, virtuals)
        }
      }
    }
    if (late.length > 0) {
      nitroBuildDiagnostics.NUXT_B9002({ count: late.length, handlers: late.map(handler => `\`${handler}\``).join('\n  - ') })
    }
    if (lateWidened.length > 0) {
      nitroBuildDiagnostics.NUXT_B9004({ count: lateWidened.length, handlers: lateWidened.join('\n  - ') })
    }
  }

  const virtualSources = new Map<string, string>()
  // a template function may wait on the nitro instance, which does not exist yet, so it
  // is rendered once nitro is available rather than here
  const deferredVirtuals: Array<[string, () => string | Promise<string>]> = []
  for (const [id, template] of Object.entries(nitroConfig.virtual)) {
    if (!files.has(id) || !isModuleVirtual(id)) {
      continue
    }
    if (typeof template === 'function') {
      deferredVirtuals.push([id, template])
    } else if (typeof template === 'string') {
      virtualSources.set(id, template)
    }
  }

  if (active) {
    activate(nitroConfig.plugins as string[])
  }
  rescan(nitroConfig.plugins as string[], nitroConfig.handlers, nitroConfig.virtual)

  // every module in the server build passes through here, so the answer is cached per id
  // and dropped whenever the scope grows
  const scopeCache = new Map<string, CompatScope | undefined>()
  const invalidateScopeCache = (id?: string) => {
    if (id === undefined) {
      scopeCache.clear()
    } else {
      scopeCache.delete(id)
    }
  }

  const scopeFor = (id: string | undefined): CompatScope | undefined => {
    if (!id) {
      return
    }
    if (scopeCache.has(id)) {
      return scopeCache.get(id)
    }

    const path = normalize(id.replace(/\?.*$/, ''))
    if (unusedFiles.has(path)) {
      scopeCache.set(id, undefined)
      return
    }
    let scope = files.get(path)
    if (!scope) {
      // the extra syscall is limited to ids that could be reached through a symlink
      const candidates = path.includes('node_modules/') && toRealPath(path) !== path ? [path, toRealPath(path)] : [path]
      for (const candidate of candidates) {
        for (const [prefix, dirScope] of dirs) {
          // a nested `node_modules` is a dependency of the module, not the module
          if (candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes('node_modules/')) {
            scope = dirScope
            break
          }
        }
        if (scope) {
          break
        }
      }
    }

    scopeCache.set(id, scope)
    return scope
  }

  // modules pushing straight into `nitro.options` from `nitro:init` are too late for the
  // pass above, but the transform only consults the scope at build time
  const registerLateScope = (nitro: { options: NitroOptions }) => {
    for (const handler of nitro.options.handlers || []) {
      const entry = handler as { handler?: unknown }
      if (isMigrated(serverApiOf(entry)) || typeof entry.handler !== 'string') {
        continue
      }
      const target = normalize(resolveAlias(entry.handler, aliases))
      if (!files.has(target)) {
        addModuleScope(entry.handler)
        invalidateScopeCache()
      }
    }

    for (const plugin of nitro.options.plugins || []) {
      if (typeof plugin !== 'string') {
        continue
      }
      const target = normalize(resolveAlias(plugin, aliases))
      if (!files.has(target) && !isV3Plugin(plugin)) {
        addModuleScope(plugin)
      }
      invalidateScopeCache()
    }

    rescan(nitro.options.plugins as string[], nitro.options.handlers, nitro.options.virtual)
    invalidateScopeCache()

    // a template may equally await an event that first fires inside `buildNuxt`, such
    // as `pages:resolved`: rendering it here deadlocks, because `buildNuxt` runs only
    // after `nuxt.ready()` — the step that invokes this — resolves. Rendered once the
    // app is generated instead, still ahead of the nitro build, so the rescan below
    // fills `virtualSources` in before the scope is read.
    let rendered = false
    nuxt.hook('build:done', async () => {
      if (rendered) {
        return
      }
      rendered = true
      for (const [id, template] of deferredVirtuals.splice(0)) {
        try {
          const code = await trackPendingTemplate(id, template)
          if (typeof code === 'string') {
            virtualSources.set(id, code)
          }
        } catch {
          // reported by the bundler when it renders the template itself
        }
      }
      rescan(nitro.options.plugins as string[], nitro.options.handlers, nitro.options.virtual)
      invalidateScopeCache()
    })
  }

  // baked in at build time, so that an app with no v2 code keeps Nitro's error semantics
  // with the recovery branch tree-shaken out. One flag for the whole app, decided by what
  // the scoped code imports rather than by which modules are installed.
  nitroConfig.virtual['#nuxt-compat/flags'] = () =>
    `export const legacyCompat = ${active}\n`

  // module dists built for nitro v2 dereference `globalThis._importMeta_`
  nitroConfig.virtual['#nuxt-compat/import-meta'] = () => {
    const serverDir = (nuxt as Nuxt & { _nitro?: { options?: { output?: { serverDir?: string } } } })._nitro?.options?.output?.serverDir
    const entry = serverDir ? pathToFileURL(resolve(serverDir, 'index.mjs')).href : undefined
    return `export const entryURL = ${entry ? JSON.stringify(entry) : 'import.meta.url'}\n`
  }

  // `#imports` in module code keeps resolving to the server auto-import registry, which no
  // longer carries the v2 names; those are exported first so they win over the portable ones
  const importsBarrel = '#nuxt-compat/imports'
  nitroConfig.virtual[importsBarrel] = [
    ...renderPresetReExports(modulePresets),
    ...nitroConfig.imports ? [`export * from '#imports'`] : [],
  ].join('\n')

  // nitro's own auto-import pass skips `node_modules` and follows the `nitroLegacy`
  // toggles, while module code needs the v2 names either way; injecting from inside the
  // transform keeps late-registered scope working
  const unimport = createUnimport({ presets: modulePresets })
  await unimport.init()

  const plugin = createLegacyResolvePlugin(
    id => active ? scopeFor(id) : undefined,
    getNitroPackageResolutions(),
    (id, scope) => {
      files.set(id, scope)
      invalidateScopeCache()
    },
    invalidateScopeCache,
    importsBarrel,
    unimport,
  )

  nitroConfig.rollupConfig ||= {}
  nitroConfig.rollupConfig.plugins = toArray(nitroConfig.rollupConfig.plugins || [])
  nitroConfig.rollupConfig.plugins.unshift(plugin as any)

  if (nuxt.options.experimental.nitroViteEnvironment) {
    nuxt.options.vite.plugins ||= []
    nuxt.options.vite.plugins.push({
      ...plugin,
      applyToEnvironment: (environment: { name: string }) => environment.name === 'nitro',
    } as any)
  }

  return registerLateScope
}

/** Nitro v3 requires a `route`; a v2 handler without one was a global middleware. */
function normalizeLegacyHandlerRoute (handler: { route?: string, middleware?: boolean, handler: string }, unrouted: string[]) {
  if (!handler.route) {
    unrouted.push(handler.handler)
    handler.route = '/**'
    handler.middleware = true
  }
}

const PLAIN_ROUTE_RE = /^[^:*]+$/

/**
 * Nitro v2 mounted routed middleware with `app.use(route)`, so it ran for every path below
 * its route and saw the route stripped from `event.path`. Nitro v3 matches routed
 * middleware exactly, through the same router as a route handler, and strips nothing. The
 * wildcard route matches the base path as well, so one registration covers both; the base
 * it was mounted at is returned for the wrapper to strip.
 *
 * A routed handler that is not middleware needs none of this: nitro v2 registered it on
 * the h3 router, which matched it exactly too.
 */
function widenLegacyHandlerRoute (handler: { route?: string, middleware?: boolean }, widened: string[]): string | undefined {
  const route = handler.route
  if (!route || !handler.middleware || !PLAIN_ROUTE_RE.test(route)) {
    return
  }
  const base = route.replace(/\/+$/, '')
  // `/` and `/**` are global middleware, which nitro v3 runs for every path already
  if (!base || base === '/') {
    return
  }
  handler.route = `${base}/**`
  widened.push(`\`${route}\` as \`${handler.route}\``)
  return base
}

interface ResolvePluginContext {
  resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string, external?: boolean | 'absolute' | 'relative' } | null>
}

function createLegacyResolvePlugin (
  scopeFor: (id: string | undefined) => CompatScope | undefined,
  nitroResolutions: Record<string, string>,
  addFile: (id: string, scope: CompatScope) => void,
  invalidateScope: (id?: string) => void,
  importsBarrel: string,
  unimport: Unimport,
) {
  const h3Shim = compatRuntimePath('h3-v1')
  const nitroShim = compatRuntimePath('nitro-v2')
  const migratedFiles = new Map<string, boolean>()

  /**
   * A file importing from `nitro/*` keeps v3 semantics: no h3 shim, no v2 auto-imports.
   * Decided per file, because a module mid-migration has files of both kinds.
   */
  const isMigrated = (id: string, specifiers: ImportSpecifier[]) => {
    let migrated = migratedFiles.get(id)
    if (migrated === undefined) {
      // the lexed specifiers, never the raw source: a comment mentioning `nitro/h3` must
      // not strip a v2 file of its compat layer
      migrated = specifiers.some(specifier => MIGRATED_SPECIFIER_RE.test(specifier.value))
      migratedFiles.set(id, migrated)
    }
    return migrated
  }

  const mapSpecifier = (source: string, scope: CompatScope) => {
    if (scope.h3 && (source === 'h3' || source === 'h3/utils')) {
      return h3Shim
    }
    if (scope.specifiers && NITRO_V2_SPECIFIER_RE.test(source)) {
      return nitroShim
    }
  }

  return {
    name: 'nuxt:nitro-v2-compat',
    // a dev session reuses the plugin instance across rebuilds, and files migrate
    buildStart () {
      migratedFiles.clear()
      clearRealPathCache()
    },
    watchChange (id: string) {
      migratedFiles.delete(id)
      clearRealPathCache(id)
      invalidateScope(id)
    },
    // `enforce` orders the plugin for Vite, `order` for rollup and rolldown; both are
    // needed so that the legacy auto-imports beat nitro's own pass on either build path
    enforce: 'pre' as const,
    resolveId: { order: 'pre' as const, async handler (this: ResolvePluginContext, source: string, importer?: string) {
      // module code written against nitro cannot always reach it: fill that in, but only
      // once the bundler has had its own go, so nitro keeps resolving itself
      if (source === 'nitro' || source.startsWith('nitro/')) {
        const fallback = nitroResolutions[source]
        if (fallback && !await this.resolve(source, importer, { skipSelf: true })) {
          return fallback
        }
        return
      }

      const scope = scopeFor(importer)
      if (!scope) {
        return
      }

      const mapped = mapSpecifier(source, scope)
      if (mapped) {
        return mapped
      }

      // keep module-local imports of a v2 entry in scope
      if (source[0] === '.') {
        const resolved = await this.resolve(source, importer, { skipSelf: true })
        if (resolved?.id && !resolved.external) {
          addFile(normalize(resolved.id.replace(/\?.*$/, '')), scope)
        }
        return resolved
      }
    } },
    // the bundler resolves nitro v2 specifiers itself (`nitropack` is often installed, and
    // `resolveId` order is not guaranteed once Nitro hands the plugin to Vite), so they are
    // rewritten in the source too
    transform: { order: 'pre' as const, async handler (code: string, id: string) {
      // cheapest checks first, so that files outside the v2 scope are never scanned
      const scope = scopeFor(id)
      if (!scope) {
        return
      }

      if (!scope.imports && !SPECIFIER_HINT_RE.test(code)) {
        return
      }

      const specifiers = findImportSpecifiers(code)
      const migrated = isMigrated(id, specifiers)
      const wantsImports = scope.imports && !migrated

      // Unimport edits the same original offsets, so both passes share one `MagicString`
      const injected = wantsImports && TRANSFORMABLE_RE.test(id) ? await unimport.injectImports(code, id) : undefined
      const source = injected?.s ?? new MagicString(code)
      let changed = !!injected?.imports.length
      for (const specifier of specifiers) {
        // the server `#imports` registry has the portable names, not the v2 ones
        const mapped = scope.imports && specifier.value === '#imports'
          ? importsBarrel
          : mapSpecifier(specifier.value, migrated ? { ...scope, h3: false } : scope)
        if (!mapped) {
          continue
        }
        source.overwrite(specifier.start, specifier.end, mapped)
        changed = true
      }

      if (changed) {
        return { code: source.toString(), map: source.generateMap({ hires: true, source: id }) }
      }
    } },
  }
}
