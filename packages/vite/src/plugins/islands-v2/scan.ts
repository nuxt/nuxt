import { promises as fs } from 'node:fs'
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
   * Bundler resolver so aliased and package imports resolve like in transform.
   */
  resolveImport?: (source: string, importer: string) => Promise<string | null | undefined>
  /**
   * Receives each `v-load-client` target of an SFC, by the tag as written in its template.
   */
  registerTarget: (sfcFile: string, tag: string, target: ScannedImport) => void
  warn: (message: string) => void
}

type ScriptImports = NonNullable<SFCScriptBlock['imports']>

const MARKER = 'v-load-client'
// Relative to each scanned dir, so a layer living in `node_modules` is still scanned.
const NESTED_NODE_MODULES = ['**/node_modules/**']

/**
 * buildStart pre-pass: register every `v-load-client` target of `files`
 * before any environment builds, so the client manifest is complete.
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
 * Register the `v-load-client` targets of one SFC source, as the pre-pass does for each file.
 */
export async function scanSfcSource (source: string, filePath: string, options: ScanSfcOptions): Promise<void> {
  if (!source.includes(MARKER)) { return }

  const { descriptor, errors } = parseSfc(source, { filename: filePath, sourceMap: false })
  // Malformed SFCs are reported by the real transform, not the pre-pass.
  if (errors.length > 0 || !descriptor.template) { return }

  const marked = findMarkedTags(descriptor.template.content)
  if (marked.length === 0) { return }

  const { root, additionalImports, resolveImport, registerTarget, warn } = options
  let scriptImports: ScriptImports | undefined
  if (descriptor.scriptSetup || descriptor.script) {
    try {
      scriptImports = compileScript(descriptor, { id: filePath }).imports
    } catch {
      // Script compile errors are reported by the real transform, not the pre-pass.
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
    if (target) {
      registerTarget(sfcFile, tag, target)
    } else {
      warn(`[nuxt] [islands] ${relFile}: cannot resolve v-load-client target "${tag}" through the file's <script> imports or auto-imported components; it has no client chunk.`)
    }
  }
}

/**
 * Casings Vue's `resolveComponent` tries for a template tag:
 * as written, PascalCase, camelCase and kebab-case.
 */
function tagCasings (tag: string):[string, string, string, string] {
  const camel = camelize(tag)
  return [tag, capitalize(camel), camel, hyphenate(tag)]
}

/**
 * Tags of every element carrying the marker, static or bound, in template order.
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
 * Local binding name to the absolute file path and export it imports.
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
      const filePath = await resolve(fromAdditional.path)
      return filePath ? { path: filePath, export: fromAdditional.export } : undefined
    }
  }
}
