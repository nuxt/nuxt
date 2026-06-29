import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** E7xxx — Payload / state / cookie runtime diagnostics. */
export const stateDiagnostics = import.meta.client && !import.meta.dev && !import.meta.test
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E7001: {
          why: (p: { url: string }) => `Payload URL must not include a hostname (received \`${p.url}\`).`,
          fix: 'Use a relative path (e.g., `/page`) instead of a full URL with hostname.',
          docs: false,
        },
        NUXT_E7002: {
          why: (p: { url: string }) => `Cannot load payload \`${p.url}\`.`,
          fix: 'Ensure the payload file is generated and accessible; this may stem from a prerendering issue, server misconfiguration, or a network error.',
          docs: false,
        },
        NUXT_E7003: {
          why: (p: { url: string }) => `Failed to preload the payload for \`${p.url}\`.`,
          fix: 'This is usually a transient network error; the payload will be fetched on navigation instead.',
          docs: false,
        },
        NUXT_E7004: {
          why: '`definePayloadReviver` was not called from a plugin `unshift`ed to the beginning of the Nuxt plugins array.',
          fix: 'Move this call into a Nuxt plugin file and ensure the plugin is registered early in the plugin order.',
          docs: false,
        },
        NUXT_E7005: {
          why: (p: { name: string }) => `Cookie \`${p.name}\` was not set because it has already expired.`,
          fix: 'Update the `expires` or `maxAge` option to a future date.',
          docs: false,
        },
        NUXT_E7006: {
          why: (p: { name: string, previous: string, next: string }) => `Cookie \`${p.name}\` was previously set to \`${p.previous}\` and is being overridden to \`${p.next}\`, which may cause unexpected issues.`,
          fix: 'Avoid setting the same cookie from multiple places during SSR, or use a single `useCookie()` composable shared across components.',
          docs: false,
        },
        NUXT_E7007: {
          why: (p: { type: string }) => `\`useState\` init must be a function, but got \`${p.type}\`.`,
          fix: 'Wrap the initial value in a function: `useState(\'key\', () => value)` instead of `useState(\'key\', value)`.',
          docs: false,
        },
        NUXT_E7008: {
          why: (p: { type: string }) => `\`callOnce\` \`fn\` must be a function, but got \`${p.type}\`.`,
          fix: 'Pass a function as the second argument: `callOnce(\'key\', () => { ... })`.',
          docs: false,
        },
        NUXT_E7009: {
          why: (p: { key: string }) => `\`useState\` key must be a string (received \`${p.key}\`).`,
          fix: 'Pass a string key as the first argument to `useState()`, e.g. `useState(\'myKey\', () => initialValue)`.',
          docs: false,
        },
        NUXT_E7010: {
          why: (p: { key: string }) => `\`callOnce\` key must be a string (received \`${p.key}\`).`,
          fix: 'Pass a string key as the first argument to `callOnce()`, e.g. `callOnce(\'myKey\', () => { ... })`.',
          docs: false,
        },
      },
    })
