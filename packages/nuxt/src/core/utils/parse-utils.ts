import type { ESTree } from 'rolldown/utils'
import type { ParsedStaticImport } from './static-imports.ts'
import { resolveAlias } from '@nuxt/kit'

import { stripExtension } from '../../utils.ts'

/**
 * Map the bindings introduced by `imports` to their origin. Sources have aliases resolved and
 * extensions stripped.
 */
export function processImports (imports: ParsedStaticImport[], alias: Record<string, string>) {
  /** local name -> imported name and source */
  const directImports = new Map<string, { originalName: string, source: string }>()
  /** source -> local names of its default and namespace imports */
  const namespaces = new Map<string, { namespaces: Set<string> }>()

  for (const i of imports) {
    const source = stripExtension(resolveAlias(i.specifier, alias))

    for (const [originalName, localName] of Object.entries(i.namedImports ?? {})) {
      directImports.set(localName || originalName, { originalName, source })
    }

    if (i.defaultImport) {
      directImports.set(i.defaultImport, { originalName: 'default', source })
    }

    for (const name of [i.defaultImport, i.namespacedImport]) {
      if (!name) { continue }
      let entry = namespaces.get(source)
      if (!entry) {
        entry = { namespaces: new Set() }
        namespaces.set(source, entry)
      }
      entry.namespaces.add(name)
    }
  }

  return {
    directImports,
    namespaces,
  }
}

export interface FunctionCallMetadata {
  name: string
  /**
   * The name of the single-level namespace (object) the function belongs to,
   * or null if it's a top-level function.
   *
   * @example
   * foo()        //-> null
   * foo.bar()    //-> 'foo'
   * (foo.bar)()  //-> 'foo'
   * foo['bar']() //-> 'foo'
   */
  namespace: string | null
  /**
   * The callee node representing the function being called
   * or the property being accessed in case of a member expression.
   *
   * @example
   * foo()        //-> Identifier node for `foo`
   * foo.bar()    //-> Identifier node for `bar`
   * (foo.bar)()  //-> Parenthesized Expression node for `foo.bar`
   * foo['bar']() //-> Member Expression node for `foo['bar']`
   */
  node: ESTree.IdentifierReference | ESTree.MemberExpression | ESTree.ParenthesizedExpression
  callExpression: ESTree.CallExpression
}

/** `(foo)`, `(foo as any)`, `(<any>foo)` and `(foo!)` -> `foo` */
function unwrapParenthesized (node: ESTree.Expression): ESTree.Expression {
  if (node.type !== 'ParenthesizedExpression') { return node }
  const inner = node.expression
  return inner.type === 'TSAsExpression' || inner.type === 'TSTypeAssertion' || inner.type === 'TSNonNullExpression'
    ? inner.expression
    : inner
}

function parseStaticMemberExpression (member: ESTree.MemberExpression, filter: RegExp): Omit<FunctionCallMetadata, 'callExpression'> | null {
  const object = unwrapParenthesized(member.object)
  if (object.type !== 'Identifier') { return null }

  // foo.bar()
  if (member.property.type === 'Identifier' && filter.test(member.property.name)) {
    return { name: member.property.name, namespace: object.name, node: member.property }
  }

  // foo['bar']()
  if (member.property.type === 'Literal' && typeof member.property.value === 'string' && filter.test(member.property.value)) {
    return { name: member.property.value, namespace: object.name, node: member }
  }

  return null
}

/**
 * Checks if a node is a statically analyzable function call matching the given filter and returns parsed metadata about it.
 *
 * This is meant to statically identify functions and their origin in combination with scope tracking & imports analysis.
 * @param node The AST node to check.
 * @param filter A regular expression to match the function name.
 * @returns An object containing the metadata about the function call, or null if it doesn't match.
 */
export function parseStaticFunctionCall (node: ESTree.CallExpression | ESTree.ChainExpression, filter: RegExp): FunctionCallMetadata | null {
  const callExpression = node.type === 'CallExpression'
    ? node
    : node.expression.type === 'CallExpression' ? node.expression : null
  if (!callExpression) { return null }

  const callee = callExpression.callee
  const inner = unwrapParenthesized(callee)

  if (inner.type === 'Identifier') {
    return filter.test(inner.name)
      ? { name: inner.name, namespace: null, node: callee as FunctionCallMetadata['node'], callExpression }
      : null
  }

  if (inner.type === 'MemberExpression') {
    const member = parseStaticMemberExpression(inner, filter)
    if (member) {
      return { ...member, ...callee !== inner && { node: callee as ESTree.ParenthesizedExpression }, callExpression }
    }
  }

  return null
}

export interface ExportMetadata {
  localName: string
  exportedName: string
}

/**
 * Parses static export declarations to extract local and exported identifiers.
 * Considers only runtime value exports (not types).
 *
 * Doesn't handle barrel exports, destructured exports, literals in export names, etc.
 *
 * @example
 * ```ts
 * export const foo = 1 // { localName: 'foo', exportedName: 'foo' }
 * export function bar() {} // { localName: 'bar', exportedName: 'bar' }
 * export class Baz {} // { localName: 'Baz', exportedName: 'Baz' }
 * export { foo } // { localName: 'foo', exportedName: 'foo' }
 * export { foo as bar } // { localName: 'foo', exportedName: 'bar' }
 * export default function foo() {} // { localName: 'foo', exportedName: 'default' }
 * export default class Bar {} // { localName: 'Bar', exportedName: 'default' }
 * ```
 * @param node the export declaration node to parse
 * @param filter optional regex to filter named exports by their exported names
 */
export function parseStaticExportIdentifiers (node: ESTree.ExportNamedDeclaration | ESTree.ExportDefaultDeclaration | ESTree.TSExportAssignment, filter?: RegExp): ExportMetadata[] {
  const matches = (name: string) => !filter || filter.test(name)
  const named = (name: string | undefined): ExportMetadata[] => name && matches(name) ? [{ localName: name, exportedName: name }] : []

  if (node.type === 'ExportNamedDeclaration') {
    if (node.exportKind === 'type') { return [] }
    const declaration = node.declaration
    if (declaration?.type === 'VariableDeclaration') {
      return declaration.declarations.flatMap(d => d.id.type === 'Identifier' ? named(d.id.name) : [])
    }
    if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') {
      return named(declaration.id?.name)
    }
    return node.specifiers.flatMap(s => s.exported.type === 'Identifier' && s.exportKind !== 'type' && s.local.type === 'Identifier' && matches(s.exported.name)
      ? [{ localName: s.local.name, exportedName: s.exported.name }]
      : [])
  }

  if (node.type === 'ExportDefaultDeclaration') {
    if (node.exportKind && node.exportKind !== 'value') { return [] }
    const declaration = node.declaration
    const localName = declaration.type === 'Identifier'
      ? declaration.name
      : declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration' ? declaration.id?.name : undefined
    return localName ? [{ localName, exportedName: 'default' }] : []
  }

  // export = <identifier>
  if (node.expression.type === 'Identifier' && matches(node.expression.name)) {
    return [{ localName: node.expression.name, exportedName: 'default' }]
  }

  return []
}
