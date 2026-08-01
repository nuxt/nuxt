import type { NuxtSSRContext } from '#app/types'
import { serverDiagnostics } from '../../diagnostics'

const SSR_CLIENT_TELEPORT_RE = /^uid=[^;]*;client=/

export function detectClientScriptReliance (ssrContext: NuxtSSRContext): string[] {
  const reasons: string[] = []
  if (ssrContext['~lazyHydratedModules']?.size) {
    reasons.push('it uses lazy hydration strategies, which require client-side JavaScript to hydrate')
  }
  if (ssrContext.teleports) {
    for (const key in ssrContext.teleports) {
      if (SSR_CLIENT_TELEPORT_RE.test(key)) {
        reasons.push('it renders a server component with a `nuxt-client` child, which requires client-side JavaScript to hydrate')
        break
      }
    }
  }
  return reasons
}

const warnedPaths = new Set<string>()

export function warnNoScriptsClientReliance (ssrContext: NuxtSSRContext, path: string): void {
  if (warnedPaths.has(path)) { return }
  const reasons = detectClientScriptReliance(ssrContext)
  if (!reasons.length) { return }
  warnedPaths.add(path)
  serverDiagnostics.NUXT_E8007({ path, reasons: reasons.join('\n  - ') })
}
