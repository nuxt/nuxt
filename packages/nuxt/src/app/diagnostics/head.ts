import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/**
 * E6xxx
 * Head / unhead runtime diagnostics.
 */
export const unheadDiagnostics = import.meta.client && !import.meta.dev && !import.meta.test
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E6001: {
          why: 'The Unhead instance is missing.',
          fix: 'Ensure `useHead()` is called inside a component `setup()` function, a Nuxt plugin, or Nuxt middleware.',
        },
        NUXT_E6002: {
          why: '`<Title>` received more than one child in its default slot.',
          fix: 'Pass a single string to the `<Title>` default slot.',
          docs: false,
        },
        NUXT_E6003: {
          why: '`<Style>` received a non-string child in its default slot.',
          fix: 'Pass a single string to the `<Style>` default slot.',
          docs: false,
        },
      },
    })
