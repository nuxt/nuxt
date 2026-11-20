import { promises as fs, realpathSync } from 'node:fs'
import type { Component } from '@nuxt/schema'
import { resolveFiles } from '@nuxt/kit'
import { type SFCScriptBlock, compileScript, parse as parseSfc } from '@vue/compiler-sfc'
import {
  type DirectiveNode,
  NodeTypes,
  type TemplateChildNode,
  parse as parseTemplate,
} from '@vue/compiler-dom'
import { camelize, capitalize, hyphenate } from '@vue/shared'
import { dirname, isAbsolute, normalize, relative, resolve } from 'pathe'

/**
 * Module and export a `v-load-client` tag resolves to.
 */
export interface ScannedImport {
  /**
   * File the component is imported from, an absolute path or a specifier the bundler resolves.
   */
  path: string
  export: string
  /**
   * Mounts the component on the client instead of hydrating it. Set for a `Foo.client.vue`
   * whose `Foo.server.vue` renders on the server.
   */
  mount?: boolean
}

export interface ScanSfcOptions {
  /**
   * Vite root, used to shorten file paths in warnings.
   */
  root: string
  /**
   * Components available without a static import, such as Nuxt auto-imports, by PascalCase name.
   */
  additionalImports: ReadonlyMap<string, ScannedImport>
  /**
   * Files that never load on the client, as absolute paths or specifiers the bundler resolves.
   */
  serverOnlyFiles: ReadonlySet<string>
  /**
   * Bundler resolver, so aliased and package imports resolve as they do in the build.
   */
  resolveImport?: (source: string, importer: string) => Promise<string | null | undefined>
  /**
   * Receives each `v-load-client` target of an SFC, by the tag as written in its template.
   */
  registerTarget: (sfcFile: string, tag: string, target: ScannedImport) => void
  warn: (message: string) => void
}

/**
 * `v-load-client` lookup data derived from the Nuxt component registry.
 */
export interface ComponentIndex {
  /**
   * Implementation each component name resolves to, preferring one that can load on the client.
   */
  additionalImports: Map<string, ScannedImport>
  /**
   * Files of server-only components and of the server half of pairs.
   */
  serverOnlyFiles: Set<string>
}

type ScriptImports = NonNullable<SFCScriptBlock['imports']>

const MARKER = 'v-load-client'
// Relative to each scanned dir, so a layer living in `node_modules` is still scanned.
const NESTED_NODE_MODULES = ['**/node_modules/**']

/**
 * Register every `v-load-client` target in `files` before any environment builds,
 * so the client manifest is complete.
 */
export async function scanClientTargets (files: Iterable<string>, options: ScanSfcOptions): Promise<void> {
  await Promise.all(
    [...files].map(async file => scanSfcSource(await fs.readFile(file, 'utf8'), file, options)),
  )
}

/**
 * SFCs under `dirs`, deduplicated. `resolveFiles` drops the paths Nuxt ignores,
 * `ignore` option and `.nuxtignore` included.
 */
export async function collectSfcFiles (dirs: readonly string[]): Promise<Set<string>> {
  const files = await Promise.all(dirs.map(dir => resolveFiles(dir, '**/*.vue', { ignore: NESTED_NODE_MODULES })))
  return new Set(files.flat().map(normalize))
}

/**
 * Register the `v-load-client` targets of one SFC source.
 */
export async function scanSfcSource (source: string, filePath: string, options: ScanSfcOptions): Promise<void> {
  if (!source.includes(MARKER)) { return }

  const { descriptor, errors } = parseSfc(source, { filename: filePath, sourceMap: false })
  // Malformed SFCs are reported by the Vue transform, not by the scan.
  if (errors.length > 0 || !descriptor.template) { return }

  const marked = findMarkedTags(descriptor.template.content)
  if (marked.length === 0) { return }

  const { root, additionalImports, serverOnlyFiles, resolveImport, registerTarget, warn } = options
  let scriptImports: ScriptImports | undefined
  if (descriptor.scriptSetup || descriptor.script) {
    try {
      scriptImports = compileScript(descriptor, { id: filePath }).imports
    } catch {
      // Script compile errors are reported by the Vue transform, not by the scan.
    }
  }

  const resolve = (source: string) => resolveSource(source, filePath, resolveImport)
  const importMap = await buildImportMap(scriptImports, resolve)
  const sfcFile = normalize(filePath)
  const relFile = relative(root, filePath)
  for (const tag of new Set(marked)) {
    if (tag === 'component' || tag === 'Component') {
      warn(`[nuxt] [islands] ${relFile}: <component :is> with v-load-client cannot be scanned, so its targets have no client chunk and render without markers.`)
      continue
    }

    const target = await lookupTag(tag, importMap, additionalImports, resolve)
    if (!target) {
      warn(`[nuxt] [islands] ${relFile}: cannot resolve v-load-client target "${tag}" through the file's <script> imports or auto-imported components; it has no client chunk.`)
    } else if (await isServerOnly(target.path, serverOnlyFiles, resolve)) {
      warn(`[nuxt] [islands] ${relFile}: v-load-client target "${tag}" is a server-only component, which cannot load on the client; it has no client chunk and renders without markers.`)
    } else {
      registerTarget(sfcFile, tag, target)
    }
  }
}

/**
 * Index Nuxt components for `v-load-client`. Each name maps to its `.client.vue` file, else its
 * universal one, else its server one, which the scan then refuses through `serverOnlyFiles`.
 */
export function indexComponents (components: Iterable<Component>): ComponentIndex {
  const additionalImports = new Map<string, ScannedImport>()
  const ranks = new Map<string, number>()
  const serverOnlyFiles = new Set<string>()
  const serverNames = new Set<string>()
  for (const component of components) {
    // `_raw` server entries are the placeholders Nuxt registers for client-only components.
    if (!component.filePath || component._raw) { continue }
    const serverOnly = component.island || component.mode === 'server'
    if (serverOnly) {
      for (const file of filePathVariants(component.filePath)) { serverOnlyFiles.add(file) }
      if (component.pascalName) { serverNames.add(component.pascalName) }
    }
    if (!component.pascalName) { continue }
    const rank = serverOnly ? 2 : component.mode === 'client' ? 0 : 1
    if (rank >= (ranks.get(component.pascalName) ?? Infinity)) { continue }
    ranks.set(component.pascalName, rank)
    additionalImports.set(component.pascalName, { path: component.filePath, export: component.export || 'default' })
  }
  // A client file whose name also has a server file is mounted over the server file's HTML.
  for (const [name, target] of additionalImports) {
    if (ranks.get(name) === 0 && serverNames.has(name)) { target.mount = true }
  }
  return { additionalImports, serverOnlyFiles }
}

/**
 * Casings Vue's `resolveComponent` tries for a template tag:
 * as written, PascalCase, camelCase and kebab-case.
 */
function tagCasings (tag: string): [string, string, string, string] {
  const camel = camelize(tag)
  return [tag, capitalize(camel), camel, hyphenate(tag)]
}

/**
 * Tags of every element with `v-load-client`, in template order: `Counter` for both
 * `<Counter v-load-client />` and `<Counter v-load-client="enabled" />`.
 */
function findMarkedTags (template: string): string[] {
  const tags: string[] = []
  const visit = (nodes: TemplateChildNode[]): void => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) { continue }
      const hasMarker = node.props.some(
        (p): p is DirectiveNode => p.type === NodeTypes.DIRECTIVE && p.name === 'load-client',
      )
      if (hasMarker) { tags.push(node.tag) }
      visit(node.children)
    }
  }
  visit(parseTemplate(template).children)
  return tags
}

/**
 * Map each local import name to the absolute file and export it imports,
 * e.g. `Foo` for `import Foo from './Foo.vue'`.
 */
async function buildImportMap (
  imports: ScriptImports | undefined,
  resolve: (source: string) => Promise<string | undefined>,
): Promise<Map<string, ScannedImport>> {
  const map = new Map<string, ScannedImport>()
  if (!imports) { return map }

  const resolved = new Map<string, string | undefined>()
  for (const binding of Object.values(imports)) {
    // Types are erased and a namespace object is never a component reference.
    if (binding.isType || binding.imported === '*') { continue }
    if (!resolved.has(binding.source)) {
      resolved.set(binding.source, await resolve(binding.source))
    }
    const filePath = resolved.get(binding.source)
    if (filePath) { map.set(binding.local, { path: filePath, export: binding.imported }) }
  }
  return map
}

async function resolveSource (
  source: string,
  importer: string,
  resolveImport: ScanSfcOptions['resolveImport'],
): Promise<string | undefined> {
  const resolved = (await resolveImport?.(source, importer))?.split('?')[0]
  if (resolved && isAbsolute(resolved)) { return normalize(resolved) }
  if (isAbsolute(source)) { return normalize(source) }
  if (source.startsWith('./') || source.startsWith('../')) {
    return resolve(dirname(importer), source)
  }
}

/**
 * Normalized path of a registered component file, plus its real path,
 * which is what the bundler resolves symlinked layers to.
 */
function filePathVariants (filePath: string): string[] {
  const path = filePath.split('?')[0]!
  if (!isAbsolute(path)) { return [path] }
  try {
    return [normalize(path), normalize(realpathSync(path))]
  } catch {
    return [normalize(path)]
  }
}

async function isServerOnly (
  path: string,
  serverOnlyFiles: ReadonlySet<string>,
  resolve: (source: string) => Promise<string | undefined>,
): Promise<boolean> {
  path = path.split('?')[0]!
  if (serverOnlyFiles.has(path)) { return true }
  // Components registered by a package specifier only match once resolved.
  for (const file of serverOnlyFiles) {
    if (!isAbsolute(file) && await resolve(file) === path) { return true }
  }
  return false
}

async function lookupTag (
  tag: string,
  importMap: Map<string, ScannedImport>,
  additionalImports: ReadonlyMap<string, ScannedImport>,
  resolve: (source: string) => Promise<string | undefined>,
): Promise<ScannedImport | undefined> {
  for (const key of tagCasings(tag)) {
    const fromImportMap = importMap.get(key)
    if (fromImportMap) { return fromImportMap }
    const fromAdditional = additionalImports.get(key)
    if (fromAdditional) {
      // The server build resolves a client-only file to its placeholder,
      // so absolute registry paths are kept as is.
      const filePath = isAbsolute(fromAdditional.path) ? normalize(fromAdditional.path) : await resolve(fromAdditional.path)
      return filePath ? { ...fromAdditional, path: filePath } : undefined
    }
  }
}
