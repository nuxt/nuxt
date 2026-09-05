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
  },
})
