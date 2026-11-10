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
 * Server runtime config diagnostics, sharing the range with the SSR renderer.
 */
const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

export const runtimeConfigDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  // eslint-disable-next-line
  reporters: [/* #__PURE__ */ (createConsoleReporter(import.meta.dev && process.env.NODE_ENV !== 'test' ? { formatter: ansiFormatter(colors) } : undefined))] as const,
  codes: {
    NUXT_E8014: {
      why: (p: { issues: string }) => `The runtime config does not match its schema:\n  - ${p.issues}`,
      fix: 'Set the listed environment variables to valid values, or update the schema or default value in `runtimeConfig` in `nuxt.config`.',
    },
  },
})

/** Diagnostics reported only while prerendering. */
export const prerenderDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  // eslint-disable-next-line
  reporters: [/* #__PURE__ */ (createConsoleReporter(import.meta.dev && process.env.NODE_ENV !== 'test' ? { formatter: ansiFormatter(colors) } : undefined))] as const,
  codes: {
    NUXT_E8015: {
      why: (p: { path: string, env: string }) => `\`${p.path}\` was read while prerendering, but it is required and \`${p.env}\` is not set.`,
      fix: 'Set the environment variable when prerendering, or make the value optional in its schema. The server will not start without it.',
      docs: false,
    },
  },
})
