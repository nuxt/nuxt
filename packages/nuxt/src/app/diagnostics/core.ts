import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** E1xxx — Core / Nuxt-instance / lifecycle runtime diagnostics. */
export const appDiagnostics = import.meta.client && !import.meta.dev && !import.meta.test
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E1001: {
          why: 'A composable that requires access to the Nuxt instance was called outside of a plugin, Nuxt hook, Nuxt middleware, or Vue setup function. This is probably not a Nuxt bug.',
          fix: 'Move this call inside a Vue `setup()` function, a Nuxt plugin, or a Nuxt middleware.',
          docs: false,
        },
        NUXT_E1003: {
          why: (p: { key: string, keys: string, lastKey: string }) => `Could not access \`${p.key}\`. The only available runtime config keys on the client side are ${p.keys} and ${p.lastKey}.`,
          fix: (p: { key: string }) => `Move \`${p.key}\` under \`runtimeConfig.public\` in \`nuxt.config\` to make it available on the client side.`,
        },
        NUXT_E1004: {
          why: '`setInterval` should not be used on the server.',
          fix: 'Wrap it in an `onNuxtReady`, `onBeforeMount`, or `onMounted` lifecycle hook, or guard it with `import.meta.client` so it only runs in the browser.',
        },
        NUXT_E1005: {
          why: 'Error caught during app initialization.',
          fix: 'Check your plugins, `app:created`, and `app:beforeMount` hooks for unhandled errors.',
        },
        NUXT_E1006: {
          why: 'To transform a callback into a string, `onPrehydrate` must be processed by the Nuxt build pipeline.',
          fix: 'If it is called in a third-party library, add the library to `build.transpile`.',
          docs: false,
        },
        NUXT_E1007: {
          why: (p: { name: string }) => `\`${p.name}\` is a compiler macro or compiler-hint helper and cannot be called at runtime. Its arguments are meant to be compiled away.`,
          fix: 'Call it statically from inside the directories scanned by the Nuxt compiler — for a page hint, from the `<script setup>` block of a page component in `pages/`.',
          docs: false,
        },
        NUXT_E1008: {
          why: 'Skipping render: a response was already set by middleware or a plugin.',
        },
        NUXT_E1009: {
          why: 'Error while mounting app.',
          fix: 'Check your plugins and app initialization code for unhandled errors.',
        },
      },
    })
