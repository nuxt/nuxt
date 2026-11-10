import process from 'node:process'
import { createConsoleReporter, defineDiagnostics } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'
import { colors } from 'consola/utils'

const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

/**
 * B9xxx
 * Nitro server build-time diagnostics.
 */
export const nitroBuildDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters: [/* #__PURE__ */ (createConsoleReporter(process.env.NODE_ENV === 'test' ? undefined : { formatter: ansiFormatter(colors) }))] as const,
  codes: {
    NUXT_B9012: {
      why: (p: { id: string }) => `Nitro does not provide \`${p.id}\` in the form Nuxt reads the runtime config from. This version of Nitro is not supported by this version of Nuxt.`,
      fix: 'Install the version of `nitropack` that `@nuxt/nitro-server` depends on, or upgrade Nuxt.',
      docs: false,
    },
  },
})
