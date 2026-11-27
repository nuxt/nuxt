import { createConsoleReporter, defineDiagnostics } from 'nostics'
import type { ConsoleMethod, DiagnosticReporter } from 'nostics'

/**
 * B5xxx (configuration)
 * Diagnostics raised while resolving `nuxt.config` into `nuxt.options`. Codes continue the
 * configuration range defined in `@nuxt/kit`, which `nuxt/config` does not import so that loading
 * a `nuxt.config` stays cheap.
 */
const docsBase = (code: string): string =>
  `https://nuxt.com/docs/5.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

const consoleReporter = /* #__PURE__ */ createConsoleReporter()

const reporter: DiagnosticReporter<{ method?: ConsoleMethod }> = (diagnostic, options) => {
  consoleReporter(diagnostic, options)
  Object.defineProperty(diagnostic, Symbol.for('nuxt.diagnostic.reported'), { value: true })
}

export const optionsDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters: [reporter] as const,
  codes: {
    NUXT_B5012: {
      why: (p: { value: string }) => `Invalid \`logLevel\` option: \`${p.value}\`.`,
      fix: 'Use one of `silent`, `info`, or `verbose`.',
      docs: false,
    },
    NUXT_B5013: {
      why: '`unhead.legacy` is ignored when `future.compatibilityVersion` >= 5.',
      fix: 'Remove deprecated head patterns (`hid`, `vmid`, `children`, `body: true`, `renderPriority`) and resolve promise values before passing them to `useHead`.',
      docs: false,
    },
    NUXT_B5014: {
      why: 'Directly configuring the `vite.publicDir` option is not supported.',
      fix: 'Set `dir.public` instead. You can read more in `https://nuxt.com/docs/5.x/api/nuxt-config#public`.',
      docs: false,
    },
    NUXT_B5015: {
      why: (p: { preset: string }) => `Unknown PostCSS order preset: \`${p.preset}\`.`,
      fix: 'Use a known preset name, or pass a function to `postcss.order`.',
      docs: false,
    },
    NUXT_B5016: {
      why: '`experimental.parseErrorData` is ignored. `error.data` is no longer stringified on its way to the error page, so there is nothing to opt out of.',
      fix: 'Remove the option, and drop any `JSON.parse(error.data)` from your error page.',
      docs: false,
    },
    NUXT_B5020: {
      why: (p: { status: string }) => `\`experimental.prerenderErrorPages\` was passed \`${p.status}\`, which is not a client or server error status code.`,
      fix: 'Pass whole status codes between 400 and 599, such as `[404, 500]`. `/200.html` and `/index.html` are SPA fallbacks and cannot be generated as error pages.',
      docs: false,
    },
    NUXT_B5027: {
      why: '`experimental.nitroViteEnvironment` is only compatible with `@nuxt/vite-builder`, so it has been disabled.',
      fix: 'Set `builder: "vite"` in your `nuxt.config`, or remove the option.',
      docs: false,
    },
    NUXT_B5029: {
      why: (p: { value: string }) => `\`future.compatibilityVersion\` was set to \`${p.value}\`, but this version of Nuxt only supports \`5\`.`,
      fix: 'Remove `future.compatibilityVersion` from your `nuxt.config` (or the layer that sets it). To keep Nuxt 4 behaviour, stay on Nuxt 4.',
      docs: false,
    },
    NUXT_B5041: {
      why: (p: { path: string, value: string, expected: string }) => `\`${p.path}\` was set to ${p.value}, but it has to be ${p.expected}. The default value is used instead.`,
      fix: 'Change the value in your `nuxt.config`, or in the layer or module that sets it.',
      docs: false,
    },
  },
})
