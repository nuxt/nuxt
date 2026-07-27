import { createConsoleReporter, defineDiagnostics } from 'nostics'

/**
 * B5xxx (schema-resolved configuration)
 * Diagnostics raised while resolving `nuxt.config` values against the schema.
 * Codes continue the configuration (B5xxx) range defined in `@nuxt/kit`, which
 * schema cannot import without creating a dependency cycle.
 */
// TODO: bump the `4.x` path segment to `5.x` when the v5 docs go live.
const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

export const schemaDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters: [/* #__PURE__ */ (createConsoleReporter())] as const,
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
      fix: 'Set `dir.public` instead. You can read more in `https://nuxt.com/docs/4.x/api/nuxt-config#public`.',
      docs: false,
    },
    NUXT_B5015: {
      why: (p: { preset: string }) => `Unknown PostCSS order preset: \`${p.preset}\`.`,
      fix: 'Use a known preset name, or pass a function to `postcss.order`.',
      docs: false,
    },
  },
})
