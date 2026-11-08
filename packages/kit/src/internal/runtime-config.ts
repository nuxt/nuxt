import process from 'node:process'
import destr from 'destr'
import { defu } from 'defu'
import { klona } from 'klona'
import { snakeCase } from 'scule'
import type { NitroConfig, Nuxt, RuntimeConfigSchema } from '@nuxt/schema'
import type { RuntimeConfigSchemaEntry, RuntimeConfigSchemaNode, RuntimeConfigSchemaObject } from '@nuxt/schema/internal'

import { applyRuntimeConfigSchema } from '../../../nuxt/src/runtime/server/runtime-config/schema.ts'
import type { RuntimeConfigIssue } from '../../../nuxt/src/runtime/server/runtime-config/schema.ts'
import { configDiagnostics } from '../diagnostics/config.ts'

type JSONSchema = Record<string, unknown>

/** A schema merged with a plain value from a layer with higher priority, which becomes its default. */
const DEFAULT_KEY = '~nuxtRuntimeConfigDefault'

interface SchemaWithDefault {
  [DEFAULT_KEY]: unknown
  schema: RuntimeConfigSchema
}

export function isRuntimeConfigSchema (value: unknown): value is RuntimeConfigSchema {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && '~standard' in value
}

function isSchemaWithDefault (value: unknown): value is SchemaWithDefault {
  return isPlainObject(value) && DEFAULT_KEY in value
}

/**
 * Merge two layers' values for a key within `runtimeConfig` when either is a schema, for the
 * merger that combines layers. A schema in the higher-priority layer replaces the lower one;
 * a plain value in the higher-priority layer becomes the default of a schema below it.
 *
 * Returns `undefined` when neither value is a schema.
 */
export function mergeRuntimeConfigSchemas (higher: unknown, lower: unknown): unknown {
  if (isRuntimeConfigSchema(higher)) {
    return higher
  }
  if (isSchemaWithDefault(higher)) {
    const lowerValue = isRuntimeConfigSchema(lower) ? undefined : isSchemaWithDefault(lower) ? lower[DEFAULT_KEY] : lower
    return { ...higher, [DEFAULT_KEY]: mergeDefaults(higher[DEFAULT_KEY], lowerValue) }
  }
  if (isRuntimeConfigSchema(lower)) {
    return { schema: lower, [DEFAULT_KEY]: higher } satisfies SchemaWithDefault
  }
  if (isSchemaWithDefault(lower)) {
    return { ...lower, [DEFAULT_KEY]: mergeDefaults(higher, lower[DEFAULT_KEY]) }
  }
}

function mergeDefaults (higher: unknown, lower: unknown): unknown {
  return isPlainRecord(higher) && isPlainRecord(lower) ? defu(higher, lower) : higher ?? lower
}

/**
 * Replace each schema within `runtimeConfig` with its default value, returning the plain
 * config alongside the schemas and the paths they were declared at.
 */
export function extractRuntimeConfigSchemas (runtimeConfig: unknown): { config: unknown, entries: RuntimeConfigSchemaEntry[] } {
  const entries: RuntimeConfigSchemaEntry[] = []
  const config = extract(runtimeConfig, [], (schema, path, configured) => {
    const compiled = compileRuntimeConfigSchema(schema, path)
    if (!path.length && !isObjectNode(compiled.node)) {
      throw configDiagnostics.NUXT_B5031({ path: 'runtimeConfig', error: 'a schema for the whole runtime config must describe a single object' })
    }
    const resolved = mergeDefaults(configured, compiled.value)
    entries.push({ path, node: compiled.node, required: resolved === undefined && compiled.required })
    return resolved
  })
  return { config, entries }
}

/**
 * Replace each schema within `update`, a runtime config update from a module, with its default
 * value, and register it in `entries`. A value already in `current` becomes the default of the
 * schema, and a schema declared in `nuxt.config` at the same path takes precedence.
 */
export function extractModuleRuntimeConfigSchemas (update: Record<string, unknown>, current: Record<string, unknown>, entries: RuntimeConfigSchemaEntry[]): Record<string, unknown> {
  return extract(update, [], (schema, path) => {
    const existing = getAt(current, path)
    const index = entries.findIndex(entry => entry.path.length === path.length && entry.path.every((key, i) => key === path[i]))
    if (index !== -1 && !entries[index]!.module) {
      return existing
    }
    const compiled = compileRuntimeConfigSchema(schema, path)
    const resolved = mergeDefaults(existing, compiled.value)
    const entry: RuntimeConfigSchemaEntry = { path, node: compiled.node, required: resolved === undefined && compiled.required, module: true }
    if (index === -1) {
      entries.push(entry)
    } else {
      configDiagnostics.NUXT_B5034({ path: ['runtimeConfig', ...path].join('.') })
      entries[index] = entry
    }
    return resolved
  }) as Record<string, unknown>
}

/**
 * Replace each schema within `update` with its default value, for a version of Nuxt without
 * runtime config schemas. A value already in `current` becomes the default of the schema.
 * Required values without a default become empty strings, so environment variables can still
 * override them.
 */
export function stripRuntimeConfigSchemas (update: Record<string, unknown>, current: Record<string, unknown>): Record<string, unknown> {
  return extract(update, [], (schema, path) => {
    const compiled = compileRuntimeConfigSchema(schema, path)
    const resolved = mergeDefaults(getAt(current, path), compiled.value)
    return resolved === undefined && !compiled.required ? undefined : fillRequired(resolved, compiled.node)
  }) as Record<string, unknown>
}

function fillRequired (value: unknown, node: RuntimeConfigSchemaNode | undefined): unknown {
  const object = typeof node === 'object' && 'p' in node ? node : undefined
  if (value === undefined) {
    return object ? fillRequired({}, object) : ''
  }
  if (!object || !isPlainObject(value)) {
    return value
  }
  const result = { ...value }
  for (const key of object.r ?? []) {
    result[key] = fillRequired(result[key], object.p[key])
  }
  return result
}

/** Find the path of the first schema within `runtimeConfig`, if any. */
export function findRuntimeConfigSchema (value: unknown, path: string[] = []): string[] | undefined {
  if (isRuntimeConfigSchema(value)) {
    return path
  }
  if (isPlainRecord(value)) {
    for (const key of Object.keys(value)) {
      const found = findRuntimeConfigSchema(value[key], [...path, key])
      if (found) {
        return found
      }
    }
  }
}

type SchemaHandler = (schema: RuntimeConfigSchema, path: string[], configured: unknown) => unknown

function extract (value: unknown, path: string[], onSchema: SchemaHandler): unknown {
  if (isRuntimeConfigSchema(value) || isSchemaWithDefault(value)) {
    const schema = isRuntimeConfigSchema(value) ? value : value.schema
    const configured = isSchemaWithDefault(value) ? extract(value[DEFAULT_KEY], path, onSchema) : undefined
    return onSchema(schema, path, configured)
  }
  if (!isPlainRecord(value)) {
    return value
  }
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(value)) {
    const child = extract(value[key], [...path, key], onSchema)
    if (child !== undefined || !(isRuntimeConfigSchema(value[key]) || isSchemaWithDefault(value[key]))) {
      result[key] = child
    }
  }
  return result
}

function getAt (value: unknown, path: string[]): unknown {
  for (const key of path) {
    value = isPlainObject(value) ? value[key] : undefined
  }
  return value
}

/**
 * Restore `null` defaults of schemas within a resolved `runtimeConfig`, where empty values
 * are otherwise replaced with empty strings or dropped.
 */
export function restoreRuntimeConfigSchemaNulls (target: Record<string, unknown>, config: unknown, entries: RuntimeConfigSchemaEntry[]): void {
  for (const { path } of entries) {
    let source = config
    let parent: unknown = target
    for (const key of path.slice(0, -1)) {
      source = isPlainObject(source) ? source[key] : undefined
      parent = isPlainObject(parent) ? parent[key] : undefined
    }
    const key = path.at(-1)
    if (key !== undefined && isPlainObject(source) && isPlainObject(parent)) {
      restoreNulls(parent, { [key]: source[key] })
    } else if (key === undefined) {
      restoreNulls(target, source)
    }
  }
}

function restoreNulls (target: Record<string, unknown>, source: unknown) {
  if (!isPlainObject(source)) {
    return
  }
  for (const key in source) {
    if (source[key] === null) {
      target[key] = null
    } else if (isPlainObject(target[key])) {
      restoreNulls(target[key], source[key])
    }
  }
}

/**
 * Convert a schema to a {@link RuntimeConfigSchemaNode}, and resolve its default value.
 */
export function compileRuntimeConfigSchema (schema: RuntimeConfigSchema, path: string[] = []): { node: RuntimeConfigSchemaNode, value: unknown, required: boolean } {
  const name = ['runtimeConfig', ...path].join('.')
  const standard = schema['~standard']
  if (typeof standard.jsonSchema?.output !== 'function') {
    throw configDiagnostics.NUXT_B5031({ path: name, error: 'it does not implement Standard JSON Schema' })
  }
  let json: JSONSchema
  try {
    json = standard.jsonSchema.output({ target: 'draft-2020-12' })
  } catch (error) {
    throw configDiagnostics.NUXT_B5031({ path: name, error: error instanceof Error ? error.message : undefined, cause: error })
  }
  const node = toNode(json, json, new Set())

  const validate = (value: unknown) => {
    const result = standard.validate(value)
    if (result instanceof Promise) {
      result.catch(() => {})
      throw configDiagnostics.NUXT_B5031({ path: name, error: 'it validates asynchronously' })
    }
    return result
  }
  const empty = validate(undefined)
  const optional = !empty.issues
  if (optional && (empty.value !== undefined || !isObjectNode(node))) {
    return { node, value: empty.value, required: false }
  }
  if (isObjectNode(node)) {
    const probed = probeDefault(node, json, validate)
    if (probed) {
      if (optional) {
        attachDefaults(node, probed.value)
      }
      probeOptionalDefaults(node, node, json, validate, probed, [])
    }
    if (optional || probed) {
      return { node, value: optional ? undefined : probed!.value, required: false }
    }
  }
  const value = jsonDefault(json, json)
  return { node, value, required: value === undefined }
}

interface Probe {
  value: unknown
  input: Record<string, unknown>
  placeholders: string[][]
}

function probeOptionalDefaults (root: RuntimeConfigSchemaObject, node: RuntimeConfigSchemaObject, json: JSONSchema, validate: (value: unknown) => ValidationResult, probed: Probe, path: string[]) {
  for (const key in node.p) {
    const child = node.p[key]!
    if (!isObjectNode(child)) {
      continue
    }
    const childPath = [...path, key]
    if (getAt(probed.value, childPath) !== undefined) {
      probeOptionalDefaults(root, child, json, validate, probed, childPath)
      continue
    }
    const input = structuredClone(probed.input)
    const parent = getAt(input, path)
    if (!isPlainObject(parent)) {
      continue
    }
    parent[key] = {}
    const result = probeDefault(root, json, validate, input, [...probed.placeholders])
    if (result) {
      attachDefaults(child, getAt(result.value, childPath))
      probeOptionalDefaults(root, child, json, validate, result, childPath)
    }
  }
}

function attachDefaults (node: RuntimeConfigSchemaObject, defaults: unknown) {
  if (isPlainObject(defaults) && Object.keys(defaults).length) {
    node.d = defaults
  }
}

type ValidationResult = ReturnType<RuntimeConfigSchema['~standard']['validate']> extends infer R ? Exclude<R, Promise<unknown>> : never

/**
 * Resolve the defaults of an object schema by validating it, with placeholders for the
 * values it requires. Defaults are not always part of the JSON Schema of a schema.
 */
function probeDefault (node: RuntimeConfigSchemaObject, json: JSONSchema, validate: (value: unknown) => ValidationResult, probe: Record<string, unknown> = {}, placeholders: string[][] = []): Probe | undefined {
  for (let attempt = 0; attempt < 32; attempt++) {
    const result = validate(structuredClone(probe))
    if (!result.issues) {
      for (const path of placeholders) {
        const parent = getAt(result.value, path.slice(0, -1))
        if (isPlainObject(parent)) {
          delete parent[path.at(-1)!]
        }
      }
      return { value: result.value, input: probe, placeholders }
    }
    let filled = false
    for (const issue of result.issues) {
      const path = issue.path?.map(segment => String(typeof segment === 'object' ? segment.key : segment))
      const parent = path?.length ? getAt(probe, path.slice(0, -1)) : undefined
      const child = path && nodeAt(node, path)
      if (!path || !child || !isPlainObject(parent) || path.at(-1)! in parent) {
        return
      }
      parent[path.at(-1)!] = placeholder(child, jsonAt(json, path))
      if (typeof child !== 'object' || !('p' in child)) {
        placeholders.push(path)
      }
      filled = true
    }
    if (!filled) {
      return
    }
  }
}

function nodeAt (node: RuntimeConfigSchemaNode, path: string[]): RuntimeConfigSchemaNode | undefined {
  let current: RuntimeConfigSchemaNode | undefined = node
  for (const key of path) {
    const object: RuntimeConfigSchemaNode | undefined = typeof current === 'object' && 'o' in current ? current.o.find(member => typeof member === 'object' && 'p' in member) : current
    current = typeof object === 'object' && 'p' in object ? object.p[key] : undefined
  }
  return current
}

function jsonAt (root: JSONSchema, path: string[]): JSONSchema | undefined {
  let current: JSONSchema | undefined = root
  for (const key of path) {
    const resolved = resolveJSON(root, current)
    const members = [resolved, ...[resolved?.allOf, resolved?.anyOf, resolved?.oneOf].flatMap(list => Array.isArray(list) ? list.map(member => resolveJSON(root, member)) : [])]
    const owner = members.find(member => isPlainObject(member?.properties) && isPlainObject(member.properties[key]))
    current = owner ? (owner.properties as Record<string, JSONSchema>)[key] : undefined
  }
  return resolveJSON(root, current)
}

function resolveJSON (root: JSONSchema, schema: unknown): JSONSchema | undefined {
  for (let depth = 0; isPlainObject(schema) && typeof schema.$ref === 'string' && depth < 32; depth++) {
    schema = resolveRef(root, schema.$ref)
  }
  return isPlainObject(schema) ? schema : undefined
}

function placeholder (node: RuntimeConfigSchemaNode, schema?: JSONSchema): unknown {
  if (typeof node === 'object') {
    return 'e' in node ? node.e[0] : 'o' in node ? placeholder(node.o[0]!) : 'a' in node ? [] : {}
  }
  if (node === 's') {
    return 'a'.repeat(typeof schema?.minLength === 'number' ? schema.minLength : 0)
  }
  if (node === 'n' || node === 'i') {
    const min = typeof schema?.minimum === 'number' ? schema.minimum : typeof schema?.exclusiveMinimum === 'number' ? schema.exclusiveMinimum + 1 : undefined
    const max = typeof schema?.maximum === 'number' ? schema.maximum : typeof schema?.exclusiveMaximum === 'number' ? schema.exclusiveMaximum - 1 : undefined
    return Math.ceil(min ?? Math.min(0, max ?? 0))
  }
  return node === 'b' ? false : null
}

function toNode (schema: unknown, root: JSONSchema, seen: Set<unknown>): RuntimeConfigSchemaNode {
  if (!isPlainObject(schema)) {
    return '*'
  }
  if (typeof schema.$ref === 'string') {
    const target = resolveRef(root, schema.$ref)
    if (!target || seen.has(target)) {
      return '*'
    }
    seen.add(target)
    const node = toNode(target, root, seen)
    seen.delete(target)
    return node
  }
  if ('const' in schema) {
    return { e: [schema.const] }
  }
  if (Array.isArray(schema.enum)) {
    return { e: schema.enum }
  }
  const variants = schema.anyOf ?? schema.oneOf
  if (Array.isArray(variants)) {
    return union(variants.map(variant => toNode(variant, root, seen)))
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.map(member => toNode(member, root, seen)).reduce(intersect, '*')
  }
  if (Array.isArray(schema.type)) {
    return union(schema.type.map(type => toNode({ ...schema, type }, root, seen)))
  }
  switch (schema.type) {
    case 'string': return 's'
    case 'number': return 'n'
    case 'integer': return 'i'
    case 'boolean': return 'b'
    case 'null': return 'z'
    case 'array': return { a: isPlainObject(schema.items) ? toNode(schema.items, root, seen) : '*' }
  }
  if (schema.type === 'object' || isPlainObject(schema.properties)) {
    const properties = isPlainObject(schema.properties) ? schema.properties : {}
    const p: Record<string, RuntimeConfigSchemaNode> = {}
    for (const key in properties) {
      p[key] = toNode(properties[key], root, seen)
    }
    const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string' && key in p) : []
    return withRequired({ p }, required)
  }
  return '*'
}

function jsonDefault (schema: unknown, root: JSONSchema, seen = new Set<unknown>(), required = true): unknown {
  if (!isPlainObject(schema) || seen.has(schema)) {
    return
  }
  if ('default' in schema) {
    return schema.default
  }
  seen = new Set(seen).add(schema)
  if (typeof schema.$ref === 'string') {
    return jsonDefault(resolveRef(root, schema.$ref), root, seen, required)
  }
  if (isPlainObject(schema.properties)) {
    if (!required) {
      return
    }
    const requiredKeys = Array.isArray(schema.required) ? schema.required : []
    const result: Record<string, unknown> = {}
    for (const key in schema.properties) {
      const value = jsonDefault(schema.properties[key], root, seen, requiredKeys.includes(key))
      if (value !== undefined) {
        result[key] = value
      }
    }
    return result
  }
}

function resolveRef (root: JSONSchema, ref: string): JSONSchema | undefined {
  if (ref === '#') {
    return root
  }
  if (!ref.startsWith('#/')) {
    return
  }
  let target: unknown = root
  for (const segment of ref.slice(2).split('/')) {
    target = isPlainObject(target) ? target[segment.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined
  }
  return isPlainObject(target) ? target : undefined
}

/** Describe a plain runtime config value by the type of its default. */
export function inferRuntimeConfigSchema (value: unknown): RuntimeConfigSchemaNode {
  switch (typeof value) {
    case 'string': return 's'
    case 'number': return 'n'
    case 'boolean': return 'b'
  }
  if (Array.isArray(value)) {
    return { a: value.length ? union(value.map(inferRuntimeConfigSchema)) : '*' }
  }
  if (isPlainRecord(value)) {
    const p: Record<string, RuntimeConfigSchemaNode> = {}
    for (const key in value) {
      p[key] = inferRuntimeConfigSchema(value[key])
    }
    return { p }
  }
  return '*'
}

/**
 * The schema of the whole runtime config: each value described by its default, apart from
 * the values declared with a schema. Without `infer`, only the declared values are described.
 */
export function getRuntimeConfigSchema (runtimeConfig: Record<string, unknown>, entries: RuntimeConfigSchemaEntry[] = [], { infer = true } = {}): RuntimeConfigSchemaObject {
  const { nitro: _nitro, ...config } = runtimeConfig
  let root: RuntimeConfigSchemaObject = infer ? inferRuntimeConfigSchema(config) as RuntimeConfigSchemaObject : { p: {} }
  for (const entry of [...entries].sort((a, b) => Number(!a.module) - Number(!b.module) || a.path.length - b.path.length)) {
    if (!entry.path.length) {
      root = isObjectNode(entry.node) ? overlay(root, entry.node) as RuntimeConfigSchemaObject : root
      continue
    }
    let parent = root
    for (const key of entry.path.slice(0, -1)) {
      const child = parent.p[key]
      parent = parent.p[key] = isObjectNode(child) ? { ...child, p: { ...child.p } } : { p: {} }
    }
    const key = entry.path.at(-1)!
    parent.p[key] = parent.p[key] ? overlay(parent.p[key], entry.node) : entry.node
    if (entry.required && !parent.r?.includes(key)) {
      parent.r = [...parent.r ?? [], key]
    } else if (!entry.required && parent.r?.includes(key)) {
      parent.r = parent.r.filter(name => name !== key)
    }
  }
  return root
}

function intersect (a: RuntimeConfigSchemaNode, b: RuntimeConfigSchemaNode): RuntimeConfigSchemaNode {
  if (isObjectNode(a) && isObjectNode(b)) {
    const p = { ...a.p }
    for (const key in b.p) {
      p[key] = p[key] ? intersect(p[key], b.p[key]!) : b.p[key]!
    }
    return withRequired({ p }, [...a.r ?? [], ...b.r ?? []])
  }
  const aEnum = typeof a === 'object' && 'e' in a ? a.e : undefined
  const bEnum = typeof b === 'object' && 'e' in b ? b.e : undefined
  if (aEnum && bEnum) {
    const serialized = new Set(bEnum.map(value => JSON.stringify(value)))
    return { e: aEnum.filter(value => serialized.has(JSON.stringify(value))) }
  }
  return aEnum || b === '*' ? a : b
}

function overlay (inferred: RuntimeConfigSchemaNode, declared: RuntimeConfigSchemaNode): RuntimeConfigSchemaNode {
  if (!isObjectNode(inferred) || !isObjectNode(declared)) {
    return declared
  }
  const p = { ...inferred.p }
  for (const key in declared.p) {
    p[key] = p[key] ? overlay(p[key], declared.p[key]!) : declared.p[key]!
  }
  return withRequired(declared.d ? { p, d: declared.d } : { p }, [...inferred.r ?? [], ...declared.r ?? []])
}

/**
 * Render a runtime config schema as a TypeScript type. A property is optional when it has
 * neither a value in `config` nor is required.
 */
export function runtimeConfigSchemaToType (node: RuntimeConfigSchemaNode, config: unknown, indent = ''): string {
  switch (node) {
    case 's': return 'string'
    case 'n':
    case 'i': return 'number'
    case 'b': return 'boolean'
    case 'z': return 'null'
    case '*': return 'any'
  }
  if ('e' in node) {
    return node.e.map(value => value === undefined ? 'undefined' : JSON.stringify(value)).join(' | ') || 'never'
  }
  if ('o' in node) {
    return node.o.map(member => runtimeConfigSchemaToType(member, config, indent)).join(' | ')
  }
  if ('a' in node) {
    return `Array<${runtimeConfigSchemaToType(node.a, undefined, indent)}>`
  }
  const values = isPlainObject(config) ? config : {}
  const lines = Object.keys(node.p).map((key) => {
    const optional = values[key] === undefined && !node.r?.includes(key)
    return `${indent}  ${IDENTIFIER_RE.test(key) ? key : JSON.stringify(key)}${optional ? '?' : ''}: ${runtimeConfigSchemaToType(node.p[key]!, values[key], `${indent}  `)},`
  })
  return lines.length ? `{\n${lines.join('\n')}\n${indent}}` : '{}'
}

const IDENTIFIER_RE = /^[a-z_$][\w$]*$/i

function union (nodes: RuntimeConfigSchemaNode[]): RuntimeConfigSchemaNode {
  const members: RuntimeConfigSchemaNode[] = []
  const seen = new Set<string>()
  for (const node of nodes.flatMap(node => typeof node === 'object' && 'o' in node ? node.o : [node])) {
    if (node === '*') {
      return '*'
    }
    const key = JSON.stringify(node)
    if (!seen.has(key)) {
      seen.add(key)
      members.push(node)
    }
  }
  return members.length === 1 ? members[0]! : { o: members }
}

function withRequired (node: RuntimeConfigSchemaObject, required: string[]): RuntimeConfigSchemaObject {
  if (required.length) {
    node.r = [...new Set(required)]
  }
  return node
}

function isObjectNode (node: RuntimeConfigSchemaNode | undefined): node is RuntimeConfigSchemaObject {
  return typeof node === 'object' && 'p' in node
}

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPlainRecord (value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

/**
 * Apply the current environment to the runtime config, returning it alongside the values
 * that do not match their schema.
 */
export function resolveRuntimeConfig (nuxt: Nuxt): { config: Record<string, any>, issues: RuntimeConfigIssue[] } {
  const runtimeConfig = (nuxt.options.nitro as NitroConfig).runtimeConfig as Record<string, unknown>
  const config = klona(runtimeConfig)
  const options = {
    env: process.env,
    prefix: 'NITRO_',
    altPrefix: (runtimeConfig.nitro as { envPrefix?: string } | undefined)?.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? 'NUXT_',
    envExpansion: nuxt.options.nitro.experimental?.envExpansion ?? !!process.env.NITRO_ENV_EXPANSION,
  }
  if (!supportsRuntimeConfigSchemas(nuxt)) {
    return { config: applyEnv(config, options), issues: [] }
  }
  const infer = (nuxt.options.future?.compatibilityVersion ?? 4) >= 5
  const schema = getRuntimeConfigSchema(runtimeConfig, nuxt.options._runtimeConfigSchemas, { infer })
  const issues = applyRuntimeConfigSchema(config, schema, options)
  if (!infer) {
    applyEnv(config, options, schema)
  }
  return { config, issues }
}

export function supportsRuntimeConfigSchemas (nuxt: Nuxt): nuxt is Nuxt & { options: { _runtimeConfigSchemas: NonNullable<Nuxt['options']['_runtimeConfigSchemas']> } } {
  return Array.isArray(nuxt.options._runtimeConfigSchemas)
}

interface EnvOptions {
  prefix: string
  altPrefix: string
  envExpansion?: boolean
}

/**
 * Apply environment variables as Nitro does without runtime config schemas, casting each value
 * with `destr`. Values that `schema` describes are left as they are.
 */
function applyEnv (obj: Record<string, any>, opts: EnvOptions, schema?: RuntimeConfigSchemaNode, parentKey = '') {
  for (const key in obj) {
    const node = typeof schema === 'object' && 'p' in schema ? schema.p[key] : undefined
    if (node && !(typeof node === 'object' && 'p' in node)) {
      continue
    }
    const subKey = parentKey ? `${parentKey}_${key}` : key
    const envKey = snakeCase(subKey).toUpperCase()
    const envValue = destr(process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey])
    if (isObject(obj[key])) {
      if (isObject(envValue)) {
        const described = typeof node === 'object' && 'p' in node ? node.p : {}
        obj[key] = { ...obj[key], ...Object.fromEntries(Object.entries(envValue).filter(([child]) => !Object.hasOwn(described, child))) }
        applyEnv(obj[key], opts, node, subKey)
      } else if (envValue === undefined) {
        applyEnv(obj[key], opts, node, subKey)
      } else {
        obj[key] = envValue ?? obj[key]
      }
    } else {
      obj[key] = envValue ?? obj[key]
    }
    if (opts.envExpansion && typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(ENV_EXPANSION_RE, (match: string, name: string) => process.env[name] || match)
    }
  }
  return obj
}

const ENV_EXPANSION_RE = /\{\{([^{}]*)\}\}/g

function isObject (value: unknown): value is Record<string, any> {
  return typeof value === 'object' && !Array.isArray(value)
}
