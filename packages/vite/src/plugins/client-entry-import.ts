import escapeStringRegexp from 'escape-string-regexp'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { Plugin, ResolvedConfig } from 'vite'
import { resolveClientEntry } from '../utils/config.ts'

const NO_MATCH_RE = /^$/

/** Import `specifier` at the top of the client entry, when `isEnabled` is true for the resolved config. */
export function ClientEntryImportPlugin (name: string, specifier: string, isEnabled: (config: ResolvedConfig) => boolean = () => true): Plugin {
  // the filter is read by the bundler when the build starts, after `configResolved` narrows it to the entry
  const filter = { id: NO_MATCH_RE }
  return {
    name,
    applyToEnvironment: environment => environment.name === 'client',
    configResolved (config) {
      let entry: string | undefined
      try {
        entry = isEnabled(config) ? resolveClientEntry(config) : undefined
      } catch {
        console.debug(`[${name}] Could not resolve client entry, \`${specifier}\` will not be imported.`)
      }
      filter.id = entry ? new RegExp(`^${escapeStringRegexp(entry)}(?:\\?.*)?$`) : NO_MATCH_RE
    },
    transform: {
      filter,
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        s.prepend(`import ${JSON.stringify(specifier)};\n`)
        return generateTransform(s, id)
      },
    },
  }
}

export function ModulePreloadPolyfillPlugin (): Plugin {
  return ClientEntryImportPlugin('nuxt:module-preload-polyfill', 'vite/modulepreload-polyfill', config => config.build.modulePreload !== false && config.build.modulePreload.polyfill !== false)
}
