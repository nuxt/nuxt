import { createConsoleReporter, defineDiagnostics } from 'nostics'

/**
 * Nuxt build-time diagnostics.
 *
 * Each code is a stable, fully-qualified `NUXT_B<NNNN>` identifier mapping to a
 * docs page at `https://nuxt.com/docs/4.x/errors/<code>`. Codes are stable —
 * once published they must not be reused or renumbered.
 *
 * Ranges (the `B<N>xxx` digit groups the domain):
 *   B1xxx  Build / compilation
 *   B2xxx  Plugins
 *   B3xxx  Components
 *   B4xxx  Pages / routing
 *   B5xxx  Configuration
 *   B6xxx  Head / imports
 *   B7xxx  Webpack / Vite bundler
 *   B8xxx  Kit API
 *
 * The `why`/`fix` text lives here (not at the call site) so it can be
 * documented, parameterised, and tree-shaken in production.
 */
export const diagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase: code => `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`,
  reporters: [/* #__PURE__ */ createConsoleReporter()],
  codes: {
    // ---------- B2xxx: Plugins ----------
    NUXT_B2011: {
      why: (p: { src: string }) => `Invalid plugin \`${p.src}\`. The \`src\` option is required.`,
      fix: 'Pass a string path, or an object with a `src` property, to `addPlugin()`.',
      // No dedicated docs page: the inline why+fix is self-sufficient, so we
      // opt out of the auto-generated docs URL rather than ship a 404.
      docs: false,
    },
  },
})
