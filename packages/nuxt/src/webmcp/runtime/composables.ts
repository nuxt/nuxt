import type { InjectionKey, MaybeRefOrGetter } from 'vue'
import { computed, getCurrentInstance, getCurrentScope, inject, onActivated, onBeforeUnmount, onDeactivated, onMounted, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { AgentToolActivity, AgentToolContext, AgentToolDefinition, AgentToolRegistry, AgentToolTarget } from './registry'

export type { AgentToolActivity, AgentToolAnnotations, AgentToolContext, AgentToolDefinition, AgentToolResult, AgentToolTarget, StandardSchemaV1 } from './registry'

export const agentToolRegistryKey: InjectionKey<AgentToolRegistry> = Symbol('nuxt:agent-tools')

/**
 * Define a tool an agent can call through WebMCP. Activate it with `useAgentTool`.
 * @since 4.7.0
 */
export function defineAgentTool<I = Record<string, unknown>> (definition: AgentToolDefinition<I>): AgentToolDefinition<I> {
  return definition
}

export interface UseAgentToolOptions<I, T> {
  /** Evaluated on each call; a disabled tool stays registered and returns an error. */
  enabled?: MaybeRefOrGetter<boolean>
  /** Items the agent can choose between. The tool is unavailable while the list is empty. */
  targets?: MaybeRefOrGetter<T[]>
  /** A stable key for each target. Defaults to `item.id`. */
  key?: (item: T) => string | number
  /** What the agent reads to tell targets apart. Defaults to the key. */
  label?: (item: T) => string
  execute?: (input: I, ctx: AgentToolContext<T> & { target?: AgentToolTarget<T> & { item: T } }) => unknown
}

/**
 * Offer a tool to agents while the calling component is mounted (and active, inside `<KeepAlive>`).
 * @since 4.7.0
 */
export function useAgentTool<I, T = never> (definition: AgentToolDefinition<I>, options: UseAgentToolOptions<I, T> = {}): void {
  const registry = inject(agentToolRegistryKey, null)
  if (!registry) {
    return
  }
  let handle: { dispose: () => void } | undefined
  const { enabled, targets, key, label, execute } = options
  const activate = () => {
    handle ??= registry.activate(definition, {
      enabled: enabled === undefined ? undefined : () => toValue(enabled),
      targets: targets && (() => toValue(targets).map((item) => {
        const id = String(key ? key(item) : (item as { id?: unknown }).id)
        return { key: id, label: label ? label(item) : id, item }
      })),
      execute: execute as never,
    })
  }
  const deactivate = () => {
    handle?.dispose()
    handle = undefined
  }
  let live = false
  const sync = () => live && (!targets || toValue(targets).length) ? activate() : deactivate()
  const setLive = (value: boolean) => () => {
    live = value
    sync()
  }
  onMounted(setLive(true))
  onActivated(setLive(true))
  onDeactivated(setLive(false))
  onBeforeUnmount(setLive(false))
  if (targets) {
    watch(() => toValue(targets).length > 0, sync)
  }
}

/**
 * Tool calls in progress, for showing the user what an agent is doing and letting them stop it.
 * @since 4.7.0
 */
export function useAgentActivity () {
  const registry = inject(agentToolRegistryKey, null)
  const activities = shallowRef<AgentToolActivity[]>([])
  if (registry) {
    let dispose: (() => void) | undefined
    const subscribe = () => {
      dispose = registry.onActivity((list) => {
        activities.value = list
      })
    }
    if (getCurrentInstance()) {
      onMounted(subscribe)
    } else {
      subscribe()
    }
    if (getCurrentScope()) {
      onScopeDispose(() => dispose?.())
    }
  }
  return {
    activities,
    current: computed(() => activities.value.at(-1)),
    stop: () => activities.value.forEach(a => a.stop()),
  }
}
