import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** B3xxx — Component diagnostics. */
export const componentDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B3001: {
      why: (p: { dirPath: string }) => `Components directory not found: \`${p.dirPath}\`.`,
      fix: 'If this is intentional, remove it from `components.dirs` in your `nuxt.config`.',
      docs: false,
    },
    NUXT_B3002: {
      why: (p: { component: string }) => `Using server component \`${p.component}\` with \`ssr: false\` is not supported with auto-detected component islands.`,
      fix: 'Set `experimental.componentIslands` to `true` in your `nuxt.config`, or convert the component to a client component.',
      docs: false,
    },
    NUXT_B3003: {
      why: (p: { component: string }) => `Standalone server components (\`${p.component}\`) are not yet supported without enabling \`experimental.componentIslands\`.`,
      fix: 'Set `experimental.componentIslands` to `true` in your `nuxt.config`.',
      docs: false,
    },
    NUXT_B3004: {
      why: (p: { file: string, component: string, requiredModule: string }) => `\`${p.file}\` is using \`${p.component}\` which requires \`${p.requiredModule}\`.`,
      fix: (p: { requiredModule: string }) => `Run \`npx nuxt add ${p.requiredModule}\` to install it.`,
      docs: false,
    },
    NUXT_B3005: {
      why: (p: { component: string, file: string }) => `Multiple hydration strategies are not supported in the same component \`<${p.component}>\` in \`${p.file}\`.`,
      fix: 'Use only one hydration strategy attribute (e.g., `hydrate-on-visible` or `hydrate-on-idle`) per component.',
      docs: false,
    },
    NUXT_B3006: {
      why: (p: { component: string, file: string }) => `Component \`<${p.component}>\` (used in \`${p.file}\`) has lazy-hydration props but is not declared as a lazy component.`,
      fix: (p: { lazyName: string }) => `Rename it to \`<${p.lazyName} />\` or remove the lazy-hydration props.`,
      docs: false,
    },
    NUXT_B3007: {
      why: (p: { file: string }) => `The \`nuxt-client\` attribute and client components within islands are only supported when \`experimental.componentIslands.selectiveClient\` is enabled, or with Vite. file: \`${p.file}\`.`,
      fix: 'Set `experimental.componentIslands.selectiveClient` to `true` in your `nuxt.config`, or switch to the Vite builder with `builder: \'vite\'`.',
      docs: false,
    },
    NUXT_B3008: {
      why: (p: { scannedPath: string }) => `Components not scanned from \`${p.scannedPath}\`, likely due to a directory casing mismatch.`,
      fix: (p: { scannedPath: string, expectedPath: string }) => `Rename the directory from \`${p.scannedPath}\` to \`${p.expectedPath}\` to match the expected casing.`,
      docs: false,
    },
    NUXT_B3009: {
      why: (p: { component: string, filePath: string }) => `The component \`${p.component}\` (in \`${p.filePath}\`) is using the reserved "Lazy" prefix used for dynamic imports, which may cause it to break at runtime.`,
      fix: 'Rename the component to avoid the `Lazy` prefix.',
      docs: false,
    },
    NUXT_B3010: {
      why: (p: { filePath: string }) => `Component did not resolve to a file name in \`${p.filePath}\`.`,
      fix: 'Rename the component file to something other than `index` (e.g., `MyComponent.vue`).',
      docs: false,
    },
    NUXT_B3011: {
      why: (p: { component: string, filePath: string, duplicatePath: string }) => `Two component files resolving to the same name \`${p.component}\`:\n\n - ${p.filePath}\n - ${p.duplicatePath}`,
      fix: 'Rename one of the files or adjust the `components.dirs` prefix settings in your `nuxt.config`.',
      docs: false,
    },
    NUXT_B3012: {
      why: (p: { name: string }) => `Overriding ${p.name} component.`,
      fix: 'Specify a `priority` option when calling `addComponent` to avoid this warning.',
      docs: false,
    },
  },
})
