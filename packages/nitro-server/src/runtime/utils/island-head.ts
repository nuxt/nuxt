import type { HeadTag, SerializableHead } from '@unhead/vue/types'
import { SafeInputPlugin } from '@unhead/vue/plugins'
import { createHead } from '@unhead/vue/server'
import { VueResolver, resolveTags, walkResolver } from '@unhead/vue/utils'

const TAG_CONFIG_KEYS = ['key', 'tagPosition', 'tagPriority'] as const

/**
 * Apply the `useHeadSafe` allowlist to resolved head input, returning input that renders
 * the same tags when pushed without it.
 */
export function toSafeHeadInput (input: SerializableHead): SerializableHead {
  const { titleTemplate, ...rest } = input as SerializableHead & { titleTemplate?: unknown }
  const head = createHead({ disableDefaults: true, plugins: [SafeInputPlugin] })
  head.push(rest, { _safe: true })

  const safe: Record<string, any> = {}
  if (typeof titleTemplate === 'string' || titleTemplate === null) {
    safe.titleTemplate = titleTemplate
  }
  for (const tag of resolveTags(head)) {
    if (tag.tag === 'title') {
      safe.title = tag.textContent
      continue
    }
    const value = toInputValue(tag)
    if (tag.tag === 'htmlAttrs' || tag.tag === 'bodyAttrs' || tag.tag === 'base') {
      safe[tag.tag] = value
    } else {
      (safe[tag.tag] ||= []).push(value)
    }
  }
  return safe
}

/**
 * Merge resolved head entries into a single serializable head input for an island response.
 */
export function mergeIslandHead (entries: Iterable<{ input: unknown, options?: { _safe?: boolean } }>): SerializableHead {
  const islandHead: Record<string, any> = {}
  for (const entry of entries) {
    const input = walkResolver(entry.input, VueResolver) as SerializableHead
    for (const [key, value] of Object.entries(entry.options?._safe ? toSafeHeadInput(input) : input)) {
      const currentValue = islandHead[key]
      if (Array.isArray(currentValue)) {
        currentValue.push(...value)
      } else {
        islandHead[key] = Array.isArray(value) ? [...value] : value
      }
    }
  }
  return islandHead
}

function toInputValue (tag: HeadTag): Record<string, unknown> {
  const value: Record<string, unknown> = {}
  for (const [name, prop] of Object.entries(tag.props as Record<string, unknown>)) {
    value[name] = prop instanceof Set
      ? [...prop].join(' ')
      : prop instanceof Map
        ? [...prop].map(([property, propertyValue]) => `${property}:${propertyValue}`).join(';')
        : prop
  }
  if (tag.textContent !== undefined) {
    value.textContent = tag.textContent
  }
  for (const key of TAG_CONFIG_KEYS) {
    if (tag[key] !== undefined) {
      value[key] = tag[key]
    }
  }
  return value
}
