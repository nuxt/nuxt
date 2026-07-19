import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/**
 * B7xxx
 * Bundler (Vite / webpack / Nitro) diagnostics.
 *
 * @internal
 */
export const bundlerDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B7001: {
      why: '`rollup-plugin-visualizer` is not installed, so bundle analysis cannot run.',
      fix: 'Run `npm install -D rollup-plugin-visualizer` to enable bundle analysis.',
      docs: false,
    },
    NUXT_B7002: {
      why: (p: { deps: string }) => `Some \`vite.optimizeDeps.include\` entries could not be resolved: ${p.deps}.`,
      fix: 'Remove or correct these entries in the `vite.optimizeDeps.include` array of your `nuxt.config.ts`. Report entries added by a Nuxt module to the module author.',
      docs: false,
    },
    NUXT_B7003: {
      why: 'The server-side bundle produced more than one JS entry file.',
      fix: 'Avoid using `optimization.splitChunks` in the server config.',
      docs: false,
    },
    NUXT_B7004: {
      why: (p: { entryName: string }) => `Webpack entry \`${p.entryName}\` was not found.`,
      fix: (p: { entryName: string }) => `Check that the \`entry\` option in your webpack configuration points to an existing file. Expected entry name: \`${p.entryName}\`.`,
      docs: false,
    },
    NUXT_B7005: {
      why: (p: { input: string }) => `No client entry was found in \`rollupOptions.input\`; expected an \`entry\` key or a string input but received ${p.input}.`,
      fix: 'Set `vite.build.rollupOptions.input` to a string or an object with an `entry` key in your `nuxt.config`.',
      docs: false,
    },
    NUXT_B7006: {
      why: (p: { input: string }) => `No server entry was found in \`rollupOptions.input\`; expected a \`server\` key or a string input but received ${p.input}.`,
      fix: 'Set `vite.build.rollupOptions.input` to a string or an object with a `server` key in your `nuxt.config`.',
      docs: false,
    },
    NUXT_B7007: {
      why: (p: { pluginName: string }) => `The PostCSS plugin \`${p.pluginName}\` could not be loaded.`,
      fix: (p: { pluginName: string }) => `Run \`npm install -D ${p.pluginName}\` to install the PostCSS plugin.`,
      docs: false,
    },
    NUXT_B7008: {
      why: '`@vitejs/plugin-vue-jsx` is not installed, so JSX support is unavailable.',
      fix: 'Run `npm install -D @vitejs/plugin-vue-jsx` to install it.',
      docs: false,
    },
    NUXT_B7009: {
      why: (p: { deps: string }) => `The Babel dependencies required for decorator support are missing: ${p.deps}.`,
      fix: (p: { install: string }) => `Run \`npm install -D ${p.install}\` to install the required Babel decorator dependencies.`,
      docs: false,
    },
    NUXT_B7011: {
      why: (p: { pluginName: string }) => `The PostCSS plugin \`${p.pluginName}\` could not be imported, which is unexpected.`,
      fix: (p: { pluginName: string }) => `Run \`npm install -D ${p.pluginName}\` to install it, or report this issue at https://github.com/nuxt/nuxt/issues.`,
      docs: false,
    },
    NUXT_B7012: {
      why: (p: { requiredSize: number, maxSize: number }) => `A ViteNode socket payload of ${p.requiredSize} bytes exceeds the internal buffer limit of ${p.maxSize} bytes.`,
      fix: 'Reduce the payload size sent through the ViteNode socket.',
      docs: false,
    },
    NUXT_B7013: {
      why: 'The ViteNode socket server was started without a configured socket path.',
      fix: 'This is likely an internal Nuxt bug. Please report it at https://github.com/nuxt/nuxt/issues.',
      docs: false,
    },
    NUXT_B7014: {
      why: (p: { name: string }) => `The webpack \`${p.name}\` build failed with errors.`,
      fix: 'Fix the build errors listed above. If the errors are unclear, try running `nuxi clean` and rebuilding.',
      docs: false,
    },
    NUXT_B7015: {
      why: 'Payload extraction is disabled, which is suboptimal for full-static output.',
      fix: 'Set `experimental.payloadExtraction` to `true` or `\'client\'`.',
      docs: false,
    },
    NUXT_B7016: {
      why: (p: { path: string }) => `The configured \`spaLoadingTemplate\` path does not exist: \`${p.path}\`.`,
      fix: 'Point `spaLoadingTemplate` in `nuxt.config` at an existing HTML file, or set it to `true` to use the default template.',
      docs: false,
    },
    NUXT_B7017: {
      why: 'Could not find the Nuxt dev server to attach Rspack HMR to; hot module replacement will be disabled.',
      fix: 'This is likely an internal Nuxt bug. Please report it with a reproduction.',
      docs: false,
    },
    NUXT_B7018: {
      why: 'Failed to restrict vite-node socket permissions; closing the socket.',
      fix: 'Check that the temporary directory used for the vite-node socket is writable and supports `chmod`.',
      docs: false,
    },
    NUXT_B7019: {
      why: 'The server webpack build does not externalize dependencies.',
      fix: 'Externalize dependencies in the server build (`externals`) for better build performance.',
      docs: false,
    },
  },
})
