import type { NuxtSSRContext } from '#app/types'
import { ValidatePlugin } from '@unhead/vue/plugins'
import { serverDiagnostics } from '../../diagnostics'

// one E8008 per path, or dev output drowns
const warnedPaths = import.meta.dev ? new Set<string>() : undefined

/**
 * Dev-only: warn when tags miss the streaming shell and become client
 * patches bots never see.
 *
 * unhead's rule knows what actually ships as a patch, so it stays accurate
 * where a hand-rolled scan drifts.
 */
export function registerStreamedHeadWarning (head: NuxtSSRContext['head'], path: string): void {
  if (!import.meta.dev) { return }
  head.use(ValidatePlugin({
    only: ['streamed-tag-hidden-from-bots'],
    key: 'validate-streaming',
    onReport: (rules) => {
      if (warnedPaths?.has(path)) { return }
      const kinds = new Set(rules.map(rule => rule.tag?.tag).filter(Boolean))
      if (!kinds.size) { return }
      warnedPaths?.add(path)
      serverDiagnostics.NUXT_E8008({ path, tags: [...kinds].join('`, `') })
    },
  }))
}
