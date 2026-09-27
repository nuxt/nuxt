import { normalize } from 'pathe'
import { resolveAlias } from '@nuxt/kit'
import { kServerApi, kUnusedVariants } from '@nuxt/kit/internal'
import type { Nuxt, ServerApi, ServerPlugin } from '@nuxt/schema'
import type { NitroConfig } from 'nitro/types'

/** The server API a registration was resolved for, when the module named one. */
export function serverApiOf (entry: object | undefined): ServerApi | undefined {
  return (entry as Record<symbol, ServerApi | undefined> | undefined)?.[kServerApi]
}

function unusedVariantsOf (entry: object): unknown[] {
  return (entry as Record<symbol, unknown[] | undefined>)[kUnusedVariants] || []
}

/**
 * Write the server plugins Nuxt gathered into the nitro config, and return the paths of the
 * variants this build does not use: they sit next to the ones in use, so the compatibility
 * layer has to know not to read them.
 */
export function collectServerRegistrations (nuxt: Nuxt, nitroConfig: NitroConfig): string[] {
  const unused = new Set<string>()

  const collectUnused = (entry: object) => {
    for (const variant of unusedVariantsOf(entry)) {
      if (typeof variant === 'string') {
        unused.add(variant)
      }
    }
  }

  for (const entry of nitroConfig.handlers || []) {
    collectUnused(entry)
  }
  for (const entry of nuxt.options.devServerHandlers) {
    collectUnused(entry)
  }

  nitroConfig.plugins ||= []
  for (const entry of (nuxt.options._serverPlugins || []) as ServerPlugin[]) {
    for (const variant of entry.unused || []) {
      unused.add(variant)
    }
    const path = normalize(resolveAlias(entry.plugin, nuxt.options.alias))
    if (!nitroConfig.plugins.includes(path)) {
      nitroConfig.plugins.push(path)
    }
    if (entry.compatibility === 'nitro3' || entry.compatibility === 'nuxt') {
      migratedPlugins(nuxt).add(path)
    }
  }

  return [...unused]
}

const migrated = new WeakMap<Nuxt, Set<string>>()

/**
 * Plugin paths registered for a server API that has left nitro v2 behind, so that the
 * compatibility layer leaves them alone.
 * @internal
 */
export function migratedPlugins (nuxt: Nuxt): Set<string> {
  let paths = migrated.get(nuxt)
  if (!paths) {
    paths = new Set()
    migrated.set(nuxt, paths)
  }
  return paths
}
