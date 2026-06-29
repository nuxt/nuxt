import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** E3xxx — Data fetching (useFetch / useAsyncData) runtime diagnostics. */
export const dataDiagnostics = import.meta.client && !import.meta.dev && !import.meta.test
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E3001: {
          why: (p: { url: string }) => `The \`useFetch\` request URL must not start with "//" (received \`${p.url}\`).`,
          fix: 'Use an absolute URL with a protocol or a relative path instead.',
          docs: false,
        },
        NUXT_E3002: {
          why: '`useFetch` failed to hash the request body for the cache key.',
          fix: 'Pass a serializable value (plain object, string, FormData) as the request body, or provide an explicit `key` to `useFetch`.',
          docs: false,
        },
        NUXT_E3003: {
          why: 'Component is already mounted, so the data fetch cannot be awaited during setup.',
          fix: 'Use `$fetch()` for requests triggered after mount (e.g., in event handlers), or call `useAsyncData`/`useFetch` in the `setup()` function.',
          docs: false,
        },
        NUXT_E3004: {
          why: (p: { key: string, warnings: string }) => `Incompatible options detected for "${p.key}":\n${p.warnings}`,
          fix: 'You can use a different key or move the call to a composable to ensure the options are shared across calls.',
          docs: false,
        },
        NUXT_E3005: {
          why: '`execute` was passed directly to `watch`, which causes unintended behavior.',
          fix: 'Wrap the call: `watch(source, () => execute())` instead of `watch(source, execute)`.',
          docs: false,
        },
        NUXT_E3006: {
          why: (p: { fn: string }) => `\`${p.fn}\` handler returned \`undefined\`, so the request may be duplicated on the client side.`,
          fix: 'Return a value from the handler function (e.g., `return null` instead of returning nothing).',
          docs: false,
        },
        NUXT_E3007: {
          why: '`asyncData` returned a non-object value.',
          fix: 'Return a plain object from the `asyncData()` function, e.g. `asyncData() { return { key: value } }`.',
          docs: false,
        },
        NUXT_E3008: {
          why: '`useAsyncData` key must be a non-empty string.',
          fix: 'Pass a non-empty string as the first argument to `useAsyncData()`.',
          docs: false,
        },
        NUXT_E3009: {
          why: '`useAsyncData` handler must be a function.',
          fix: 'Pass a function as the handler argument, e.g. `useAsyncData(\'key\', () => $fetch(\'/api/data\'))`.',
          docs: false,
        },
      },
    })
