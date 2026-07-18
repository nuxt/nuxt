import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, prodReporters, reporters } from './_shared.ts'

/**
 * E5xxx
 * App manifest / route-rules runtime diagnostics.
 */
export const manifestDiagnostics = !import.meta.dev
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase, reporters: prodReporters })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E5001: {
          why: 'The app manifest is not enabled.',
          fix: 'Set `experimental.appManifest: true` in your `nuxt.config`.',
        },
        NUXT_E5002: {
          why: 'Could not fetch the app manifest.',
          fix: 'Check that your server is running and the manifest endpoint is reachable. This may be a transient network issue.',
          docs: false,
        },
        NUXT_E5003: {
          why: (p: { path: string }) => `Could not match route rules for path \`${p.path}\`.`,
          fix: 'Check your `routeRules` in `nuxt.config` for invalid patterns.',
          docs: false,
        },
        NUXT_E5004: {
          why: 'Received a malformed app manifest.',
          fix: 'Ensure that `builds/meta/*.json` is served as JSON by your hosting/proxy and not rewritten to an HTML fallback.',
          docs: false,
        },
      },
    })
