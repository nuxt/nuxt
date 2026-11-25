import { readFileSync } from 'node:fs'
import { SourceMap } from 'node:module'
import { fileURLToPath } from 'node:url'
import { captureRawStackTrace, parseRawStackTrace } from 'errx'
import { definePlugin } from 'nitro'

import { serverDiagnostics } from '../diagnostics'
import { legacyCompat } from '#nuxt-compat/flags'

const RESPONSE_HOOK_FIX = 'Use the Nitro v3 `response` hook, which receives the built `Response` and can return a new one.'

const UNEMITTED_HOOKS: Record<string, string> = {
  ...!legacyCompat && {
    'render:before': 'To respond before a page renders, return a `Response` from a server middleware instead.',
    'render:response': RESPONSE_HOOK_FIX,
    'beforeResponse': RESPONSE_HOOK_FIX,
    'afterResponse': RESPONSE_HOOK_FIX,
  },
}

const PACKAGE_FIX = 'Update the package to a version that supports Nitro v3, or report the issue to its maintainers.'

const INTERNAL_FRAME_RE = /[\\/]hookable[\\/]|[\\/]nitro(?:-v3)?-server[\\/](?:dist|src)[\\/]runtime[\\/]/
const NODE_MODULES_RE = /^.*[\\/]node_modules[\\/]/

// TODO: remove in Nuxt 6, with `NUXT_E8013`
/** Reports listeners registered for Nitro v2 hooks that are not emitted. */
export default definePlugin((nitroApp) => {
  const hooks = nitroApp.hooks as { hook: (name: string, fn: (...args: any[]) => any) => () => void } | undefined
  if (!hooks) {
    return
  }
  const register = hooks.hook.bind(hooks)
  const reported = new Set<string>()
  hooks.hook = (name, fn) => {
    const fix = UNEMITTED_HOOKS[name]
    if (fix) {
      const caller = findCaller()
      const key = `${name} ${caller}`
      if (!reported.has(key)) {
        reported.add(key)
        const fromPackage = !!caller && NODE_MODULES_RE.test(caller)
        serverDiagnostics.NUXT_E8013({
          hook: name,
          location: caller?.replace(NODE_MODULES_RE, ''),
          fix: fromPackage ? PACKAGE_FIX : fix,
        })
      }
    }
    return register(name, fn)
  }
})

/** The directory of the server build this plugin is bundled into. */
const BUILD_DIR_URL = new URL('.', import.meta.url).href

const sourceMaps = new Map<string, { map: SourceMap, url: URL } | undefined>()

function findCaller (): string | undefined {
  for (const { source, line, column } of parseRawStackTrace(captureRawStackTrace() || '')) {
    const original = source?.startsWith(BUILD_DIR_URL) ? toOriginalSource(source, line, column) : source
    if (original && original !== import.meta.url && !original.startsWith('node:') && !INTERNAL_FRAME_RE.test(original)) {
      return original.startsWith('file:') ? fileURLToPath(original) : original
    }
  }
}

/** The file a position in the server build was compiled from, read from the build's source map. */
function toOriginalSource (file: string, line = 0, column = 0): string {
  if (!sourceMaps.has(file)) {
    sourceMaps.set(file, loadSourceMap(file))
  }
  const loaded = sourceMaps.get(file)
  const source = loaded && line && column ? (loaded.map.findEntry(line - 1, column - 1) as { originalSource?: string }).originalSource : undefined
  return source ? new URL(source.replace(/[%#?]/g, encodeURIComponent), loaded!.url).href : file
}

function loadSourceMap (file: string): { map: SourceMap, url: URL } | undefined {
  try {
    const url = new URL(`${file}.map`)
    return { map: new SourceMap(JSON.parse(readFileSync(url, 'utf8'))), url }
  } catch {
    return undefined
  }
}
