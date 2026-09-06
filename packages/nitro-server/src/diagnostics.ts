import process from 'node:process'
import { createConsoleReporter, defineDiagnostics } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'
import { colors } from 'consola/utils'

// TODO: bump the `4.x` path segment to `5.x` when the v5 docs go live.
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
    NUXT_B9001: {
      why: (p: { keys: string }) => `The following \`nitro\` config options are no longer supported by Nitro v3 and were ignored: ${p.keys}.`,
      fix: 'Remove them from your `nitro` configuration.',
      docs: false,
    },
    NUXT_B9002: {
      why: (p: { count: number, handlers: string }) => `${p.count} Nitro v2 handler${p.count === 1 ? ' has' : 's have'} no \`route\`, which Nitro v3 requires:\n  - ${p.handlers}`,
      fix: 'They have been registered as middleware on `/**`. Give each handler an explicit `route` to control where it runs.',
      docs: false,
    },
    NUXT_B9003: {
      why: (p: { count: number, modules: string }) => `Nitro v2 compatibility was applied to server code from ${p.count} module${p.count === 1 ? '' : 's'}, because of what it imports:\n  - ${p.modules}`,
      fix: 'This layer is transitional and will be removed in Nuxt 6. Update the module to import from `nuxt/server`, registering the portable file alongside the one it ships today, or report it to the module author if the module is not your own.',
      docs: false,
    },
    NUXT_B9004: {
      why: (p: { count: number, handlers: string }) => `${p.count} Nitro v2 middleware handler${p.count === 1 ? '' : 's'} ran for every path below ${p.count === 1 ? 'its' : 'their'} \`route\` in Nitro v2, which matches routed middleware exactly in Nitro v3, so ${p.count === 1 ? 'it was' : 'they were'} registered on a wildcard route:\n  - ${p.handlers}`,
      fix: 'Give each middleware the `route` it needs, ending in `/**` if it has to keep running for sub-paths. Nitro v2 also stripped the route from `event.path`; the layer keeps doing so, but a migrated handler reads the full path.',
      docs: false,
    },
  },
})
