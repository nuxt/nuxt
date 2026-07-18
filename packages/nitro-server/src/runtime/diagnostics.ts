import { createConsoleReporter, defineDiagnostics } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'

const ansi = (open: number, close: number) => (s: string) => `\x1B[${open}m${s}\x1B[${close}m`
const colors = {
  red: ansi(31, 39),
  yellow: ansi(33, 39),
  cyan: ansi(36, 39),
  gray: ansi(90, 39),
  bold: ansi(1, 22),
  dim: ansi(2, 22),
}

/**
 * E8xxx
 * Nitro server runtime (SSR rendering / dev server) diagnostics.
 */
// TODO: bump the `4.x` path segment to `5.x` when the v5 docs go live.
const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

export const serverDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  // eslint-disable-next-line 
  reporters: [/* #__PURE__ */ (createConsoleReporter(import.meta.dev && process.env.NODE_ENV !== 'test' ? { formatter: ansiFormatter(colors) } : undefined))] as const,
  codes: {
    NUXT_E8001: {
      why: (p: { path: string }) => `\`render:html\` mutated \`body\`/\`bodyAppend\` while streaming (\`${p.path}\`). These fields are silently dropped because the body is about to stream.`,
      fix: 'Use the `render:html:close` hook instead.',
      docs: false,
    },
    NUXT_E8002: {
      why: (p: { mutations: string, path: string }) => `SSR streaming committed the response before render completed (\`${p.path}\`). The following mutations did not reach the client and were dropped:\n  - ${p.mutations}`,
      fix: (p: { path: string }) => `Move the mutation into a plugin (which runs before the shell is flushed), or opt this route out of streaming with \`routeRules: { '${p.path}': { streaming: false } }\` or the \`render:route\` hook.`,
      docs: false,
    },
    NUXT_E8003: {
      why: (p: { error?: string }) => `Failed to stringify dev server logs.${p.error ? ` Received \`${p.error}\`.` : ''}`,
      fix: 'You can define your own reducer/reviver for rich types following the instructions in `https://nuxt.com/docs/4.x/api/composables/use-nuxt-app#payload`.',
      docs: false,
    },
    NUXT_E8004: {
      why: 'The server bundle is not available.',
      fix: 'Ensure the Nuxt build completed successfully and the server entry was emitted by your builder.',
      docs: false,
    },
  },
})
