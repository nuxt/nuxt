import type { AttributeNode, DirectiveNode, ElementNode, NodeTransform, RootNode, SimpleExpressionNode, SourceLocation, TemplateChildNode } from '@vue/compiler-core'
import type { ESTree } from 'rolldown/utils'
import { walk } from 'oxc-walker'
import escapeRE from 'escape-string-regexp'
import { findSFCScriptBlocks } from '../core/utils/parse-utils.ts'
import { parseModule } from '../core/utils/parse.ts'

const NODE_ROOT = 0
const NODE_ELEMENT = 1
const NODE_SIMPLE_EXPRESSION = 4
const NODE_ATTRIBUTE = 6
const NODE_DIRECTIVE = 7
const ELEMENT_COMPONENT = 1
const ELEMENT_TEMPLATE = 3

const FLAGS = ['readonly', 'consequential', 'confirm']
const NATIVE_FIELDS = new Set(['input', 'select', 'textarea'])
const LABEL_ATTRS = ['aria-label', 'aria-labelledby', 'aria-description', 'toolparamdescription']
const MEMBER_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i
const SCRIPT_LANG_RE = /\blang=["']?([a-z]+)/i
const CAMEL_RE = /([a-z0-9])([A-Z])/g
const JARGON_RE = /\b(?:pinia|vuex|redux|zustand|graphql|grpc|rest api|express|postgres(?:ql)?|mysql|mongodb|nitro|composables?|mutation handler|controller|endpoint|\$fetch|ajax)\b/i
const WHEN_RE = /\bwhen\b/i
const JSDOC_TAG_RE = /^@(\w+)(?:\s(.*))?$/

export type AgentToolFinding =
  | { code: 'NUXT_B1024', offset: number, params: { fn: string, flags: string } }
  | { code: 'NUXT_B1025', offset: number, params: { fn: string } }
  | { code: 'NUXT_B1026', offset: number, params: { handler: string } }
  | { code: 'NUXT_B1027', offset: number, params: { fn: string } }
  | { code: 'NUXT_B1028', offset: number, params: { tool: string, problem: string } }
  | { code: 'NUXT_B1029', offset: number, params: { source: string } }

export interface AgentToolTransformOptions {
  /** Called once for each new finding, until a compile of the file no longer raises it. */
  report?: (finding: AgentToolFinding, file: string, source: string) => void
}

interface ToolMeta {
  fn: string
  name: string
  description: string
  readonly: boolean
  consequential: boolean
  confirm: boolean
  input?: string
  unknownFlags: string[]
  offset: number
}

interface WalkState {
  tools: Map<string, ToolMeta>
  client: boolean
  fors: { key?: string, aliases: string[] }[]
  form?: { models: string[] }
  labels: number
  labelFor: Set<string>
  unlabelled: { id?: string, source: string, offset: number }[]
  bound: Set<string>
  mentioned: Set<string>
  findings: AgentToolFinding[]
}

const snake = (name: string) => name.replace(CAMEL_RE, '$1_$2').toLowerCase()

/** Problems with a tool description, measured against the WebMCP tool design guidance. */
export function lintDescription (description: string): string[] {
  if (!description.trim()) {
    return ['it has no description, so agents see a generated one; add a JSDoc summary']
  }
  const problems: string[] = []
  const jargon = description.match(JARGON_RE)
  if (jargon) {
    problems.push(`its description mentions "${jargon[0]}"; describe what it does for the user, not how it is built`)
  }
  if (!WHEN_RE.test(description)) {
    problems.push('its description says what it does but not when to use it; add "Use when ..."')
  }
  return problems
}

function parseJSDoc (raw: string) {
  const summary: string[] = []
  const tags: { tag: string, text: string }[] = []
  for (const line of raw.replace(/^\*/, '').split('\n').map(l => l.replace(/^\s*\*?\s?/, '').trim())) {
    const tag = line.match(JSDOC_TAG_RE)
    if (tag) {
      tags.push({ tag: tag[1]!, text: tag[2]?.trim() ?? '' })
    } else if (tags.length) {
      tags.at(-1)!.text += ` ${line}`
    } else if (line) {
      summary.push(line)
    }
  }
  return { summary: summary.join(' '), tags }
}

function staticString (node: ESTree.Node | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]!.value.cooked ?? undefined
  }
}

function readScripts (source: string, file: string, findings: AgentToolFinding[]) {
  const tools = new Map<string, ToolMeta>()
  for (const block of findSFCScriptBlocks(source)) {
    const tagged = block.content.includes('@tool')
    const defined = block.content.includes('defineAgentTool')
    if (!tagged && !defined) {
      continue
    }
    const lang = SCRIPT_LANG_RE.exec(block.attrs)?.[1] || 'ts'
    let result: ReturnType<typeof parseModule>
    try {
      result = parseModule(block.content, `${file}.${lang}`)
    } catch {
      continue
    }
    if (tagged) {
      for (const statement of result.program.body) {
        const declaration = statement.type === 'ExportNamedDeclaration' && statement.declaration ? statement.declaration : statement
        let fn: string | undefined
        if (declaration.type === 'FunctionDeclaration' && declaration.id) {
          fn = declaration.id.name
        } else if (declaration.type === 'VariableDeclaration') {
          const declarator = declaration.declarations[0]
          if (declarator?.id.type === 'Identifier' && (declarator.init?.type === 'ArrowFunctionExpression' || declarator.init?.type === 'FunctionExpression')) {
            fn = declarator.id.name
          }
        }
        const doc = fn && result.comments.findLast(c => c.type === 'Block' && c.end <= statement.start && c.value.startsWith('*') && !block.content.slice(c.end, statement.start).trim())
        if (!fn || !doc) {
          continue
        }
        const { summary, tags } = parseJSDoc(doc.value)
        const tool = tags.find(t => t.tag === 'tool')
        if (!tool) {
          continue
        }
        const flags = tool.text.split(/\s+/).filter(Boolean)
        tools.set(fn, {
          fn,
          name: snake(fn),
          description: summary,
          readonly: flags.includes('readonly'),
          consequential: flags.includes('consequential'),
          confirm: flags.includes('confirm'),
          input: tags.find(t => t.tag === 'input')?.text.trim().split(/\s+/)[0] || undefined,
          unknownFlags: flags.filter(flag => !FLAGS.includes(flag)),
          offset: block.start + statement.start,
        })
      }
    }
    if (defined) {
      walk(result.program, {
        enter (node) {
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== 'defineAgentTool' || node.arguments[0]?.type !== 'ObjectExpression') {
            return
          }
          const props: Record<string, ESTree.Node> = {}
          for (const property of node.arguments[0].properties) {
            if (property.type === 'Property' && property.key.type === 'Identifier') {
              props[property.key.name] = property.value
            }
          }
          const name = staticString(props.name)
          const description = staticString(props.description)
          if (name && description !== undefined) {
            for (const problem of lintDescription(description)) {
              findings.push({ code: 'NUXT_B1028', offset: block.start + node.start, params: { tool: name, problem } })
            }
          }
        },
      })
    }
  }
  return tools
}

function simpleExpression (content: string, loc: SourceLocation): SimpleExpressionNode {
  return { type: NODE_SIMPLE_EXPRESSION, content, isStatic: false, constType: 0, loc } as SimpleExpressionNode
}

function addAttr (el: ElementNode, name: string, value: string) {
  if (el.props.some(p => p.type === NODE_ATTRIBUTE && p.name === name)) {
    return
  }
  el.props.push({
    type: NODE_ATTRIBUTE,
    name,
    nameLoc: el.loc,
    value: { type: 2, content: value, loc: el.loc },
    loc: el.loc,
  } as AttributeNode)
}

function findProp (el: ElementNode, name: string): { dynamic: string } | { static: string } | undefined {
  for (const p of el.props) {
    if (p.type === NODE_DIRECTIVE && p.name === 'bind' && p.arg?.type === NODE_SIMPLE_EXPRESSION && (p.arg as SimpleExpressionNode).content === name && p.exp) {
      return { dynamic: p.exp.loc.source }
    }
    if (p.type === NODE_ATTRIBUTE && p.name === name) {
      return { static: p.value?.content ?? '' }
    }
  }
}

function findHandlers (el: ElementNode) {
  const isComponent = el.tagType === ELEMENT_COMPONENT
  return el.props.filter((p): p is DirectiveNode & { exp: SimpleExpressionNode, arg: SimpleExpressionNode } =>
    p.type === NODE_DIRECTIVE && p.name === 'on' && !!p.exp && p.arg?.type === NODE_SIMPLE_EXPRESSION && (p.arg as SimpleExpressionNode).isStatic
    && (isComponent || (p.arg as SimpleExpressionNode).content === 'click' || (p.arg as SimpleExpressionNode).content === 'submit'),
  )
}

type Handler = { fn: string, call: string } | { mentions: string[] }

function analyseHandler (source: string, tools: Map<string, ToolMeta>): Handler | undefined {
  let program: ESTree.Program
  try {
    program = parseModule(source, 'handler.ts').program
  } catch {
    return
  }
  const [statement] = program.body
  if (program.body.length === 1 && statement?.type === 'ExpressionStatement') {
    const expression = statement.expression
    if (expression.type === 'Identifier' && tools.has(expression.name)) {
      return { fn: expression.name, call: `${expression.name}($event)` }
    }
    if (expression.type === 'CallExpression' && expression.callee.type === 'Identifier' && tools.has(expression.callee.name)) {
      return { fn: expression.callee.name, call: source.slice(expression.start, expression.end) }
    }
  }
  const mentions = [...tools.keys()].filter(fn => new RegExp(`(^|[^\\w$.])${escapeRE(fn)}([^\\w$]|$)`).test(source))
  return mentions.length ? { mentions } : undefined
}

function fieldAccessors (models: string[]) {
  const paths = models.map(source => MEMBER_PATH_RE.test(source) ? source.split('.') : [source])
  const first = paths[0]?.[0]
  const root = paths.length && paths.every(p => p.length > 1 && p[0] === first) ? first : undefined
  const keys = paths.map(p => (root ? p.slice(1) : p).join('.'))
  const fields = models.map((source, i) =>
    `${JSON.stringify(keys[i])}: { source: ${JSON.stringify(source)}, get: () => (${source}), set: ($v) => { ${source} = $v } }`,
  )
  return { root, keys, source: `{ ${fields.join(', ')} }` }
}

function addDirective (el: ElementNode, source: string) {
  el.props.push({
    type: NODE_DIRECTIVE,
    name: 'agent-tool',
    rawName: 'v-agent-tool',
    exp: simpleExpression(source, el.loc),
    arg: undefined,
    modifiers: [],
    loc: el.loc,
  } as DirectiveNode)
}

function visitElement (el: ElementNode, state: WalkState) {
  const exits: (() => void)[] = []

  const loop = el.props.find((p): p is DirectiveNode => p.type === NODE_DIRECTIVE && p.name === 'for')
  if (loop?.forParseResult) {
    const key = findProp(el, 'key')
    const keySource = key && ('dynamic' in key ? key.dynamic : JSON.stringify(key.static))
    if (keySource && el.tagType !== ELEMENT_TEMPLATE) {
      addAttr(el, 'data-agent-item', '')
    }
    const { key: keyAlias, index } = loop.forParseResult
    const aliases = [keyAlias, index].filter(a => a?.type === NODE_SIMPLE_EXPRESSION).map(a => (a as SimpleExpressionNode).content)
    state.fors.push({ key: keySource, aliases })
    exits.push(() => state.fors.pop())
  }

  if (el.tag === 'label') {
    const target = findProp(el, 'for')
    if (target && 'static' in target && target.static) {
      state.labelFor.add(target.static)
    }
    state.labels++
    exits.push(() => state.labels--)
  }

  if (state.form) {
    const model = el.props.find((p): p is DirectiveNode => p.type === NODE_DIRECTIVE && p.name === 'model')
    if (model?.exp) {
      const source = model.exp.loc.source.trim()
      addAttr(el, 'data-agent-field', source)
      state.form.models.push(source)
      if (el.tagType !== ELEMENT_COMPONENT && NATIVE_FIELDS.has(el.tag) && !state.labels && !LABEL_ATTRS.some(attr => findProp(el, attr))) {
        const id = findProp(el, 'id')
        state.unlabelled.push({ id: id && 'static' in id ? id.static : undefined, source, offset: el.loc.start.offset })
      }
    }
  }

  for (const handler of findHandlers(el)) {
    const result = analyseHandler(handler.exp.loc.source, state.tools)
    if (!result) {
      continue
    }
    if ('mentions' in result) {
      result.mentions.forEach(fn => state.mentioned.add(fn))
      state.findings.push({ code: 'NUXT_B1026', offset: handler.loc.start.offset, params: { handler: handler.exp.loc.source } })
      continue
    }
    const meta = state.tools.get(result.fn)!
    const kind = handler.arg.content === 'submit' ? 'form' : 'action'
    const target = state.fors.findLast(f => f.key)
    if (target && target.aliases.includes(target.key!)) {
      state.findings.push({ code: 'NUXT_B1027', offset: el.loc.start.offset, params: { fn: meta.fn } })
    }
    const disabled = findProp(el, 'disabled')
    const props = [
      `name: ${JSON.stringify(meta.name)}`,
      `kind: ${JSON.stringify(kind)}`,
      `description: ${JSON.stringify(meta.description)}`,
      `readonly: ${meta.readonly}`,
      `consequential: ${meta.consequential}`,
      `confirm: ${meta.confirm}`,
      ...target ? [`target: (${target.key})`] : [],
      ...disabled ? [`enabled: ${'dynamic' in disabled ? `() => !(${disabled.dynamic})` : '() => false'}`] : [],
      `invoke: ($event) => (${result.call})`,
    ]
    state.bound.add(meta.fn)

    if (kind === 'action') {
      if (state.client) {
        addDirective(el, `{ ${props.join(', ')} }`)
      }
      break
    }

    if (state.client) {
      handler.exp = simpleExpression(`$agentTools.capture(${JSON.stringify(meta.name)}, () => (${result.call}))`, handler.exp.loc)
    }
    const schemaProp = findProp(el, 'schema') ?? findProp(el, 'validation-schema') ?? findProp(el, 'validationSchema')
    const schema = meta.input ?? (schemaProp && 'dynamic' in schemaProp ? schemaProp.dynamic : undefined)
    const form = { models: [] as string[] }
    state.form = form
    exits.push(() => {
      state.form = undefined
      const { root, keys, source } = fieldAccessors([...new Set(form.models)])
      const repeated = keys.filter(key => new RegExp(`\\b${key.split('.').at(-1)!.replace(/\W/g, '')}\\b`, 'i').test(meta.description))
      if (repeated.length > 1) {
        state.findings.push({ code: 'NUXT_B1028', offset: meta.offset, params: { tool: meta.name, problem: `its description lists fields (${repeated.join(', ')}) that the input schema already describes` } })
      }
      if (state.client) {
        addDirective(el, `{ ${[
          ...props,
          `fields: ${source}`,
          ...root ? [`root: () => (${root})`] : [],
          ...schema ? [`schema: () => (${schema})`] : [],
        ].join(', ')} }`)
      }
    })
    break
  }

  visitChildren(el.children, state)
  exits.reverse().forEach(exit => exit())
}

function visitChildren (children: TemplateChildNode[], state: WalkState) {
  for (const child of children) {
    if (child.type === NODE_ELEMENT) {
      visitElement(child, state)
    }
  }
}

function checkTools (state: WalkState) {
  for (const field of state.unlabelled) {
    if (!field.id || !state.labelFor.has(field.id)) {
      state.findings.push({ code: 'NUXT_B1029', offset: field.offset, params: { source: field.source } })
    }
  }
  for (const meta of state.tools.values()) {
    if (meta.unknownFlags.length) {
      state.findings.push({ code: 'NUXT_B1024', offset: meta.offset, params: { fn: meta.fn, flags: meta.unknownFlags.join(', ') } })
    }
    if (!state.bound.has(meta.fn) && !state.mentioned.has(meta.fn)) {
      state.findings.push({ code: 'NUXT_B1025', offset: meta.offset, params: { fn: meta.fn } })
      continue
    }
    const problems = lintDescription(meta.description)
    if (meta.readonly && (meta.consequential || meta.confirm)) {
      problems.push('it is marked `readonly`, but also `consequential` or `confirm`')
    }
    if (meta.confirm && meta.consequential) {
      problems.push('`confirm` hands the action to the user, which is the confirmation, so drop `consequential`')
    }
    for (const problem of problems) {
      state.findings.push({ code: 'NUXT_B1028', offset: meta.offset, params: { tool: meta.name, problem } })
    }
  }
}

/**
 * A Vue compiler node transform that turns template bindings of `@tool` functions into agent tools.
 *
 * It walks the template when the compile starts, before Vue's own transforms run, so the directive
 * and handler expressions it adds are processed like those written by hand. Server compiles get
 * only the `data-agent-*` attributes, so the rendered HTML matches the client.
 */
export function createAgentToolTransform (options: AgentToolTransformOptions = {}): NodeTransform {
  const reported = new Map<string, Set<string>>()

  return (node, context) => {
    // the vnode fallback branches of an SSR compile reuse nodes the SSR compile has already visited
    if (node.type !== NODE_ROOT || !context.filename || (context.inSSR && !context.ssr)) {
      return
    }
    const root = node as RootNode
    const source = typeof root.source === 'string' ? root.source : ''
    if (!source.includes('@tool') && !source.includes('defineAgentTool')) {
      return
    }
    const file = context.filename.split('?')[0]!
    const findings: AgentToolFinding[] = []
    const tools = readScripts(source, file, findings)
    const state: WalkState = {
      tools,
      client: !context.ssr,
      fors: [],
      labels: 0,
      labelFor: new Set(),
      unlabelled: [],
      bound: new Set(),
      mentioned: new Set(),
      findings,
    }
    if (tools.size) {
      visitChildren(root.children, state)
      checkTools(state)
    }

    const previous = reported.get(file)
    const keys = new Set<string>()
    for (const finding of findings) {
      const key = `${finding.code}:${finding.offset}:${JSON.stringify(finding.params)}`
      keys.add(key)
      if (!previous?.has(key)) {
        options.report?.(finding, file, source)
      }
    }
    if (keys.size) {
      reported.set(file, keys)
    } else {
      reported.delete(file)
    }
  }
}
