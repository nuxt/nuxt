import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/**
 * B1xxx
 * Build / compilation diagnostics.
 *
 * @internal
 */
export const buildDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B1001: {
      why: (p: { filename: string }) => `Could not compile template \`${p.filename}\`.`,
      fix: (p: { src?: string }) => p.src ? `Check the template source file at \`${p.src}\` for syntax errors.` : 'Check the `getContents` function of this template for errors.',
      docs: false,
    },
    NUXT_B1002: {
      why: (p: { src: string }) => `Error reading template from \`${p.src}\`.`,
      fix: 'Check that the template `src` path exists and is readable.',
      docs: false,
    },
    NUXT_B1003: {
      why: 'Invalid template. Templates must have either `src` or `getContents`.',
      fix: 'Add a `getContents` function or a `src` path to the `addTemplate()` call.',
      docs: false,
    },
    NUXT_B1004: {
      why: 'Failed to install dependencies.',
      fix: (p: { packages: string }) => `Try installing manually with \`npm install ${p.packages}\`.`,
      docs: false,
    },
    NUXT_B1005: {
      why: (p: { plugin: string, file: string }) => `Plugin \`${p.plugin}\` failed to scan file \`${p.file}\`.`,
      fix: 'Check the file for syntax errors, or report this issue to the plugin author.',
      docs: false,
    },
    NUXT_B1006: {
      why: (p: { file: string }) => `Cannot read file \`${p.file}\`.`,
      fix: 'Check that the file exists and has correct permissions.',
      docs: false,
    },
    NUXT_B1007: {
      why: (p: { plugin: string }) => `Error in \`afterScan\` hook of plugin \`${p.plugin}\`.`,
      fix: 'Check the plugin implementation or report this issue to the plugin author.',
      docs: false,
    },
    NUXT_B1008: {
      why: (p: { function: string, file: string }) => `No factory function found for \`${p.function}\` in file \`${p.file}\`. This is a Nuxt bug.`,
      fix: 'Please report this issue at https://github.com/nuxt/nuxt/issues with the file contents.',
      docs: false,
    },
    NUXT_B1009: {
      why: (p: { functionName: string, name?: string, source?: string }) => `Duplicate keyed function name \`${p.functionName}\`${p.name && p.functionName !== p.name ? ` defined as \`${p.name}\`` : ''} with ${p.source ? `the same source \`${p.source}\`` : 'no source'} found. Overwriting the existing entry.`,
      fix: 'Ensure each keyed function has a unique name, or use a different source to distinguish them.',
      docs: false,
    },
    NUXT_B1010: {
      why: (p: { file: string }) => `Failed to read file \`${p.file}\` as it changed during read.`,
      fix: 'The file was modified while being read, usually by a concurrent process writing to it. Try restarting the build.',
      docs: false,
    },
    NUXT_B1011: {
      why: (p: { file: string }) => `Failed to read file \`${p.file}\`.`,
      fix: 'Check that the file exists and is readable, or try clearing the build cache with `nuxi clean`.',
      docs: false,
    },
    NUXT_B1012: {
      why: (p: { path: string }) => `Skipping unsafe cache path: ${p.path}. This cache file has a path that escapes the project directory (possible path traversal).`,
      fix: 'Delete the cache with `nuxi clean` and rebuild.',
      docs: false,
    },
    NUXT_B1013: {
      why: (p: { file: string }) => `Failed to restore cached file \`${p.file}\`.`,
      fix: 'Try clearing the build cache with `nuxi clean` and rebuilding from scratch.',
      docs: false,
    },
    NUXT_B1014: {
      why: 'Problem checking for external configuration files.',
      fix: 'This is likely a transient file system error. If it persists, check file permissions in your project root.',
      docs: false,
    },
    NUXT_B1015: {
      why: 'Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.',
      fix: 'Install `@parcel/watcher` for better performance: `npm install -D @parcel/watcher`.',
      docs: false,
    },
    NUXT_B1016: {
      why: 'Failed to set up the `@parcel/watcher` file watcher.',
      fix: 'This is likely an environment or file system issue. Watching for file changes may not work; restart the dev server and, if the problem persists, report it.',
      docs: false,
    },
    NUXT_B1017: {
      why: (p: { builder: string }) => `Loading \`${p.builder}\` builder failed.`,
      fix: (p: { builder: string }) => `Run \`npm install ${p.builder}\` to install it.`,
      docs: false,
    },
    NUXT_B1018: {
      why: (p: { builder: string }) => `Loading \`${p.builder}\` server builder failed.`,
      fix: (p: { builder: string }) => `Run \`npm install ${p.builder}\` to install it.`,
      docs: false,
    },
    NUXT_B1019: {
      why: (p: { mode: string }) => `Unknown component mode \`${p.mode}\`. This might be an internal Nuxt bug.`,
      fix: 'If you are a module author, ensure the component `mode` is set to `client`, `server`, or `all`. Otherwise, please report this issue.',
      docs: false,
    },
    NUXT_B1020: {
      why: '`experimental.watcher: "builder"` is set but the active builder does not implement `setupWatcher`. Falling back to the default file watcher.',
      fix: 'Remove `experimental.watcher` from your `nuxt.config`, or use a builder that supports its own watcher.',
      docs: false,
    },
  },
})
