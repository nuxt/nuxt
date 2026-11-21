import { defineDiagnostics } from 'nostics'
import { diagnosticReporters } from '@nuxt/kit/internal'

const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

/**
 * B9xxx
 * Nitro server build-time diagnostics.
 */
export const nitroBuildDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters: diagnosticReporters,
  codes: {
    NUXT_B9012: {
      why: (p: { id: string }) => `Nitro does not provide \`${p.id}\` in the form Nuxt reads the runtime config from. This version of Nitro is not supported by this version of Nuxt.`,
      fix: 'Install the version of `nitropack` that `@nuxt/nitro-server` depends on, or upgrade Nuxt.',
      docs: false,
    },
    NUXT_B9017: {
      why: (p: { keys: string }) => `\`nitro.options.routeRules\` was replaced after Nitro was initialised, and the new object leaves out built-in route rules, so the server no longer applies them: ${p.keys}.`,
      fix: 'Keep the existing rules when replacing `nitro.options.routeRules`, for example `nitro.options.routeRules = { ...nitro.options.routeRules, ...rules }`, or add the rules to the existing object. If your code does not replace `nitro.options.routeRules`, a module does: report it to the module author.',
      docs: false,
    },
  },
})
