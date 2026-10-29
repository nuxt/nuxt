import type { AttributeNode, BindingMetadata, ElementNode, ExpressionNode, NodeTransform, RootNode, SourceLocation } from '@vue/compiler-core'
import type { Diagnostic } from 'nostics'
import { componentDiagnostics, pageDiagnostics } from '@nuxt/kit/internal'
import { parseModule } from '../utils/parse.ts'

type Finding =
  | { code: 'NUXT_B3014', loc: SourceLocation, params: { component: string, directive: string } }
  | { code: 'NUXT_B3015', loc: SourceLocation, params: { component: string, prop: string, value: string } }
  | { code: 'NUXT_B4025', loc: SourceLocation, params: { tag: string, attribute: string, to: string } }

export interface TemplateDiagnosticsOptions {
  /** Whether a path matches a route the app can render. Return `undefined` to skip the `<NuxtLink>` check. */
  getRouteMatcher?: () => ((path: string) => boolean) | undefined
  /** Tag names (in any casing a template may use) of components that only render on the server. */
  getServerComponents?: () => ReadonlySet<string> | undefined
  /** The path shown for a file in messages and `sources`. */
  displayPath?: (file: string) => string
  /** Whether a file is checked. Defaults to every file. */
  filter?: (file: string) => boolean
  /** Called once for each new warning, until a compile of the file no longer raises it. */
  onWarning?: (diagnostic: Diagnostic<unknown>) => void
}

interface FileState {
  environments: Partial<Record<'client' | 'ssr', Set<string>>>
  reported: Set<string>
}

const NODE_ROOT = 0
const NODE_ELEMENT = 1
const NODE_SIMPLE_EXPRESSION = 4
const NODE_ATTRIBUTE = 6
const NODE_DIRECTIVE = 7
const ELEMENT_COMPONENT = 1

const NUXT_LINK_TAGS = new Set(['NuxtLink', 'nuxt-link'])
const NUXT_ISLAND_TAGS = new Set(['NuxtIsland', 'nuxt-island'])
const ISLAND_SERIALIZED_PROPS = new Set(['props', 'context'])
const LINK_TARGET_PROPS = new Set(['to', 'href', 'external'])
const RESERVED_PROPS = new Set(['key', 'ref', 'ref_for', 'ref_key'])
const IDENTIFIER_RE = /^[$A-Z_][\w$]*$/i

/**
 * A Vue compiler node transform that checks templates against what Nuxt knows about the app:
 * its page routes and its server components.
 *
 * Each file is checked once per compile and environment. A warning is printed when it first
 * appears in a file and forgotten once no environment raises it any more.
 */
export function createTemplateDiagnostics (options: TemplateDiagnosticsOptions = {}): { nodeTransform: NodeTransform } {
  const displayPath = options.displayPath ?? ((file: string) => file)
  const files = new Map<string, FileState>()
  const scripts = new WeakMap<RootNode, Map<string, string | undefined>>()

  const nodeTransform: NodeTransform = (node, context) => {
    // the vnode fallback branches of an SSR compile are checked as part of it
    if (node.type !== NODE_ROOT || !context.filename || typeof node.source !== 'string' || (context.inSSR && !context.ssr)) {
      return
    }
    const root = node
    const file = context.filename.split('?')[0]!
    if (options.filter && !options.filter(file)) {
      return
    }
    const bindings: BindingMetadata = context.bindingMetadata || {}
    const isLocal = (tag: string) => !!bindings[tag]
    const matchRoute = options.getRouteMatcher?.()
    const serverComponents = options.getServerComponents?.()
    const findings: Finding[] = []
    let scope: ReadonlySet<string> = new Set()

    const visit = (children: RootNode['children']) => {
      for (const child of children) {
        if (child.type !== NODE_ELEMENT) {
          continue
        }
        const outer = scope
        scope = withScopedNames(outer, child, 'for')
        checkElement(child)
        scope = withScopedNames(scope, child, 'slot')
        visit(child.children)
        scope = outer
      }
    }

    const checkElement = (element: ElementNode) => {
      if (element.tagType !== ELEMENT_COMPONENT || isLocal(element.tag)) {
        return
      }
      if (matchRoute && NUXT_LINK_TAGS.has(element.tag)) {
        checkLink(element, matchRoute)
      }
      if (serverComponents?.has(element.tag)) {
        checkServerComponent(element)
      }
      if (NUXT_ISLAND_TAGS.has(element.tag)) {
        checkIsland(element)
      }
    }

    const checkLink = (element: ElementNode, matchRoute: (path: string) => boolean) => {
      let target: AttributeNode | undefined
      for (const prop of element.props) {
        if (prop.type === NODE_ATTRIBUTE) {
          if (prop.name === 'external') {
            return
          }
          if (prop.name === 'to' || prop.name === 'href') {
            target = prop
          }
        } else if (prop.name === 'bind') {
          if (prop.arg?.type !== NODE_SIMPLE_EXPRESSION || !prop.arg.isStatic || LINK_TARGET_PROPS.has(prop.arg.content)) {
            return
          }
        }
      }
      const to = target?.value?.content
      const path = to && toRoutePath(to)
      if (path && !matchRoute(path)) {
        findings.push({ code: 'NUXT_B4025', loc: target!.loc, params: { tag: element.tag, attribute: target!.name, to } })
      }
    }

    const checkServerComponent = (element: ElementNode) => {
      for (const prop of element.props) {
        if (prop.type !== NODE_DIRECTIVE) {
          continue
        }
        if (prop.name === 'model' || (prop.name === 'on' && prop.arg?.type === NODE_SIMPLE_EXPRESSION && prop.arg.isStatic && prop.arg.content !== 'error')) {
          findings.push({ code: 'NUXT_B3014', loc: prop.loc, params: { component: element.tag, directive: prop.rawName || `v-${prop.name}` } })
          continue
        }
        if (prop.name !== 'bind' || !prop.exp || prop.arg?.type !== NODE_SIMPLE_EXPRESSION || !prop.arg.isStatic || RESERVED_PROPS.has(prop.arg.content)) {
          continue
        }
        const value = describeExpression(prop.exp)
        if (value) {
          findings.push({ code: 'NUXT_B3015', loc: prop.loc, params: { component: element.tag, prop: prop.arg.content, value } })
        }
      }
    }

    const checkIsland = (element: ElementNode) => {
      const name = element.props.find(prop => prop.type === NODE_ATTRIBUTE && prop.name === 'name') as AttributeNode | undefined
      const component = name?.value ? `${element.tag} name="${name.value.content}"` : element.tag
      for (const prop of element.props) {
        if (prop.type !== NODE_DIRECTIVE || prop.name !== 'bind' || prop.arg?.type !== NODE_SIMPLE_EXPRESSION || !prop.arg.isStatic || !ISLAND_SERIALIZED_PROPS.has(prop.arg.content)) {
          continue
        }
        const ast = prop.exp?.ast as unknown as EstreeLike | null | undefined
        if (ast?.type !== 'ObjectExpression') {
          continue
        }
        for (const property of ast.properties || []) {
          const value = property.type === 'ObjectProperty' ? property.value : property.type === 'ObjectMethod' ? property : undefined
          const described = value && describeNode(value)
          if (described) {
            const key = property.computed ? undefined : property.key?.name ?? property.key?.value
            findings.push({ code: 'NUXT_B3015', loc: prop.loc, params: { component, prop: typeof key === 'string' ? key : prop.arg.content, value: described } })
          }
        }
      }
    }

    const describeExpression = (exp: ExpressionNode): string | undefined => {
      if (exp.ast) {
        return describeNode(exp.ast as unknown as EstreeLike)
      }
      if (exp.ast === null) {
        return describeBinding(exp.loc.source.trim())
      }
    }

    const describeBinding = (name: string): string | undefined => {
      if (!IDENTIFIER_RE.test(name) || scope.has(name) || bindings[name] !== 'setup-const') {
        return
      }
      let declarations = scripts.get(root)
      if (!declarations) {
        declarations = readSetupDeclarations(root.source, file)
        scripts.set(root, declarations)
      }
      return declarations.get(name)
    }

    const describeNode = (node: EstreeLike): string | undefined => {
      switch (node.type) {
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
        case 'ObjectMethod':
          return 'a function'
        case 'ClassExpression':
          return 'a class'
        case 'NewExpression':
          return 'a class instance'
        case 'Identifier':
          return describeBinding(node.name!)
        case 'ParenthesizedExpression':
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
          return node.expression && describeNode(node.expression)
        case 'ConditionalExpression':
          return (node.consequent && describeNode(node.consequent)) || (node.alternate && describeNode(node.alternate))
        case 'LogicalExpression':
          return (node.left && describeNode(node.left)) || (node.right && describeNode(node.right))
        case 'ObjectExpression':
          for (const property of node.properties || []) {
            const value = property.type === 'ObjectProperty' ? property.value : property.type === 'ObjectMethod' ? property : undefined
            const described = value && describeNode(value)
            if (described) {
              return described
            }
          }
          return
        case 'ArrayExpression':
          for (const element of node.elements || []) {
            const described = element && describeNode(element)
            if (described) {
              return described
            }
          }
      }
    }

    visit(root.children)
    return () => finalise(file, context.ssr ? 'ssr' : 'client', findings)
  }

  function finalise (file: string, environment: 'client' | 'ssr', findings: Finding[]) {
    const state: FileState = files.get(file) ?? { environments: {}, reported: new Set() }
    const keys = new Set<string>()
    for (const finding of findings) {
      const key = `${finding.code}:${finding.loc.start.offset}:${JSON.stringify(finding.params)}`
      keys.add(key)
      if (!state.reported.has(key)) {
        state.reported.add(key)
        const diagnostic = report(finding, file)
        options.onWarning?.(diagnostic)
      }
    }
    state.environments[environment] = keys
    for (const key of state.reported) {
      if (!state.environments.client?.has(key) && !state.environments.ssr?.has(key)) {
        state.reported.delete(key)
      }
    }
    if (state.reported.size) {
      files.set(file, state)
    } else {
      files.delete(file)
    }
  }

  function report (finding: Finding, file: string): Diagnostic<unknown> {
    const { line, column } = finding.loc.start
    const params = { file: displayPath(file), sources: [`${displayPath(file)}:${line}:${column}`] }
    const diagnostic: Diagnostic<unknown> = finding.code === 'NUXT_B3014'
      ? componentDiagnostics.NUXT_B3014({ ...finding.params, ...params })
      : finding.code === 'NUXT_B3015'
        ? componentDiagnostics.NUXT_B3015({ ...finding.params, ...params })
        : pageDiagnostics.NUXT_B4025({ ...finding.params, ...params })
    // the compiler's own frames say nothing about the template
    diagnostic.stack = `${diagnostic.name}: ${diagnostic.message}`
    return diagnostic
  }

  return { nodeTransform }
}

interface EstreeLike {
  type: string
  name?: string
  computed?: boolean
  key?: { name?: string, value?: unknown }
  expression?: EstreeLike
  consequent?: EstreeLike
  alternate?: EstreeLike
  left?: EstreeLike
  right?: EstreeLike
  value?: EstreeLike
  properties?: EstreeLike[]
  elements?: (EstreeLike | null)[]
}

const SCOPED_NAME_RE = /[$A-Z_][\w$]*/gi
const FOR_SOURCE_RE = /\s+(?:in|of)\s+/

/** `scope` with the names an element's `v-for` alias or `v-slot` props declare. */
function withScopedNames (scope: ReadonlySet<string>, element: ElementNode, directive: 'for' | 'slot'): ReadonlySet<string> {
  const names: string[] = []
  for (const prop of element.props) {
    if (prop.type === NODE_DIRECTIVE && prop.name === directive && prop.exp) {
      const source = directive === 'for' ? prop.exp.loc.source.split(FOR_SOURCE_RE)[0]! : prop.exp.loc.source
      names.push(...source.match(SCOPED_NAME_RE) || [])
    }
  }
  return names.length ? new Set([...scope, ...names]) : scope
}

/** The router path a static link target points at, or `undefined` when it is not an absolute in-app path. */
function toRoutePath (to: string): string | undefined {
  if (!to.startsWith('/') || to.startsWith('//')) {
    return
  }
  const path = to.replace(/[?#].*$/, '')
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path
}

const SCRIPT_SETUP_RE = /<script(\s[^>]*\bsetup\b[^>]*)>([\s\S]*?)<\/script>/i
const SCRIPT_LANG_RE = /\blang=["']?([a-z]+)/i

/** The kind of value each top-level `<script setup>` declaration holds, where it is a function or class. */
function readSetupDeclarations (source: string, file: string): Map<string, string | undefined> {
  const declarations = new Map<string, string | undefined>()
  const match = SCRIPT_SETUP_RE.exec(source)
  if (!match) {
    return declarations
  }
  const lang = SCRIPT_LANG_RE.exec(match[1]!)?.[1] || 'ts'
  let program: ReturnType<typeof parseModule>['program']
  try {
    program = parseModule(match[2]!, `${file}.${lang}`).program
  } catch {
    return declarations
  }
  for (const statement of program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (!declaration) {
      continue
    }
    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      declarations.set(declaration.id.name, 'a function')
    } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
      declarations.set(declaration.id.name, 'a class')
    } else if (declaration.type === 'VariableDeclaration' && declaration.kind === 'const') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier' || !declarator.init) {
          continue
        }
        const init = declarator.init
        const value = init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression'
          ? 'a function'
          : init.type === 'ClassExpression'
            ? 'a class'
            : init.type === 'NewExpression' ? 'a class instance' : undefined
        if (value) {
          declarations.set(declarator.id.name, value)
        }
      }
    }
  }
  return declarations
}
