import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, prodReporters, reporters } from './_shared.ts'

/**
 * E1xxx
 * Core / Nuxt-instance / lifecycle runtime diagnostics.
 */
export const appDiagnostics = !import.meta.dev
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase, reporters: prodReporters })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E1001: {
          why: 'A composable that requires access to the Nuxt instance was called outside of a plugin, Nuxt hook, Nuxt middleware, or Vue setup function. This is probably not a Nuxt bug.',
          fix: 'Move this call inside a Vue `setup()` function, a Nuxt plugin, or a Nuxt middleware.',
        },
        NUXT_E1003: {
          why: (p: { key: string, keys: string, lastKey: string }) => `Could not access \`${p.key}\`. The only available runtime config keys on the client side are ${p.keys} and ${p.lastKey}.`,
          fix: (p: { key: string }) => `Move \`${p.key}\` under \`runtimeConfig.public\` in \`nuxt.config\` to make it available on the client side.`,
          docs: false,
        },
        NUXT_E1004: {
          why: '`setInterval` should not be used on the server.',
          fix: 'Wrap it in an `onNuxtReady`, `onBeforeMount`, or `onMounted` lifecycle hook, or guard it with `import.meta.client` so it only runs in the browser.',
          docs: false,
        },
        NUXT_E1005: {
          why: 'Error caught during app initialization.',
          fix: 'Check your plugins, `app:created`, and `app:beforeMount` hooks for unhandled errors.',
          docs: false,
        },
        NUXT_E1006: {
          why: 'To transform a callback into a string, `onPrehydrate` must be processed by the Nuxt build pipeline.',
          fix: 'If it is called in a third-party library, add the library to `build.transpile`.',
        },
        NUXT_E1007: {
          why: (p: { name: string }) => `\`${p.name}\` is a compiler macro or compiler-hint helper and cannot be called at runtime. Its arguments are meant to be compiled away.`,
          fix: 'Call it statically from inside the directories scanned by the Nuxt compiler. For a page hint, call it from the `<script setup>` block of a page component in `pages/`.',
        },
        NUXT_E1009: {
          why: 'Error while mounting app.',
          fix: 'Check your plugins and app initialization code for unhandled errors.',
          docs: false,
        },
        NUXT_E1010: {
          why: 'Response headers cannot be set in the browser.',
          fix: 'Guard this code with `import.meta.server` or move it to a server-only context.',
          docs: false,
        },
        NUXT_E1011: {
          why: 'Error in `vue:setup`. Callbacks must be synchronous.',
          fix: 'Remove `async` from your `vue:setup` hook callbacks, or move asynchronous work to another hook such as `app:created`.',
          docs: false,
        },
        NUXT_E1012: {
          why: (p: { userAgent: string }) => `Not rendering error page for bot with user agent \`${p.userAgent}\`.`,
          fix: 'Crawlers receive the server-rendered HTML instead of the error page so they index the content. No action is needed unless you did not expect this request to be treated as a bot.',
          docs: false,
        },
      },
    })
