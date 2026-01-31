import type { CallExpression, ChainExpression, ExportDefaultDeclaration, ExportNamedDeclaration, IdentifierReference, MemberExpression, ParenthesizedExpression, TSExportAssignment } from 'oxc-parser'
import type { ParsedStaticImport } from 'mlly'
import { resolveAlias } from '@nuxt/kit'

import { stripExtension } from '../../utils.ts'

export function processImports (imports: ParsedStaticImport[]) {
  /**
   * import alias -> original name; source with aliases resolved and without extension
   */
  const directImports = new Map<string, {
    originalName: string
    /**
     * import source with aliases resolved and without extension
     */
    source: string
  }>()

  /**
   * import source with aliases resolved and without extension -> set of namespaces from that source
   */
  const namespaces = new Map<string, {
    namespaces: Set<string>
  }>()

  for (const i of imports) {
    const resolvedSpecifier = stripExtension(resolveAlias(i.specifier))

    // handle named imports
    const namedImports = i.namedImports ?? {}

    for (const originalIdentifier in namedImports) {
      const localIdentifier = namedImports[originalIdentifier] || originalIdentifier
      directImports.set(localIdentifier, {
        originalName: originalIdentifier,
        source: resolvedSpecifier,
      })
    }

    if (i.namespacedImport || i.defaultImport) {
      if (!namespaces.has(resolvedSpecifier)) {
        namespaces.set(resolvedSpecifier, {
          namespaces: new Set(),
        })
      }
    }

    if (i.defaultImport) {
      // handle default import
      const namespace = i.defaultImport
      const entry = namespaces.get(resolvedSpecifier)!
      entry.namespaces.add(namespace)
      directImports.set(i.defaultImport, {
        originalName: 'default',
        source: resolvedSpecifier,
      })
    } else if (i.namespacedImport) {
      // handle namespace import
      const namespace = i.namespacedImport
      const entry = namespaces.get(resolvedSpecifier)!
      entry.namespaces.add(namespace)
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
  node: IdentifierReference | MemberExpression | ParenthesizedExpression
  callExpression: CallExpression
}

/**
 * Checks if a node is a statically analyzable function call matching the given filter and returns parsed metadata about it.
 *
 * This is meant to statically identify functions and their origin in combination with scope tracking & imports analysis.
 * @param node The AST node to check.
 * @param filter A regular expression to match the function name.
 * @returns An object containing the metadata about the function call, or null if it doesn't match.
 */
export function parseStaticFunctionCall (node: CallExpression | ChainExpression, filter: RegExp): FunctionCallMetadata | null {
  // unwrap call expression
  const callExpression = node.type === 'CallExpression'
    ? node
    : node.type === 'ChainExpression' && node.expression.type === 'CallExpression'
      ? node.expression
      : null
  if (!callExpression) { return null }

  // Simple function calls

  let functionName: string | undefined
  let identifierNode: FunctionCallMetadata['node'] | undefined
  // foo()
  if (callExpression.callee.type === 'Identifier') {
    functionName = callExpression.callee.name
    identifierNode = callExpression.callee
  // (<identifier>)()
  } else if (callExpression.callee.type === 'ParenthesizedExpression') {
    // (foo)()
    if (callExpression.callee.expression.type === 'Identifier') {
      functionName = callExpression.callee.expression.name
      identifierNode = callExpression.callee
    // (foo as any)()
    // (<any>foo)()
    // (foo!)()
    } else if (
      (
        callExpression.callee.expression.type === 'TSAsExpression'
        || callExpression.callee.expression.type === 'TSTypeAssertion'
        || callExpression.callee.expression.type === 'TSNonNullExpression'
      )
      && callExpression.callee.expression.expression.type === 'Identifier'
    ) {
      functionName = callExpression.callee.expression.expression.name
      identifierNode = callExpression.callee
    }
  }

  if (functionName && identifierNode && filter.test(functionName)) {
    return {
      name: functionName,
      namespace: null,
      node: identifierNode,
      callExpression,
    }
  }

  function getParsedMemberExpression (memberExpression: MemberExpression): Omit<FunctionCallMetadata, 'callExpression'> | null {
    // <object name>
    let memberObjectName: string | undefined
    // foo.bar()
    if (memberExpression.object.type === 'Identifier') {
      memberObjectName = memberExpression.object.name
      // (foo).bar()
    } else if (memberExpression.object.type === 'ParenthesizedExpression') {
      if (memberExpression.object.expression.type === 'Identifier') {
        memberObjectName = memberExpression.object.expression.name
      // (foo as any).bar()
      // (<any>foo).bar()
      // (foo!).bar()
      } else if (
        (
          memberExpression.object.expression.type === 'TSAsExpression'
          || memberExpression.object.expression.type === 'TSTypeAssertion'
          || memberExpression.object.expression.type === 'TSNonNullExpression'
        )
        && memberExpression.object.expression.expression.type === 'Identifier'
      ) {
        memberObjectName = memberExpression.object.expression.expression.name
      }
    }

    // <property name>
    if (memberObjectName) {
      // foo.bar()
      if (memberExpression.property.type === 'Identifier' && filter.test(memberExpression.property.name)) {
        return {
          name: memberExpression.property.name,
          namespace: memberObjectName,
          node: memberExpression.property,
        }
      }

      // foo['bar']()
      if (memberExpression.property.type === 'Literal' && typeof memberExpression.property.value === 'string' && filter.test(memberExpression.property.value)) {
        return {
          name: memberExpression.property.value,
          namespace: memberObjectName,
          node: memberExpression,
        }
      }
    }

    return null
  }

  // TODO: handle optional chaining, type assertions, non-null assertions, etc.
  // Member Expressions
  // foo.bar()
  if (callExpression.callee.type === 'MemberExpression') {
    const val = getParsedMemberExpression(callExpression.callee)
    if (val) {
      return {
        ...val,
        callExpression,
      }
    }
  // (foo.bar)()
  } else if (callExpression.callee.type === 'ParenthesizedExpression' && callExpression.callee.expression.type === 'MemberExpression') {
    const val = getParsedMemberExpression(callExpression.callee.expression)
    if (val) {
      return {
        ...val,
        node: callExpression.callee,
        callExpression,
      }
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
 * @param filter optional regex to filter based on exported names
 */
export function parseStaticExportIdentifiers (node: ExportNamedDeclaration | ExportDefaultDeclaration | TSExportAssignment, filter?: RegExp): ExportMetadata[] {
  // NAMED EXPORT -------------------------
  if (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type') {
    // export const, let, var
    if (node.declaration?.type === 'VariableDeclaration') {
      return node.declaration.declarations.map((d) => {
        if (d.id.type === 'Identifier' && (!filter || filter.test(d.id.name))) {
          return {
            localName: d.id.name,
            exportedName: d.id.name,
          }
        }
        return null
      }).filter((v): v is ExportMetadata => !!v)
    }

    // export function
    if (node.declaration?.type === 'FunctionDeclaration') {
      if (node.declaration.id?.type === 'Identifier' && (!filter || filter.test(node.declaration.id.name))) {
        return [{
          localName: node.declaration.id.name,
          exportedName: node.declaration.id.name,
        }]
      }
      return []
    }

    // export class
    if (node.declaration?.type === 'ClassDeclaration') {
      if (node.declaration.id?.type === 'Identifier' && (!filter || filter.test(node.declaration.id.name))) {
        return [{
          localName: node.declaration.id.name,
          exportedName: node.declaration.id.name,
        }]
      }
      return []
    }

    // export { foo, bar as baz }
    if (node.specifiers && node.specifiers.length) {
      return node.specifiers.map((s) => {
        if (s.exported.type === 'Identifier' && s.exportKind !== 'type' && s.local.type === 'Identifier' && (!filter || filter.test(s.exported.name))) {
          return {
            localName: s.local.name,
            exportedName: s.exported.name,
          }
        }
        return null
      }).filter((v): v is ExportMetadata => !!v)
    }

    return []
  }

  // DEFAULT EXPORT -------------------------
  if (node.type === 'ExportDefaultDeclaration' && (!node.exportKind || node.exportKind === 'value')) {
    // export default <identifier>
    if (node.declaration.type === 'Identifier') {
      return [{
        localName: node.declaration.name,
        exportedName: 'default',
      }]
    }

    // export default function
    if (node.declaration.type === 'FunctionDeclaration') {
      if (node.declaration.id?.type === 'Identifier') {
        return [{
          localName: node.declaration.id.name,
          exportedName: 'default',
        }]
      }
      return []
    }

    // export default class
    if (node.declaration.type === 'ClassDeclaration') {
      if (node.declaration.id?.type === 'Identifier') {
        return [{
          localName: node.declaration.id.name,
          exportedName: 'default',
        }]
      }
      return []
    }
  }

  if (node.type === 'TSExportAssignment') {
    // export = <identifier>
    if (node.expression.type === 'Identifier') {
      if (!filter || filter.test(node.expression.name)) {
        return [{
          localName: node.expression.name,
          exportedName: 'default',
        }]
      }
    }
  }

  return []
}
