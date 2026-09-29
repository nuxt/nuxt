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
 * Nitro server runtime (dev server) diagnostics, sharing the range with the
 * SSR renderer.
 */
// TODO: bump the `4.x` path segment to `5.x` when the v5 docs go live.
const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

export const serverDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  // eslint-disable-next-line
  reporters: [/* #__PURE__ */ (createConsoleReporter(import.meta.dev && process.env.NODE_ENV !== 'test' ? { formatter: ansiFormatter(colors) } : undefined))] as const,
  codes: {
    NUXT_E8003: {
      why: (p: { error?: string }) => `Failed to stringify dev server logs.${p.error ? ` Received \`${p.error}\`.` : ''}`,
      fix: 'You can define your own reducer/reviver for rich types following the instructions in `https://nuxt.com/docs/4.x/api/composables/use-nuxt-app#payload`.',
      docs: false,
    },
    NUXT_E8005: {
      why: 'Island props cannot contain a `template` key, which the Vue runtime compiler would compile and execute.',
      fix: 'Rename the prop (e.g. `templateName`), or disable `vue.runtimeCompiler` if you do not need runtime template compilation.',
      docs: false,
    },
    NUXT_E8008: {
      why: (p: { hook: string }) => `A Nitro v2 \`${p.hook}\` hook replaced \`response.body\`, which the compatibility layer cannot apply: the response has already been built by the time the hook runs.`,
      fix: 'Return the replacement body from the handler, or move the rewrite into a Nitro v3 `response` hook, which receives the `Response` and can return a new one.',
      docs: false,
    },
    NUXT_E8009: {
      why: (p: { hook: string }) => `A Nitro v2 \`${p.hook}\` hook read \`response.body\` for a streamed response, which the compatibility layer cannot provide: the body is already on the wire, so \`undefined\` was returned.`,
      fix: 'Read the body from the `Response` passed to the Nitro v3 `response` hook instead, or opt the route out of streaming with the `streaming: false` route rule if the hook has to see the whole body.',
      docs: false,
    },
    NUXT_E8010: {
      why: (p: { hook: string }) => `A \`${p.hook}\` listener was registered, which is a Nitro v2 hook that Nitro v3 does not emit, and the compatibility layer is not bridging it for this app.`,
      fix: 'Use the Nitro v3 `response` hook, which receives the built `Response` and can return a new one.',
      docs: false,
    },
  },
})
