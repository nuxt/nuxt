import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** E5xxx — App manifest / route-rules runtime diagnostics. */
export const manifestDiagnostics = import.meta.client && !import.meta.dev && !import.meta.test
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E5001: {
          why: 'The app manifest is not enabled.',
          fix: 'Set `experimental.appManifest: true` in your `nuxt.config`.',
          docs: false,
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
          why: 'Response headers cannot be set in the browser.',
          fix: 'Guard this code with `import.meta.server` or move it to a server-only context.',
          docs: false,
        },
      },
    })
