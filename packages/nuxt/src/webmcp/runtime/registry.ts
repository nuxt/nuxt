import type { AgentToolAnnotations, AgentToolSummary, JSONSchema } from './types'

export type { AgentToolAnnotations, AgentToolSummary, JSONSchema } from './types'

interface StandardIssue {
  message: string
  path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>
}

type StandardResult<Output> = { value: Output, issues?: undefined } | { issues: ReadonlyArray<StandardIssue> }

/** The subset of Standard Schema (and Standard JSON Schema) used for tool input. */
export interface StandardSchemaV1<Output = unknown> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>
    readonly types?: { readonly output: Output }
    readonly jsonSchema?: { readonly input: (options: { target: string }) => JSONSchema }
  }
}

export interface AgentToolResult {
  content: { type: 'text', text: string }[]
  isError?: boolean
}

export interface AgentToolTarget<T = unknown> {
  key: string
  label: string
  item?: T
  element?: Element
  disabled?: boolean
}

export interface AgentToolContext<T = unknown> {
  signal: AbortSignal
  target?: AgentToolTarget<T>
}

export interface AgentToolDefinition<I = any> {
  /** Up to 30 characters of letters, digits, `_`, `-` and `.`, such as `add_to_cart`. */
  name: string
  /** What the tool does and when to use it, in terms of the user's goals. */
  description: string
  /** Standard Schema used to validate input, and to derive `inputSchema` when the schema supports Standard JSON Schema. */
  input?: StandardSchemaV1<I>
  inputSchema?: JSONSchema
  annotations?: AgentToolAnnotations
  /**
   * The site requires the user to complete this action. A call prepares it (fills in the form,
   * highlights the control) and returns `status: "requires_user_action"` instead of running it.
   */
  confirm?: boolean
  execute?: (input: I, ctx: AgentToolContext) => unknown
}

export interface AgentToolActivation<I = any, T = unknown> {
  /** Evaluated on each call; a disabled tool stays registered and returns an error. */
  enabled?: () => boolean
  /** Items the tool can act on. Adds a `target` argument and a shared `list_targets` tool. */
  targets?: () => AgentToolTarget<T>[]
  element?: () => Element | undefined
  /** Runs after validation; return a result to stop the call. Calls to an activation with `prepare` run one at a time. */
  prepare?: (input: I, ctx: AgentToolContext<T>) => AgentToolResult | void | Promise<AgentToolResult | void>
  /** Hands a prepared action to the user, for tools with `confirm`. */
  stage?: (input: I, ctx: AgentToolContext<T>) => string
  execute?: (input: I, ctx: AgentToolContext<T>) => unknown
}

export interface AgentToolActivity {
  id: number
  tool: string
  message: string
  input: unknown
  target?: AgentToolTarget
  /** Abort the call: `ctx.signal` aborts and the agent gets a "stopped" result immediately. */
  stop: () => void
}

export interface ModelContextTool extends AgentToolSummary {
  execute: (input: any, client?: { signal?: AbortSignal }) => Promise<AgentToolResult>
}

/** The part of the WebMCP `ModelContext` the registry uses. */
export interface ModelContextLike {
  registerTool: (tool: ModelContextTool, options: { signal: AbortSignal }) => unknown
}

export interface AgentToolDiagnostics {
  registerFailed?: (tool: string, error: unknown) => void
  duplicate?: (tool: string) => void
  /** Problems with a tool's metadata, measured against {@link BUDGETS}. */
  lint?: (tool: string, problems: string[]) => void
  longResult?: (tool: string, length: number) => void
}

export interface AgentToolHost {
  modelContext?: () => ModelContextLike | undefined
  highlight?: (elements: Element[]) => void
  /** Called before a tool runs; the returned function is awaited afterwards and may describe what changed. */
  observe?: () => () => Promise<string | void>
  schedule?: (flush: () => void) => void
  diagnostics?: AgentToolDiagnostics
  /** Called with the registered tools after registrations change. */
  onChange?: (tools: AgentToolSummary[]) => void
}

/** Recommended limits for what an agent reads, in characters. */
export const BUDGETS = { name: 30, description: 500, parameterDescription: 150, result: 1500 }

const PAGE_SIZE = 20
const LIST_TARGETS = 'list_targets'

/** Problems with a tool's agent-facing metadata, measured against {@link BUDGETS}. */
export function lintTool (tool: AgentToolSummary): string[] {
  const problems: string[] = []
  if (tool.name.length > BUDGETS.name) {
    problems.push(`its name is longer than ${BUDGETS.name} characters`)
  }
  if (!tool.description.trim()) {
    problems.push('it has no description')
  } else if (tool.description.length > BUDGETS.description) {
    problems.push(`its description is longer than ${BUDGETS.description} characters`)
  }
  const visit = (schema: JSONSchema, path: string) => {
    for (const [key, property] of Object.entries((schema.properties ?? {}) as Record<string, JSONSchema>)) {
      if (key.length > BUDGETS.name) {
        problems.push(`parameter \`${path}${key}\` has a name longer than ${BUDGETS.name} characters`)
      }
      if (typeof property.description === 'string' && property.description.length > BUDGETS.parameterDescription) {
        problems.push(`parameter \`${path}${key}\` has a description longer than ${BUDGETS.parameterDescription} characters`)
      }
      visit(property, `${path}${key}.`)
    }
  }
  visit(tool.inputSchema, '')
  return problems
}

interface Entry {
  definition: AgentToolDefinition
  activations: Set<AgentToolActivation>
  controller?: AbortController
  /** The serialised summary the tool is registered with. */
  registered?: string
  linted?: boolean
}

export const text = (value: string, isError?: boolean): AgentToolResult => ({
  content: [{ type: 'text', text: value }],
  ...isError ? { isError: true } : {},
})

function toToolResult (value: unknown, suffix?: string | void): AgentToolResult {
  if (value instanceof Error) {
    return text(value.message, true)
  }
  if (value && typeof value === 'object' && Array.isArray((value as AgentToolResult).content)) {
    return value as AgentToolResult
  }
  const body = value === undefined || value === null ? 'Done.' : typeof value === 'string' ? value : JSON.stringify(value)
  return text(suffix ? `${body} ${suffix}` : body)
}

function errorMessage (error: unknown) {
  if (error && typeof error === 'object') {
    const e = error as { statusMessage?: string, message?: string }
    return e.statusMessage || e.message || JSON.stringify(error)
  }
  return String(error)
}

export function formatIssues (issues: ReadonlyArray<StandardIssue>) {
  return issues.map((issue) => {
    const path = issue.path?.map(p => typeof p === 'object' ? String(p.key) : String(p)).join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  }).join('; ')
}

export function isStandardSchema (value: unknown): value is StandardSchemaV1 {
  return !!value && (typeof value === 'object' || typeof value === 'function') && '~standard' in value
}

/** The input JSON Schema of a Standard Schema that implements Standard JSON Schema. */
export function toJsonSchema (schema: StandardSchemaV1 | undefined): JSONSchema | undefined {
  const json = schema?.['~standard'].jsonSchema?.input({ target: 'draft-2020-12' })
  if (json) {
    const { $schema: _, ...rest } = json
    return rest
  }
}

function baseSchema (definition: AgentToolDefinition): JSONSchema {
  const { $schema: _, ...schema } = definition.inputSchema ?? toJsonSchema(definition.input) ?? { type: 'object', properties: {} }
  return schema
}

/**
 * Tracks which tools the page currently offers and keeps their `ModelContext` registrations in sync.
 * Activations of the same name share one registration, so a tool rendered in a list registers once.
 */
export function createAgentToolRegistry (host: AgentToolHost = {}) {
  const entries = new Map<string, Entry>()
  const activities = new Set<AgentToolActivity>()
  const activityListeners = new Set<(activities: AgentToolActivity[]) => void>()
  const preparing = new WeakSet<AgentToolActivation>()
  let nextActivity = 0
  let listTargets: AbortController | undefined
  let holds = 0
  let scheduled = false

  const schedule = host.schedule ?? (flush => queueMicrotask(flush))
  const snapshot = () => [...activities].map(a => ({ ...a }))

  function requestFlush () {
    if (!scheduled) {
      scheduled = true
      schedule(() => {
        scheduled = false
        flush()
      })
    }
  }

  function isTargeted (entry: Entry) {
    return [...entry.activations].some(a => a.targets)
  }

  function summarize (entry: Entry): AgentToolSummary {
    const { definition } = entry
    const schema = baseSchema(definition)
    if (isTargeted(entry)) {
      schema.properties = {
        target: { type: 'string', description: `Which item to act on. Call ${LIST_TARGETS} with {"tool":"${definition.name}"} for the items on screen.` },
        ...schema.properties as object,
      }
      schema.required = ['target', ...(schema.required as string[] | undefined) ?? []]
    }
    return {
      name: definition.name,
      description: definition.confirm ? `${definition.description} This prepares the action on the page; the user completes it.` : definition.description,
      inputSchema: schema,
      annotations: Object.fromEntries(Object.entries(definition.annotations ?? {}).filter(([, value]) => value === true)),
    }
  }

  function register (modelContext: ModelContextLike, summary: AgentToolSummary, run: (input: any, signal?: AbortSignal) => Promise<AgentToolResult>) {
    const controller = new AbortController()
    const fail = (error: unknown) => host.diagnostics?.registerFailed?.(summary.name, error)
    try {
      Promise.resolve(modelContext.registerTool({ ...summary, execute: (input, client) => run(input, client?.signal) }, { signal: controller.signal })).catch(fail)
    } catch (error) {
      fail(error)
    }
    return controller
  }

  function flush () {
    if (holds > 0) {
      return
    }
    const modelContext = host.modelContext?.()
    let targeted = false
    const summaries: AgentToolSummary[] = []
    for (const [name, entry] of entries) {
      if (!entry.activations.size) {
        entry.controller?.abort()
        entries.delete(name)
        continue
      }
      const summary = summarize(entry)
      summaries.push(summary)
      if (modelContext) {
        const serialised = JSON.stringify(summary)
        if (entry.registered !== serialised) {
          entry.controller?.abort()
          entry.controller = register(modelContext, summary, (input, signal) => call(name, input, { signal }))
          entry.registered = serialised
        }
      }
      targeted ||= isTargeted(entry)
    }
    if (targeted && !listTargets && modelContext) {
      listTargets = register(modelContext, listTargetsSummary, input => Promise.resolve(text(JSON.stringify(pageOfTargets(input)))))
    } else if (!targeted && listTargets) {
      listTargets.abort()
      listTargets = undefined
    }
    host.onChange?.(targeted ? [...summaries, listTargetsSummary] : summaries)
  }

  function pageOfTargets (input: { tool?: string, query?: string, page?: number } = {}) {
    const words = input.query?.toLowerCase().split(/\s+/).filter(Boolean) ?? []
    const all = Object.entries(targets(input.tool)).flatMap(([tool, list]) => list.map(t => ({ tool, ...t })))
      .filter(t => words.every(word => t.label.toLowerCase().includes(word)))
    const total_pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
    const page = Math.min(Math.max(1, Math.floor(input.page ?? 1)), total_pages)
    const grouped: ReturnType<typeof targets> = Object.create(null)
    for (const { tool, ...target } of all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) {
      (grouped[tool] ||= []).push(target)
    }
    return { targets: grouped, page, page_size: PAGE_SIZE, total_count: all.length, total_pages }
  }

  function targets (tool?: string) {
    const result: Record<string, { target: string, label: string, disabled?: true }[]> = Object.create(null)
    for (const [name, entry] of entries) {
      if (tool && tool !== name) {
        continue
      }
      for (const activation of entry.activations) {
        const enabled = activation.enabled?.() !== false
        for (const target of activation.targets?.() ?? []) {
          (result[name] ||= []).push({
            target: target.key,
            label: target.label,
            ...!enabled || target.disabled ? { disabled: true as const } : {},
          })
        }
      }
    }
    return result
  }

  async function call (name: string, rawInput: unknown = {}, options: { signal?: AbortSignal } = {}): Promise<AgentToolResult> {
    const entry = entries.get(name)
    if (!entry?.activations.size) {
      return text(`"${name}" is not available on the current page.`, true)
    }
    const { definition } = entry
    const activations = [...entry.activations]
    let input = (rawInput ?? {}) as Record<string, unknown>
    let activation: AgentToolActivation | undefined
    let target: AgentToolTarget | undefined

    if (isTargeted(entry)) {
      const { target: key, ...rest } = input
      for (const candidate of activations) {
        target = candidate.targets?.().find(t => t.key === String(key))
        if (target) {
          activation = candidate
          break
        }
      }
      if (!activation || !target) {
        return text(`No target ${JSON.stringify(key)} is on screen. Call ${LIST_TARGETS} with {"tool":"${name}"} for the current targets.`, true)
      }
      input = rest
    } else {
      activation = activations.find(a => a.enabled?.() !== false) ?? activations[0]!
    }

    if (activation.enabled?.() === false || target?.disabled) {
      return text(`"${name}" is currently disabled${target ? ` for "${target.label}"` : ''}.`, true)
    }

    let value: unknown = input
    if (definition.input) {
      const result = await definition.input['~standard'].validate(input)
      if (result.issues) {
        return text(`Invalid input. ${formatIssues(result.issues)}`, true)
      }
      value = result.value
    }

    const stoppedResult = text('The user stopped this action. Do not retry unless they ask.', true)
    if (options.signal?.aborted) {
      return stoppedResult
    }
    if (preparing.has(activation)) {
      return text(`"${name}" is already running. Wait for it to finish before calling it again.`, true)
    }
    const controller = new AbortController()
    options.signal?.addEventListener('abort', () => controller.abort(options.signal!.reason), { once: true })
    const stopped = new Promise<AgentToolResult>((resolve) => {
      controller.signal.addEventListener('abort', () => resolve(stoppedResult), { once: true })
    })
    const activity: AgentToolActivity = {
      id: ++nextActivity,
      tool: name,
      message: target ? `${definition.description} (${target.label})` : definition.description,
      input: value,
      target,
      stop: () => controller.abort('stopped by the user'),
    }
    const notify = () => {
      const current = snapshot()
      activityListeners.forEach(listener => listener(current))
    }

    const ctx: AgentToolContext = { signal: controller.signal, target }
    const element = target?.element ?? activation.element?.()
    if (element) {
      host.highlight?.([element])
    }

    const run = async (): Promise<AgentToolResult> => {
      const prepared = await activation.prepare?.(value, ctx)
      if (controller.signal.aborted) {
        return stoppedResult
      }
      if (prepared) {
        return prepared
      }
      if (definition.confirm) {
        return activation.stage
          ? text(JSON.stringify({ status: 'requires_user_action', message: activation.stage(value, ctx) }))
          : text(`"${name}" must be completed by the user on the page.`, true)
      }
      const execute = activation.execute ?? definition.execute
      if (!execute) {
        return text(`"${name}" has nothing to run.`, true)
      }
      const done = host.observe?.()
      const result = await execute(value, ctx)
      const toolResult = toToolResult(result, await done?.())
      const length = toolResult.content.reduce((sum, c) => sum + c.text.length, 0)
      if (length > BUDGETS.result) {
        host.diagnostics?.longResult?.(name, length)
      }
      return toolResult
    }

    if (activation.prepare) {
      preparing.add(activation)
    }
    activities.add(activity)
    notify()
    try {
      return await Promise.race([run(), stopped])
    } catch (error) {
      return text(errorMessage(error), true)
    } finally {
      preparing.delete(activation)
      activities.delete(activity)
      notify()
    }
  }

  const listTargetsSummary: AgentToolSummary = {
    name: LIST_TARGETS,
    description: 'List the items on screen that page actions can act on, with a label for each. Use when an action needs a target, then pass the item\'s target to it.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Only list targets for this action.' },
        query: { type: 'string', description: 'Only list targets whose label contains these words.' },
        page: { type: 'integer', minimum: 1, description: `Page of results, ${PAGE_SIZE} per page.` },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  }

  return {
    /** Make a tool available until the returned `dispose` is called. */
    activate<I> (definition: AgentToolDefinition<I>, options: AgentToolActivation<I, any> = {}) {
      let entry = entries.get(definition.name)
      if (entry && !entry.activations.size && entry.definition !== definition) {
        entry.controller?.abort()
        entries.delete(definition.name)
        entry = undefined
      }
      if (!entry) {
        entries.set(definition.name, entry = { definition, activations: new Set() })
      } else if (entry.definition !== definition && entry.definition.description !== definition.description) {
        host.diagnostics?.duplicate?.(definition.name)
      }
      const activation: AgentToolActivation = { ...options }
      entry.activations.add(activation)
      if (!entry.linted && host.diagnostics?.lint) {
        entry.linted = true
        const problems = lintTool(summarize(entry))
        if (problems.length) {
          host.diagnostics.lint(definition.name, problems)
        }
      }
      requestFlush()
      return {
        dispose () {
          entry.activations.delete(activation)
          requestFlush()
        },
      }
    },
    /** Invoke a tool directly, with the same checks the agent-facing registration applies. */
    call,
    targets,
    list (): AgentToolSummary[] {
      return [...entries.values()].filter(e => e.activations.size).map(summarize)
    },
    /**
     * Observe calls in progress, e.g. to show what the agent is doing and offer a way to stop it.
     * The listener is called with the calls already in progress, then each time they change.
     */
    onActivity (listener: (activities: AgentToolActivity[]) => void) {
      activityListeners.add(listener)
      listener(snapshot())
      return () => {
        activityListeners.delete(listener)
      }
    },
    /** Defer registration changes, e.g. while a page transition swaps components. */
    hold () {
      holds++
    },
    release () {
      holds = Math.max(0, holds - 1)
      requestFlush()
    },
  }
}

export type AgentToolRegistry = ReturnType<typeof createAgentToolRegistry>
