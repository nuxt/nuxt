import { fileURLToPath } from 'node:url'
import { captureRawStackTrace, parseRawStackTrace } from 'errx'
import { definePlugin } from 'nitro'

import { serverDiagnostics } from '../diagnostics'
import { legacyCompat } from '#nuxt-compat/flags'

const RESPONSE_HOOK_FIX = 'Use the Nitro v3 `response` hook, which receives the built `Response` and can return a new one.'

const UNEMITTED_HOOKS: Record<string, string> = {
  'render:before': 'To respond before a page renders, return a `Response` from a server middleware instead.',
  ...!legacyCompat && {
    'render:response': RESPONSE_HOOK_FIX,
    'beforeResponse': RESPONSE_HOOK_FIX,
    'afterResponse': RESPONSE_HOOK_FIX,
  },
}

const PACKAGE_FIX = 'Update the package to a version that supports Nuxt 5, or report the issue to its maintainers.'

const INTERNAL_FRAME_RE = /[\\/]hookable[\\/]|[\\/]nitro-server[\\/](?:dist|src)[\\/]runtime[\\/]/
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

function findCaller (): string | undefined {
  for (const { source } of parseRawStackTrace(captureRawStackTrace() || '')) {
    if (source && source !== import.meta.url && !INTERNAL_FRAME_RE.test(source)) {
      return source.startsWith('file:') ? fileURLToPath(source) : source
    }
  }
}
