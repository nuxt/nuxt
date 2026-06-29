import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** B6xxx — Head / auto-import diagnostics. */
export const headDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B6001: {
      why: (p: { module: string, file: string }) => `\`${p.file}\` imports head composables directly from \`${p.module}\`, which loses Nuxt's type safety.`,
      fix: 'Import from `#imports` instead.',
      docs: false,
    },
    NUXT_B6002: {
      why: (p: { name: string }) => `\`${p.name}\` is already auto-imported by Nuxt as a built-in, and overriding it will likely cause issues.`,
      fix: (p: { name: string, file: string }) => `Rename \`${p.name}\` in \`${p.file}\` so it no longer collides with the built-in auto-import.`,
      docs: false,
    },
  },
})
