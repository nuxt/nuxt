import type { RuntimeConfigSchemaNode, RuntimeConfigSchemaObject } from '@nuxt/schema/internal'
import type { RuntimeConfigIssue } from './schema'
import { isObject } from './schema'
import { prerenderDiagnostics } from './diagnostics'

/**
 * Guard the missing required values of the runtime config, so that reading one while prerendering
 * reports `NUXT_E8015` and throws. Objects containing a missing value are replaced with a proxy.
 */
export function guardMissingRuntimeConfig<T extends Record<string, unknown>> (config: T, schema: RuntimeConfigSchemaObject, issues: RuntimeConfigIssue[]): T {
  const missing = new Map(issues.map(issue => [issue.path, issue]))
  return guard(config, [schema], missing, new Map(), '')
}

function guard<T extends Record<string, unknown>> (value: T, nodes: RuntimeConfigSchemaObject[], missing: Map<string, RuntimeConfigIssue>, errors: Map<string, Error>, path: string): T {
  let guarded = false
  const target = value as Record<string, unknown>
  for (const node of nodes) {
    for (const key in node.p) {
      const childPath = path ? `${path}.${key}` : key
      const child = target[key]
      if (missing.has(childPath) && child === undefined) {
        guarded = true
      } else if (isObject(child)) {
        const members = objectMembers(node.p[key]!)
        if (members.length) {
          target[key] = guard(child, members, missing, errors, childPath)
        }
      }
    }
  }
  if (!guarded) {
    return value
  }
  return new Proxy(value, {
    get (target, key, receiver) {
      const issue = typeof key === 'string' && target[key] === undefined ? missing.get(path ? `${path}.${key}` : key) : undefined
      if (!issue) {
        return Reflect.get(target, key, receiver)
      }
      let error = errors.get(issue.path)
      if (!error) {
        error = prerenderDiagnostics.NUXT_E8015({ path: issue.path, env: issue.env }, { method: 'error' })
        errors.set(issue.path, error)
      }
      throw error
    },
  })
}

function objectMembers (node: RuntimeConfigSchemaNode): RuntimeConfigSchemaObject[] {
  if (typeof node !== 'object') {
    return []
  }
  if ('p' in node) {
    return [node]
  }
  return 'o' in node ? node.o.flatMap(objectMembers) : []
}
