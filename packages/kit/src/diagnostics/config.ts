import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/**
 * B5xxx
 * Configuration diagnostics.
 *
 * @internal
 */
export const configDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B5001: {
      why: (p: { fallback: string }) => `No \`compatibilityDate\` is set in \`nuxt.config\`, so the \`${p.fallback}\` fallback is being used.`,
      fix: (p: { latest: string }) => `Add \`compatibilityDate: '${p.latest}'\` to your \`nuxt.config.ts\`.`,
    },
    NUXT_B5002: {
      why: (p: { rootDir: string }) => `\`@nuxt/webpack-builder\` could not be installed in \`${p.rootDir}\`.`,
      fix: 'Install it manually with `npm install -D @nuxt/webpack-builder`, or change the `builder` option to `vite` in `nuxt.config`.',
      docs: false,
    },
    NUXT_B5003: {
      why: (p: { key: string }) => `The \`app\` namespace is reserved for Nuxt and exposed to the browser, but \`runtimeConfig.app.${p.key}\` is set.`,
      fix: 'Move the key to `runtimeConfig.public` or a custom namespace.',
    },
    NUXT_B5004: {
      why: (p: { files: string }) => `External configuration files are not supported: ${p.files}.`,
      fix: 'Move these configurations into `nuxt.config.ts` and delete the external config files.',
    },
    NUXT_B5005: {
      why: (p: { filePath: string }) => `Nuxt schema could not be loaded from \`${p.filePath}\`.`,
      fix: 'Ensure the file exports a valid object with `defineNuxtSchema()` or as a plain object.',
      docs: false,
    },
    NUXT_B5006: {
      why: (p: { option: string }) => `\`${p.option}\` is used in dev mode, which causes a memory leak.`,
      fix: 'Remove the hash option from your webpack config.',
      docs: false,
    },
    NUXT_B5007: {
      why: 'The webpack server config `target` is not set to "node".',
      fix: 'Set `target: "node"` in your webpack server configuration.',
      docs: false,
    },
    NUXT_B5009: {
      why: '`@parcel/watcher` cannot be resolved in your project, so `chokidar` is being used instead.',
      fix: 'Install `@parcel/watcher` for better file watching: `npm install -D @parcel/watcher`.',
      docs: false,
    },
    NUXT_B5010: {
      why: (p: { names: string }) => `Required packages are not installed: ${p.names}.`,
      fix: (p: { install: string }) => `Run \`npm install ${p.install}\` to install them.`,
      docs: false,
    },
    NUXT_B5011: {
      why: (p: { name: string }) => `Package \`${p.name}\` is missing.`,
      fix: (p: { name: string }) => `Run \`npx nuxt add ${p.name}\` to install it.`,
      docs: false,
    },
  },
})
