import { walk as _walk } from 'estree-walker'
import type { Node, SyncHandler } from 'estree-walker'
import type { ArrowFunctionExpression, CatchClause, FunctionDeclaration, FunctionExpression, Identifier, ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier, Program, VariableDeclaration } from 'estree'
import { type SameShape, type TransformOptions, type TransformResult, transform as esbuildTransform } from 'esbuild'
import { tryUseNuxt } from '@nuxt/kit'
import { parseSync } from 'oxc-parser'

export type { Node }

export async function transform<T extends TransformOptions> (input: string | Uint8Array, options?: SameShape<TransformOptions, T>): Promise<TransformResult<T>> {
  return await esbuildTransform(input, { ...tryUseNuxt()?.options.esbuild.options, ...options })
}

export type WithLocations<T> = T & { start: number, end: number }
type WalkerCallback = (this: ThisParameterType<SyncHandler>, node: WithLocations<Node>, parent: WithLocations<Node> | null, ctx: { key: string | number | symbol | null | undefined, index: number | null | undefined, ast: Program | Node }) => void

interface WalkOptions {
  enter: WalkerCallback
  leave: WalkerCallback
  scopeTracker: ScopeTracker
}

export function walk (ast: Program | Node, callback: Partial<WalkOptions>) {
  return _walk(ast, {
    enter (node, parent, key, index) {
      // @ts-expect-error - accessing a protected property
      callback.scopeTracker?.processNodeEnter(node as WithLocations<Node>)
      callback.enter?.call(this, node as WithLocations<Node>, parent as WithLocations<Node> | null, { key, index, ast })
    },
    leave (node, parent, key, index) {
      // @ts-expect-error - accessing a protected property
      callback.scopeTracker?.processNodeLeave(node as WithLocations<Node>)
      callback.leave?.call(this, node as WithLocations<Node>, parent as WithLocations<Node> | null, { key, index, ast })
    },
  })
}

export function parseAndWalk (code: string, sourceFilename: string, callback: WalkerCallback): Program
export function parseAndWalk (code: string, sourceFilename: string, object: Partial<WalkOptions>): Program
export function parseAndWalk (code: string, sourceFilename: string, callback: Partial<WalkOptions> | WalkerCallback) {
  const lang = sourceFilename.match(/\.[cm]?([jt]sx?)$/)?.[1] as 'js' | 'ts' | 'jsx' | 'tsx' | undefined || 'ts'
  const ast = parseSync(sourceFilename, code, { sourceType: 'module', lang })
  walk(ast.program as unknown as Program, typeof callback === 'function' ? { enter: callback } : callback)
  return ast.program as unknown as Program
}

export function withLocations<T> (node: T): WithLocations<T> {
  return node as WithLocations<T>
}

/**
 * A function to check whether scope A is a child of scope B.
 * @example
 * ```ts
 * isChildScope('0-1-2', '0-1') // true
 * isChildScope('0-1', '0-1') // false
 * ```
 *
 * @param a the child scope
 * @param b the parent scope
 * @returns true if scope A is a child of scope B, false otherwise (also when they are the same)
 */
function isChildScope (a: string, b: string) {
  return a.startsWith(b) && a.length > b.length
}

abstract class BaseNode<T extends Node = Node> {
  abstract type: string
  readonly scope: string
  node: WithLocations<T>

  constructor (node: WithLocations<T>, scope: string) {
    this.node = node
    this.scope = scope
  }

  /**
   * The starting position of the entire relevant node in the code.
   * For instance, for a function parameter, this would be the start of the function declaration.
   */
  abstract get start (): number

  /**
   * The ending position of the entire relevant node in the code.
   * For instance, for a function parameter, this would be the end of the function declaration.
   */
  abstract get end (): number

  /**
   * Check if the node is defined under a specific scope.
   * @param scope
   */
  isUnderScope (scope: string) {
    return isChildScope(this.scope, scope)
  }
}

class IdentifierNode extends BaseNode<Identifier> {
  override type = 'Identifier' as const

  get start () {
    return this.node.start
  }

  get end () {
    return this.node.end
  }
}

class FunctionParamNode extends BaseNode {
  type = 'FunctionParam' as const
  fnNode: WithLocations<FunctionDeclaration | FunctionExpression | ArrowFunctionExpression>

  constructor (node: WithLocations<Node>, scope: string, fnNode: WithLocations<FunctionDeclaration | FunctionExpression | ArrowFunctionExpression>) {
    super(node, scope)
    this.fnNode = fnNode
  }

  get start () {
    return this.fnNode.start
  }

  get end () {
    return this.fnNode.end
  }
}

class FunctionNode extends BaseNode<FunctionDeclaration | FunctionExpression | ArrowFunctionExpression> {
  type = 'Function' as const

  get start () {
    return this.node.start
  }

  get end () {
    return this.node.end
  }
}

class VariableNode extends BaseNode<Identifier> {
  type = 'Variable' as const
  variableNode: WithLocations<VariableDeclaration>

  constructor (node: WithLocations<Identifier>, scope: string, variableNode: WithLocations<VariableDeclaration>) {
    super(node, scope)
    this.variableNode = variableNode
  }

  get start () {
    return this.variableNode.start
  }

  get end () {
    return this.variableNode.end
  }
}

class ImportNode extends BaseNode<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier> {
  type = 'Import' as const
  importNode: WithLocations<Node>

  constructor (node: WithLocations<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>, scope: string, importNode: WithLocations<Node>) {
    super(node, scope)
    this.importNode = importNode
  }

  get start () {
    return this.importNode.start
  }

  get end () {
    return this.importNode.end
  }
}

class CatchParamNode extends BaseNode {
  type = 'CatchParam' as const
  catchNode: WithLocations<CatchClause>

  constructor (node: WithLocations<Node>, scope: string, catchNode: WithLocations<CatchClause>) {
    super(node, scope)
    this.catchNode = catchNode
  }

  get start () {
    return this.catchNode.start
  }

  get end () {
    return this.catchNode.end
  }
}

export type ScopeTrackerNode =
  | FunctionParamNode
  | FunctionNode
  | VariableNode
  | IdentifierNode
  | ImportNode
  | CatchParamNode

interface ScopeTrackerOptions {
  /**
   * If true, the scope tracker will keep exited scopes in memory.
   * @default false
   */
  keepExitedScopes?: boolean
}

/**
 * A class to track variable scopes and declarations of identifiers within a JavaScript AST.
 * It maintains a stack of scopes, where each scope is a map of identifier names to their corresponding
 * declaration nodes - allowing to get to the declaration easily.
 *
 * The class has integration with the `walk` function to automatically track scopes and declarations
 * and that's why only the informative methods are exposed.
 *
 * ### Scope tracking
 * Scopes are created when entering a block statement, however, they are also created
 * for function parameters, loop variable declarations, etc. (e.g. `i` in `for (let i = 0; i < 10; i++) { ... }`).
 * This means that the behaviour is not 100% equivalent to JavaScript's scoping rules, because internally,
 * one JavaScript scope can be spread across multiple scopes in this class.
 *
 * @example
 * ```ts
 * const scopeTracker = new ScopeTracker()
 * walk(code, {
 *   scopeTracker,
 *   enter(node) {
 *     // ...
 *   },
 * })
 * ```
 *
 * @see parseAndWalk
 * @see walk
 */
export class ScopeTracker {
  protected scopeIndexStack: number[] = []
  protected scopeIndexKey = ''
  protected scopes: Map<string, Map<string, WithLocations<ScopeTrackerNode>>> = new Map()

  protected options: Partial<ScopeTrackerOptions>
  protected isFrozen = false

  constructor (options: ScopeTrackerOptions = {}) {
    this.options = options
  }

  protected updateScopeIndexKey () {
    this.scopeIndexKey = this.scopeIndexStack.slice(0, -1).join('-')
  }

  protected pushScope () {
    this.scopeIndexStack.push(0)
    this.updateScopeIndexKey()
  }

  protected popScope () {
    this.scopeIndexStack.pop()
    if (this.scopeIndexStack[this.scopeIndexStack.length - 1] !== undefined) {
      this.scopeIndexStack[this.scopeIndexStack.length - 1]!++
    }

    if (!this.options.keepExitedScopes) {
      this.scopes.delete(this.scopeIndexKey)
    }

    this.updateScopeIndexKey()
  }

  protected declareIdentifier (name: string, data: ScopeTrackerNode) {
    if (this.isFrozen) { return }

    let scope = this.scopes.get(this.scopeIndexKey)
    if (!scope) {
      scope = new Map()
      this.scopes.set(this.scopeIndexKey, scope)
    }
    scope.set(name, data)
  }

  protected declareFunctionParameter (param: WithLocations<Node>, fn: WithLocations<FunctionDeclaration | FunctionExpression | ArrowFunctionExpression>) {
    if (this.isFrozen) { return }

    const identifiers = getPatternIdentifiers(param)
    for (const identifier of identifiers) {
      this.declareIdentifier(identifier.name, new FunctionParamNode(identifier, this.scopeIndexKey, fn))
    }
  }

  protected declarePattern (pattern: WithLocations<Node>, parent: WithLocations<FunctionDeclaration | FunctionExpression | ArrowFunctionExpression | VariableDeclaration | CatchClause>) {
    if (this.isFrozen) { return }

    const identifiers = getPatternIdentifiers(pattern)
    for (const identifier of identifiers) {
      this.declareIdentifier(
        identifier.name,
        parent.type === 'VariableDeclaration'
          ? new VariableNode(identifier, this.scopeIndexKey, parent)
          : parent.type === 'CatchClause'
            ? new CatchParamNode(identifier, this.scopeIndexKey, parent)
            : new FunctionParamNode(identifier, this.scopeIndexKey, parent),
      )
    }
  }

  protected processNodeEnter (node: WithLocations<Node>) {
    switch (node.type) {
      case 'Program':
      case 'BlockStatement':
      case 'StaticBlock':
        this.pushScope()
        break

      case 'FunctionDeclaration':
        // declare function name for named functions, skip for `export default`
        if (node.id?.name) {
          this.declareIdentifier(node.id.name, new FunctionNode(node, this.scopeIndexKey))
        }
        this.pushScope()
        for (const param of node.params) {
          this.declareFunctionParameter(withLocations(param), node)
        }
        break

      case 'FunctionExpression':
        // make the name of the function available only within the function
        // e.g. const foo = function bar() {  // bar is only available within the function body
        this.pushScope()
        // can be undefined, for example in class method definitions
        if (node.id?.name) {
          this.declareIdentifier(node.id.name, new FunctionNode(node, this.scopeIndexKey))
        }

        this.pushScope()
        for (const param of node.params) {
          this.declareFunctionParameter(withLocations(param), node)
        }
        break
      case 'ArrowFunctionExpression':
        this.pushScope()
        for (const param of node.params) {
          this.declareFunctionParameter(withLocations(param), node)
        }
        break

      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          this.declarePattern(withLocations(decl.id), node)
        }
        break

      case 'ClassDeclaration':
        // declare class name for named classes, skip for `export default`
        if (node.id?.name) {
          this.declareIdentifier(node.id.name, new IdentifierNode(withLocations(node.id), this.scopeIndexKey))
        }
        break

      case 'ClassExpression':
        // make the name of the class available only within the class
        // e.g. const MyClass = class InternalClassName { // InternalClassName is only available within the class body
        this.pushScope()
        if (node.id?.name) {
          this.declareIdentifier(node.id.name, new IdentifierNode(withLocations(node.id), this.scopeIndexKey))
        }
        break

      case 'ImportDeclaration':
        for (const specifier of node.specifiers) {
          this.declareIdentifier(specifier.local.name, new ImportNode(withLocations(specifier), this.scopeIndexKey, node))
        }
        break

      case 'CatchClause':
        this.pushScope()
        if (node.param) {
          this.declarePattern(withLocations(node.param), node)
        }
        break

      case 'ForStatement':
      case 'ForOfStatement':
      case 'ForInStatement':
        // make the variables defined in for loops available only within the loop
        // e.g. for (let i = 0; i < 10; i++) { // i is only available within the loop block scope
        this.pushScope()

        if (node.type === 'ForStatement' && node.init?.type === 'VariableDeclaration') {
          for (const decl of node.init.declarations) {
            this.declarePattern(withLocations(decl.id), withLocations(node.init))
          }
        } else if ((node.type === 'ForOfStatement' || node.type === 'ForInStatement') && node.left.type === 'VariableDeclaration') {
          for (const decl of node.left.declarations) {
            this.declarePattern(withLocations(decl.id), withLocations(node.left))
          }
        }
        break
    }
  }

  protected processNodeLeave (node: WithLocations<Node>) {
    switch (node.type) {
      case 'Program':
      case 'BlockStatement':
      case 'CatchClause':
      case 'FunctionDeclaration':
      case 'ArrowFunctionExpression':
      case 'StaticBlock':
      case 'ClassExpression':
      case 'ForStatement':
      case 'ForOfStatement':
      case 'ForInStatement':
        this.popScope()
        break
      case 'FunctionExpression':
        this.popScope()
        this.popScope()
        break
    }
  }

  isDeclared (name: string) {
    if (!this.scopeIndexKey) {
      return this.scopes.get('')?.has(name) || false
    }

    const indices = this.scopeIndexKey.split('-').map(Number)
    for (let i = indices.length; i >= 0; i--) {
      if (this.scopes.get(indices.slice(0, i).join('-'))?.has(name)) {
        return true
      }
    }
    return false
  }

  getDeclaration (name: string): ScopeTrackerNode | null {
    if (!this.scopeIndexKey) {
      return this.scopes.get('')?.get(name) ?? null
    }

    const indices = this.scopeIndexKey.split('-').map(Number)
    for (let i = indices.length; i >= 0; i--) {
      const node = this.scopes.get(indices.slice(0, i).join('-'))?.get(name)
      if (node) {
        return node
      }
    }
    return null
  }

  getCurrentScope () {
    return this.scopeIndexKey
  }

  /**
   * Check if the current scope is a child of a specific scope.
   * @example
   * ```ts
   * // current scope is 0-1
   * isCurrentScopeUnder('0') // true
   * isCurrentScopeUnder('0-1') // false
   * ```
   *
   * @param scope the parent scope
   * @returns `true` if the current scope is a child of the specified scope, `false` otherwise (also when they are the same)
   */
  isCurrentScopeUnder (scope: string) {
    return isChildScope(this.scopeIndexKey, scope)
  }

  /**
   * Freezes the scope tracker, preventing further declarations.
   * It also resets the scope index stack to its initial state, so that the scope tracker can be reused.
   *
   * This is useful for second passes through the AST.
   */
  freeze () {
    this.isFrozen = true
    this.scopeIndexStack = []
    this.updateScopeIndexKey()
  }
}

function getPatternIdentifiers (pattern: WithLocations<Node>) {
  const identifiers: WithLocations<Identifier>[] = []

  function collectIdentifiers (pattern: WithLocations<Node>) {
    switch (pattern.type) {
      case 'Identifier':
        identifiers.push(pattern)
        break
      case 'AssignmentPattern':
        collectIdentifiers(withLocations(pattern.left))
        break
      case 'RestElement':
        collectIdentifiers(withLocations(pattern.argument))
        break
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          if (element) {
            collectIdentifiers(withLocations(element.type === 'RestElement' ? element.argument : element))
          }
        }
        break
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          collectIdentifiers(withLocations(property.type === 'RestElement' ? property.argument : property.value))
        }
        break
    }
  }

  collectIdentifiers(pattern)

  return identifiers
}

export function isNotReferencePosition (node: WithLocations<Node>, parent: WithLocations<Node> | null) {
  if (!parent || node.type !== 'Identifier') { return false }

  switch (parent.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      // function name or parameters
      if (parent.type !== 'ArrowFunctionExpression' && parent.id === node) { return true }
      if (parent.params.length) {
        for (const param of parent.params) {
          const identifiers = getPatternIdentifiers(withLocations(param))
          if (identifiers.includes(node)) { return true }
        }
      }
      return false

    case 'ClassDeclaration':
    case 'ClassExpression':
      // class name
      return parent.id === node

    case 'MethodDefinition':
      // class method name
      return parent.key === node

    case 'PropertyDefinition':
      // class property name
      return parent.key === node

    case 'VariableDeclarator':
      // variable name
      return getPatternIdentifiers(withLocations(parent.id)).includes(node)

    case 'CatchClause':
      // catch clause param
      if (!parent.param) { return false }
      return getPatternIdentifiers(withLocations(parent.param)).includes(node)

    case 'Property':
      // property key if not used as a shorthand
      return parent.key === node && parent.value !== node

    case 'MemberExpression':
      // member expression properties
      return parent.property === node
  }

  return false
}

export function getUndeclaredIdentifiersInFunction (node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression) {
  const scopeTracker = new ScopeTracker({
    keepExitedScopes: true,
  })
  const undeclaredIdentifiers = new Set<string>()

  function isIdentifierUndeclared (node: WithLocations<Identifier>, parent: WithLocations<Node> | null) {
    return !isNotReferencePosition(node, parent) && !scopeTracker.isDeclared(node.name)
  }

  // first pass to collect all declarations and hoist them
  walk(node, {
    scopeTracker,
  })

  scopeTracker.freeze()

  walk(node, {
    scopeTracker,
    enter (node, parent) {
      if (node.type === 'Identifier' && isIdentifierUndeclared(node, parent)) {
        undeclaredIdentifiers.add(node.name)
      }
    },
  })

  return Array.from(undeclaredIdentifiers)
}
