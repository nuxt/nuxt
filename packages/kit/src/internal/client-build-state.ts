import type { Nuxt } from '@nuxt/schema'

import { useNuxt } from '../context.ts'

/**
 * State the client build leaves in memory for the server build to read, as opposed to
 * the files it emits. A build cache hit skips the client build, so the cache saves this
 * state with the client files and restores it before the server build reads it.
 *
 * @internal
 */
export interface ClientBuildState<T = unknown> {
  /** Return the state as JSON-serialisable data, once the build has finished. */
  save: () => T
  /** Put back what `save()` returned in an earlier build, in place of a client build. */
  restore: (state: T) => void
}

const clientBuildStates = new WeakMap<Nuxt, Map<string, ClientBuildState<any>>>()

/**
 * Register client build state under a key unique to the plugin that owns it.
 *
 * @internal
 */
export function addClientBuildState<T> (key: string, state: ClientBuildState<T>, nuxt: Nuxt = useNuxt()): void {
  let states = clientBuildStates.get(nuxt)
  if (!states) {
    states = new Map()
    clientBuildStates.set(nuxt, states)
  }
  states.set(key, state)
}

/** @internal */
export function saveClientBuildState (nuxt: Nuxt = useNuxt()): Record<string, unknown> {
  const saved: Record<string, unknown> = {}
  for (const [key, state] of clientBuildStates.get(nuxt) ?? []) {
    saved[key] = state.save()
  }
  return saved
}

/** @internal */
export function restoreClientBuildState (saved: Record<string, unknown>, nuxt: Nuxt = useNuxt()): void {
  for (const [key, state] of clientBuildStates.get(nuxt) ?? []) {
    if (key in saved) {
      state.restore(saved[key])
    }
  }
}
