import type { RuntimeConfigSchemaNode, RuntimeConfigSchemaObject } from '@nuxt/schema/internal'

export interface RuntimeConfigEnvOptions {
  env: Record<string, string | undefined>
  prefix: string
  altPrefix: string
  envExpansion?: boolean
}

export interface RuntimeConfigIssue {
  /** Dot-separated path of the value within the runtime config. */
  path: string
  /** The environment variable the value was read from, or that can provide it. */
  env: string
  expected: string
  /** The value that failed validation, absent when no value was provided. */
  received?: unknown
  /** Whether the value is part of the public runtime config. */
  public?: true
}

const INVALID = Symbol('invalid')

const BOOLEANS: Record<string, boolean> = { true: true, false: false, 1: true, 0: false, yes: true, no: false, on: true, off: false }

const ENV_EXPANSION_RE = /\{\{([^{}]*)\}\}/g

/**
 * Apply environment variables to `config` in place, coercing each value to the type its
 * schema describes, and collect every value that does not match its schema.
 */
export function applyRuntimeConfigSchema (config: Record<string, unknown>, schema: RuntimeConfigSchemaObject, options: RuntimeConfigEnvOptions): RuntimeConfigIssue[] {
  const issues: RuntimeConfigIssue[] = []
  applyObject(config, schema, '', '', options, issues)
  return issues
}

function applyObject (target: Record<string, unknown>, node: RuntimeConfigSchemaObject, envPath: string, path: string, options: RuntimeConfigEnvOptions, issues: RuntimeConfigIssue[], isPublic = false, defaults?: Record<string, unknown>) {
  const reject = (key: string, issue: RuntimeConfigIssue) => {
    issues.push(issue)
    if (defaults && Object.hasOwn(defaults, key)) {
      target[key] = defaults[key]
    } else if (defaults) {
      delete target[key]
    }
  }
  for (const key in node.p) {
    const child = node.p[key]!
    const subKey = envPath ? `${envPath}_${key}` : key
    const envKey = toEnvKey(subKey)
    const prefixed = options.env[options.prefix + envKey]
    const envValue = prefixed ?? options.env[options.altPrefix + envKey]
    const expandEnv = options.envExpansion && envValue !== undefined && (isScalar(child) || parseJSON(envValue) === INVALID)
    const raw = expandEnv ? expand(envValue, options.env) : envValue
    const issue: RuntimeConfigIssue = {
      path: path ? `${path}.${key}` : key,
      env: (prefixed === undefined ? options.altPrefix : options.prefix) + envKey,
      expected: describe(child),
      ...(isPublic || (!path && key === 'public')) && { public: true },
    }
    const required = !!node.r?.includes(key)

    let value = target[key]
    if (raw !== undefined) {
      const parsed = coerce(raw, child)
      if (parsed === INVALID) {
        if (raw !== '') {
          reject(key, { ...issue, received: raw })
          continue
        }
      } else {
        value = isObject(parsed) && isObject(value) ? merge(value, parsed) : parsed
      }
    }

    const objectNode = isObjectNode(child) ? child : value === undefined || isObject(value) ? findObjectNode(child, value ?? {}) : undefined
    if (objectNode) {
      if (value !== undefined && !isObject(value)) {
        reject(key, { ...issue, received: value })
        continue
      }
      const members = typeof child === 'object' && 'o' in child ? child.o.filter(isObjectNode) : []
      const order = [objectNode, ...members.filter(member => member !== objectNode)]
      const resolve = (start: Record<string, unknown>, fill: boolean) => {
        let nested = start
        let nestedIssues: RuntimeConfigIssue[] = []
        for (const member of order) {
          const candidate = members.length > 1 ? structuredClone(start) : nested
          if (fill && member.d) {
            for (const name in member.d) {
              candidate[name] ??= structuredClone(member.d[name])
            }
          }
          const candidateIssues: RuntimeConfigIssue[] = []
          applyObject(candidate, member, subKey, issue.path, options, candidateIssues, !!issue.public, isObject(target[key]) ? target[key] : undefined)
          if (member === objectNode || !candidateIssues.length) {
            nested = candidate
            nestedIssues = candidateIssues
          }
          if (!candidateIssues.length) {
            break
          }
        }
        return { nested, nestedIssues }
      }
      let { nested, nestedIssues } = resolve((value ?? {}) as Record<string, unknown>, value !== undefined)
      if (value === undefined && Object.keys(nested).length && order.some(member => member.d)) {
        ({ nested, nestedIssues } = resolve({}, true))
      }
      if (value === undefined && !required && !Object.keys(nested).length) {
        issues.push(...nestedIssues.filter(nestedIssue => 'received' in nestedIssue))
        continue
      }
      issues.push(...nestedIssues)
      target[key] = nested
      continue
    }

    if (value === undefined) {
      if (required) {
        issues.push(issue)
      }
      continue
    }
    if (options.envExpansion && !expandEnv && typeof value === 'string') {
      value = expand(value, options.env)
    }
    if (!check(value, child)) {
      reject(key, { ...issue, received: value })
      continue
    }
    target[key] = value
  }
}

function expand (value: string, env: Record<string, string | undefined>): string {
  return value.replace(ENV_EXPANSION_RE, (match, name) => env[name] || match)
}

function isScalar (node: RuntimeConfigSchemaNode): boolean {
  if (typeof node === 'string') {
    return node !== '*'
  }
  return 'e' in node || ('o' in node && node.o.every(isScalar))
}

/**
 * Describe each issue on its own line. Received values are only shown for public runtime
 * config, as private values may be secrets.
 */
export function formatRuntimeConfigIssues (issues: RuntimeConfigIssue[]): string {
  return issues.map((issue) => {
    if (!('received' in issue)) {
      return `\`${issue.path}\` is required. Set \`${issue.env}\` or provide a default.`
    }
    const kind = Array.isArray(issue.received) ? 'an array' : isObject(issue.received) ? 'an object' : `a ${typeof issue.received}`
    const received = issue.public || issue.received === null ? JSON.stringify(issue.received) : kind
    return `\`${issue.path}\` (\`${issue.env}\`) must be ${issue.expected}, but received ${received}.`
  }).join('\n  - ')
}

function coerce (raw: string, node: RuntimeConfigSchemaNode): unknown {
  switch (node) {
    case 's':
      return raw
    case 'n':
    case 'i': {
      const number = raw.trim() ? Number(raw) : Number.NaN
      return Number.isFinite(number) && (node === 'n' || Number.isInteger(number)) ? number : INVALID
    }
    case 'b':
      return BOOLEANS[raw.trim().toLowerCase()] ?? INVALID
    case 'z':
      return raw === 'null' ? null : INVALID
    case '*': {
      const parsed = parseJSON(raw)
      return parsed === INVALID ? raw : parsed
    }
  }
  if ('e' in node) {
    const index = node.e.findIndex(value => typeof value === 'string' ? value === raw : JSON.stringify(value) === raw.trim())
    return index === -1 ? INVALID : node.e[index]
  }
  if ('o' in node) {
    for (const member of node.o) {
      const value = coerce(raw, member)
      if (value !== INVALID && ((isObject(value) && typeof member === 'object' && 'p' in member) || check(value, member))) {
        return value
      }
    }
    return INVALID
  }
  const parsed = parseJSON(raw)
  return ('a' in node ? Array.isArray(parsed) : isObject(parsed)) ? parsed : INVALID
}

function check (value: unknown, node: RuntimeConfigSchemaNode): boolean {
  switch (node) {
    case 's':
      return typeof value === 'string'
    case 'n':
      return typeof value === 'number' && Number.isFinite(value)
    case 'i':
      return Number.isInteger(value)
    case 'b':
      return typeof value === 'boolean'
    case 'z':
      return value === null
    case '*':
      return true
  }
  if ('e' in node) {
    const serialized = JSON.stringify(value)
    return node.e.some(member => JSON.stringify(member) === serialized)
  }
  if ('o' in node) {
    return node.o.some(member => check(value, member))
  }
  if ('a' in node) {
    return Array.isArray(value) && value.every(item => check(item, node.a))
  }
  if (!isObject(value)) {
    return false
  }
  for (const key in node.p) {
    if (value[key] === undefined ? node.r?.includes(key) : !check(value[key], node.p[key]!)) {
      return false
    }
  }
  return true
}

function findObjectNode (node: RuntimeConfigSchemaNode, value: Record<string, unknown>): RuntimeConfigSchemaObject | undefined {
  if (typeof node === 'object' && 'o' in node) {
    const members = node.o.filter(isObjectNode)
    return members.find(member => check(value, member)) ?? members[0]
  }
}

function isObjectNode (node: RuntimeConfigSchemaNode): node is RuntimeConfigSchemaObject {
  return typeof node === 'object' && 'p' in node
}

function describe (node: RuntimeConfigSchemaNode): string {
  switch (node) {
    case 's': return 'string'
    case 'n': return 'number'
    case 'i': return 'integer'
    case 'b': return 'boolean'
    case 'z': return 'null'
    case '*': return 'any'
  }
  if ('e' in node) {
    return node.e.map(value => JSON.stringify(value)).join(' | ')
  }
  if ('o' in node) {
    return node.o.map(describe).join(' | ')
  }
  if ('a' in node) {
    return 'array'
  }
  return 'object'
}

const SEPARATORS = new Set(['-', '_', '/', '.'])
const DIGIT_RE = /\d/

/** Convert a key to the name of its environment variable. */
export function toEnvKey (key: string): string {
  const words: string[] = []
  let word = ''
  let upper: boolean | undefined
  let started = false
  for (const char of key) {
    if (SEPARATORS.has(char)) {
      words.push(word)
      word = ''
      upper = undefined
      continue
    }
    const charUpper = DIGIT_RE.test(char) ? undefined : char !== char.toLowerCase()
    if (started && upper === false && charUpper === true) {
      words.push(word)
      word = char
    } else if (started && upper === true && charUpper === false && word.length > 1) {
      words.push(word.slice(0, -1))
      word = word.at(-1)! + char
    } else {
      word += char
      started = true
    }
    upper = charUpper
  }
  words.push(word)
  return words.join('_').toUpperCase()
}

function merge (base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base }
  for (const key in override) {
    if (key !== '__proto__') {
      const value = override[key]
      result[key] = isObject(result[key]) && isObject(value) ? merge(result[key], value) : value
    }
  }
  return result
}

function parseJSON (raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return INVALID
  }
}

export function isObject (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
