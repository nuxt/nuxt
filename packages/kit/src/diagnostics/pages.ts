import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/**
 * B4xxx
 * Pages / routing diagnostics.
 *
 * @internal
 */
export const pageDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B4001: {
      why: (p: { pathname: string }) => `The file \`${p.pathname}\` is empty, so it cannot be a valid page.`,
      fix: 'Add a `<template>` block to the page file, or remove the empty file from the `pages/` directory.',
      docs: false,
    },
    NUXT_B4002: {
      why: 'An `await` expression is used in a variable referenced by `definePageMeta`, which runs synchronously.',
      fix: (p: { codeSnippet: string, offset: number }) => `Move the \`await\` outside of variables referenced in \`definePageMeta\`, or use a static value instead (near offset ${p.offset}): ${p.codeSnippet}`,
      docs: false,
    },
    NUXT_B4003: {
      why: (p: { callCount: number, file: string }) => `\`definePageMeta()\` is called ${p.callCount} times in \`${p.file}\`, but only one call is allowed.`,
      fix: 'Merge all `definePageMeta()` calls into a single call.',
      docs: false,
    },
    NUXT_B4004: {
      why: (p: { file: string, existingFile: string }) => `The route name generated for \`${p.file}\` collides with the one already generated for \`${p.existingFile}\`.`,
      fix: 'Set a custom name using `definePageMeta` within one of the page files.',
      docs: false,
    },
    NUXT_B4005: {
      why: (p: { fnName: string, file: string, receivedType: string }) => `\`${p.fnName}\` was called with a \`${p.receivedType}\` instead of an object literal (reading \`${p.file}\`).`,
      fix: (p: { fnName: string }) => `Pass a plain object literal to \`${p.fnName}()\`, e.g. \`${p.fnName}({ ... })\`. Variables and function calls are not supported.`,
      docs: false,
    },
    NUXT_B4006: {
      why: (p: { fnName: string, file: string }) => `\`${p.fnName}\` was called with a non-serializable object literal (reading \`${p.file}\`).`,
      fix: 'Use only JSON-serializable values (strings, numbers, booleans, arrays, plain objects) in `defineRouteRules()`.',
      docs: false,
    },
    NUXT_B4008: {
      why: 'Server pages with `ssr: false` are not supported while component islands are auto-detected.',
      fix: 'Set `experimental.componentIslands` to `true`.',
      docs: false,
    },
    NUXT_B4009: {
      why: (p: { file: string }) => `No layout name could be resolved for \`${p.file}\` (\`index\` is ignored for the purpose of creating a layout name).`,
      fix: 'Rename the layout file to something other than `index` (e.g. `layouts/default.vue`).',
      docs: false,
    },
    NUXT_B4010: {
      why: (p: { file: string }) => `No middleware name could be resolved for \`${p.file}\` (\`index\` is ignored for the purpose of creating a middleware name).`,
      fix: 'Rename the middleware file to something other than `index` (e.g. `middleware/auth.ts`).',
      docs: false,
    },
    NUXT_B4011: {
      why: (p: { message: string }) => `While building the page tree: ${p.message}`,
      fix: 'Check the page file naming and directory structure for issues.',
      docs: false,
    },
    NUXT_B4012: {
      why: (p: { event: string, path: string }) => `The incremental route update for \`${p.event}\` on \`${p.path}\` failed, so a full rebuild was performed.`,
      fix: 'This is usually harmless: the full rebuild will recover. If it happens repeatedly, check for unusual file naming in `pages/`.',
      docs: false,
    },
    NUXT_B4013: {
      why: (p: { name: string, foundPath: string }) => `A \`${p.name}\` middleware already exists at \`${p.foundPath}\`.`,
      fix: 'Set `override: true` to replace it.',
      docs: false,
    },
    NUXT_B4014: {
      why: (p: { layoutName: string, existingPath: string, newPath: string }) => `Layout \`${p.layoutName}\` is already provided by \`${p.existingPath}\` and was not overridden with \`${p.newPath}\`.`,
      fix: 'Rename one of the layouts, or remove the duplicate layout registration.',
      docs: false,
    },
  },
})
