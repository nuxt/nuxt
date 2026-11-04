import type { Nuxt } from '@nuxt/schema'
import { directoryToURL } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'

/**
 * Pin the packages that hold global vue state (`currentInstance`, reactivity
 * internals, injection keys) to a single resolved entry.
 */
export function resolveVueAliases (nuxt: Nuxt, isServer: boolean): Record<string, string> {
  const aliases: Record<string, string> = {}
  const from = [directoryToURL(nuxt.options.rootDir), directoryToURL(nuxt.options.workspaceDir), import.meta.url]
  const conditions = isServer ? ['node', 'import', 'default'] : ['browser', 'import', 'default']
  for (const pkg of ['@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity', '@vue/shared', '@vue/runtime-vapor', 'vue-router']) {
    const entry = resolveModulePath(pkg, { from, conditions, try: true })
    if (entry) {
      aliases[`${pkg}$`] = entry
    }
  }
  return aliases
}
