import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { ScopeTracker, walk } from 'oxc-walker'
import type { ScopeTrackerNode } from 'oxc-walker'
import type { ESTree } from 'rolldown/utils'
import { normalize } from 'pathe'
import { unpackMeta } from 'unhead/utils'
import type { SerializableHead } from '@unhead/vue/types'
import type { SFCBlock } from 'vue/compiler-sfc'

import { parseModuleId } from '../../core/utils/index.ts'
import { parseModule } from '../../core/utils/parse.ts'
import { findOptionsApiSetupBody, getStaticPropertyKey, unwrapStaticExpression } from '../../core/utils/parse-utils.ts'

type HeadComposable = 'useHead' | 'useSeoMeta'

const HEAD_COMPOSABLES = new Set<string>(['useHead', 'useSeoMeta'])
const HEAD_SOURCES = new Set(['#app', 'nuxt/app', '#app/composables/head', '@unhead/vue'])
const HEAD_COMPOSABLE_RE = /\buse(?:Head|SeoMeta)\b/
const SCRIPT_LANGS = new Set(['js', 'jsx', 'ts', 'tsx'])

const SCRIPT_SETUP_MACROS = new Set(['defineProps', 'defineEmits', 'defineOptions', 'defineSlots', 'defineExpose', 'defineModel', 'definePageMeta', 'withDefaults'])
const SIDE_EFFECT_NODES = new Set([
  'AssignmentExpression',
  'AwaitExpression',
  'CallExpression',
  'ChainExpression',
  'ClassBody',
  'ImportExpression',
  'MemberExpression',
  'NewExpression',
  'SpreadElement',
  'TaggedTemplateExpression',
  'UpdateExpression',
  'YieldExpression',
])
const INERT_STATEMENTS = new Set([
  'EmptyStatement',
  'FunctionDeclaration',
  'ImportDeclaration',
  'TSDeclareFunction',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
])

/** Head input set by the app component with statically known values. */
export interface AppComponentHead {
  /** The input of each hoisted call, in call order. */
  entries: SerializableHead[]
  /** Offsets of the hoisted statements in the source. */
  statements: Array<[start: number, end: number]>
}

const NOT_STATIC = Symbol('not static')

function toStaticValue (node: ESTree.Node | null | undefined): unknown {
  node = unwrapStaticExpression(node ?? undefined)
  switch (node?.type) {
    case 'Literal': {
      if ('regex' in node && node.regex) { return NOT_STATIC }
      const value = node.value
      return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : NOT_STATIC
    }
    case 'TemplateLiteral':
      return node.expressions.length === 0 && typeof node.quasis[0]?.value.cooked === 'string' ? node.quasis[0].value.cooked : NOT_STATIC
    case 'UnaryExpression': {
      const argument = node.argument
      if ((node.operator === '-' || node.operator === '+') && argument.type === 'Literal' && typeof argument.value === 'number') {
        return node.operator === '-' ? -argument.value : argument.value
      }
      return NOT_STATIC
    }
    case 'ArrayExpression': {
      const values: unknown[] = []
      for (const element of node.elements) {
        if (!element || element.type === 'SpreadElement') { return NOT_STATIC }
        const value = toStaticValue(element)
        if (value === NOT_STATIC) { return NOT_STATIC }
        values.push(value)
      }
      return values
    }
    case 'ObjectExpression': {
      const object: Record<string, unknown> = {}
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.kind !== 'init' || property.method || property.computed) { return NOT_STATIC }
        const key = getStaticPropertyKey(property)
        if (key === undefined || key === '__proto__') { return NOT_STATIC }
        const value = toStaticValue(property.value)
        if (value === NOT_STATIC) { return NOT_STATIC }
        object[key] = value
      }
      return object
    }
  }
  return NOT_STATIC
}

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isMacroCall (node: ESTree.Node): boolean {
  return node.type === 'CallExpression' && node.callee.type === 'Identifier' && SCRIPT_SETUP_MACROS.has(node.callee.name)
}

function hasSideEffects (node: ESTree.Node | null | undefined, allowMacros = false): boolean {
  if (!node) { return false }
  let found = false
  walk(node, {
    enter (child) {
      if (found || child.type === 'FunctionExpression' || child.type === 'ArrowFunctionExpression') {
        this.skip()
        return
      }
      if (allowMacros && isMacroCall(child)) { return }
      if (SIDE_EFFECT_NODES.has(child.type) || (child.type === 'UnaryExpression' && child.operator === 'delete')) {
        found = true
      }
    },
  })
  return found
}

function getCallExpression (statement: ESTree.Node): ESTree.CallExpression | undefined {
  if (statement.type !== 'ExpressionStatement') { return }
  const expression = unwrapStaticExpression(statement.expression)
  return expression?.type === 'CallExpression' ? expression : undefined
}

function getCalleeName (call: ESTree.CallExpression): string | undefined {
  return call.callee.type === 'Identifier' ? call.callee.name : undefined
}

function isInertMacroCall (node: ESTree.Node | null | undefined): boolean {
  const call = unwrapStaticExpression(node ?? undefined)
  return !!call && isMacroCall(call) && !hasSideEffects(call, true)
}

function isInertStatement (statement: ESTree.Node, isScriptSetup: boolean): boolean {
  if (INERT_STATEMENTS.has(statement.type)) { return true }
  if (statement.type === 'ExportNamedDeclaration') { return statement.exportKind === 'type' }
  if (statement.type === 'VariableDeclaration') {
    return !statement.declare && statement.declarations.every(({ id, init }) => {
      if (isScriptSetup && isInertMacroCall(init)) { return !hasSideEffects(id) }
      return id.type === 'Identifier' && (!init || init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression' || toStaticValue(init) !== NOT_STATIC)
    })
  }
  return isScriptSetup && statement.type === 'ExpressionStatement' && isInertMacroCall(statement.expression)
}

function toHeadInput (composable: HeadComposable, input: Record<string, unknown>): SerializableHead {
  if (composable === 'useHead') {
    return input as SerializableHead
  }
  const { title, titleTemplate, ...meta } = input
  const head: Record<string, unknown> = {}
  if (title !== undefined) { head.title = title }
  if (titleTemplate !== undefined) { head.titleTemplate = titleTemplate }
  const tags = unpackMeta(meta)
  if (tags.length) { head.meta = tags }
  return head as SerializableHead
}

export interface AppComponentHeadImports {
  /** Names exported by `#imports` that refer to Nuxt's head composables, mapped to the composable. */
  imports: ReadonlyMap<string, string>
  /** Whether names a component does not declare are auto-imported from `#imports`. */
  autoImport: boolean
}

function resolveImportsName (name: string, { imports }: AppComponentHeadImports): HeadComposable | undefined {
  const composable = imports.get(name)
  return composable && HEAD_COMPOSABLES.has(composable) ? composable as HeadComposable : undefined
}

function resolveImportedComposable (declaration: ScopeTrackerNode, headImports: AppComponentHeadImports): HeadComposable | undefined {
  if (declaration.type !== 'Import') { return }
  const { node, importNode } = declaration
  if (importNode.importKind === 'type' || node.type !== 'ImportSpecifier' || node.importKind === 'type') { return }
  const imported = node.imported.type === 'Identifier' ? node.imported.name : String(node.imported.value)
  const source = String(importNode.source.value)
  if (source === '#imports') {
    return resolveImportsName(imported, headImports)
  }
  if (HEAD_SOURCES.has(source) && HEAD_COMPOSABLES.has(imported)) {
    return imported as HeadComposable
  }
}

function createComposableResolver (program: ESTree.Program, body: ESTree.Node[], headImports: AppComponentHeadImports, fallback: (name: string) => HeadComposable | undefined) {
  const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })
  walk(program, { scopeTracker })
  scopeTracker.freeze()

  const declarations = new Map<string, ScopeTrackerNode | null>()
  const first = body[0]
  const names = new Set(body.map(statement => getCallExpression(statement)).flatMap(call => call ? [getCalleeName(call)].filter(Boolean) as string[] : []))
  walk(program, {
    scopeTracker,
    enter (node) {
      if (node !== first) { return }
      for (const name of names) {
        declarations.set(name, scopeTracker.getDeclaration(name, { mode: 'all' }))
      }
      this.skip()
    },
  })

  return (name: string): HeadComposable | undefined => {
    const declaration = declarations.get(name)
    return declaration ? resolveImportedComposable(declaration, headImports) : fallback(name)
  }
}

interface SetupScope {
  program: ESTree.Program
  body: ESTree.Node[]
  offset: number
  isScriptSetup: boolean
  fallback: (name: string) => HeadComposable | undefined
}

function parseScriptBlock (block: SFCBlock) {
  const lang = block.lang && SCRIPT_LANGS.has(block.lang) ? block.lang : 'js'
  return parseModule(block.content, `script.${lang}`).program
}

async function findSetupScope (code: string, id: string, headImports: AppComponentHeadImports): Promise<SetupScope | undefined> {
  const autoImported = (name: string) => headImports.autoImport ? resolveImportsName(name, headImports) : undefined

  if (!parseModuleId(id).pathname.endsWith('.vue')) {
    const { program } = parseModule(code, id)
    const body = findOptionsApiSetupBody(program, { exclusive: true })
    return body && { program, body, offset: 0, isScriptSetup: false, fallback: autoImported }
  }

  const { parse } = await import('vue/compiler-sfc')
  const { descriptor, errors } = parse(code, { filename: id, sourceMap: false })
  const { script: scriptBlock, scriptSetup: setupBlock } = descriptor
  if (errors.length || scriptBlock?.src || setupBlock?.src) { return }

  if (!setupBlock) {
    if (!scriptBlock) { return }
    const program = parseScriptBlock(scriptBlock)
    const body = findOptionsApiSetupBody(program, { exclusive: true })
    return body && { program, body, offset: scriptBlock.loc.start.offset, isScriptSetup: false, fallback: autoImported }
  }

  const program = parseScriptBlock(setupBlock)
  let fallback = autoImported
  if (scriptBlock) {
    const scriptTracker = new ScopeTracker({ preserveExitedScopes: true })
    walk(parseScriptBlock(scriptBlock), { scopeTracker: scriptTracker })
    scriptTracker.freeze()
    fallback = (name) => {
      const declaration = scriptTracker.getDeclaration(name, { mode: 'all' })
      return declaration ? resolveImportedComposable(declaration, headImports) : autoImported(name)
    }
  }
  return { program, body: program.body, offset: setupBlock.loc.start.offset, isScriptSetup: true, fallback }
}

/**
 * Find the leading `useHead` and `useSeoMeta` calls in the setup of an app component whose
 * input is fully static.
 *
 * Only top-level statements of `<script setup>` (or of an Options API `setup()`) are
 * considered, and collection stops at the first statement that could run code, so that no
 * other head entry of the component is pushed before a hoisted one.
 */
export async function extractAppComponentHead (code: string, id: string, headImports: AppComponentHeadImports): Promise<AppComponentHead> {
  const result: AppComponentHead = { entries: [], statements: [] }
  if (!HEAD_COMPOSABLE_RE.test(code)) { return result }

  const scope = await findSetupScope(code, id, headImports)
  if (!scope?.body.length) { return result }

  const resolve = createComposableResolver(scope.program, scope.body, headImports, scope.fallback)

  for (const statement of scope.body) {
    const call = getCallExpression(statement)
    const name = call && getCalleeName(call)
    const composable = name ? resolve(name) : undefined
    if (!composable) {
      if (isInertStatement(statement, scope.isScriptSetup)) { continue }
      break
    }
    if (call!.arguments.length !== 1) { break }
    const input = toStaticValue(call!.arguments[0])
    if (!isPlainObject(input)) { break }
    result.entries.push(toHeadInput(composable, input))
    result.statements.push([scope.offset + statement.start, scope.offset + statement.end])
  }

  return result
}

interface AppComponentHeadPluginOptions {
  /** The app component to hoist head input from, if hoisting is enabled. */
  getAppComponent: () => string | null | undefined
  getImports: () => Promise<AppComponentHeadImports>
}

/**
 * Removes the calls whose input {@link extractAppComponentHead} hoists out of the app component.
 */
export const AppComponentHeadPlugin = (options: AppComponentHeadPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:head:app-component-head',
    enforce: 'pre',
    transform: {
      filter: {
        code: { include: HEAD_COMPOSABLE_RE },
      },
      async handler (code, id, meta?: unknown) {
        const component = options.getAppComponent()
        const { pathname } = parseModuleId(id)
        if (!component || normalize(pathname) !== normalize(component)) { return }

        const { statements } = await extractAppComponentHead(code, pathname, await options.getImports())
        if (!statements.length) { return }

        const s = rolldownString(code, id, meta)
        for (const [start, end] of statements) {
          s.overwrite(start, end, ';')
        }
        return generateTransform(s, id)
      },
    },
  }
})
