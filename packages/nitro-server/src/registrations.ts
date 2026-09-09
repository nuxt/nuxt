import { normalize } from 'pathe'
import { resolveAlias } from '@nuxt/kit'
import type { Nuxt, ServerPlugin } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'

/**
 * Write the server plugins gathered on `nuxt.options._serverPlugins`, which carry the server
 * API each was registered for, into the plain paths nitro takes.
 */
export function collectServerRegistrations (nuxt: Nuxt, nitroConfig: NitroConfig): void {
  nitroConfig.plugins ||= []
  for (const entry of (nuxt.options._serverPlugins || []) as ServerPlugin[]) {
    const path = normalize(resolveAlias(entry.plugin, nuxt.options.alias))
    if (!nitroConfig.plugins.includes(path)) {
      nitroConfig.plugins.push(path)
    }
  }
}
