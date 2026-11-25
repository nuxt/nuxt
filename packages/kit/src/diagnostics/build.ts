import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

const builderLoadFix = (p: { builder: string, installCommand: string, installed: boolean }) => p.installed
  ? `\`${p.builder}\` is installed, so the error above comes from loading it. Fix that error: a package it imports may be missing, or at a version it does not support.`
  : `Run \`${p.installCommand}\` to install it.`

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
      fix: (p: { installCommand: string }) => `Try installing manually with \`${p.installCommand}\`.`,
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
      fix: 'Check that the file exists and is readable, or try clearing the build cache with `nuxt clean`.',
      docs: false,
    },
    NUXT_B1012: {
      why: (p: { path: string }) => `Skipping unsafe cache path: ${p.path}. This cache file has a path that escapes the project directory (possible path traversal).`,
      fix: 'Delete the cache with `nuxt clean` and rebuild.',
      docs: false,
    },
    NUXT_B1013: {
      why: (p: { file: string }) => `Failed to restore cached file \`${p.file}\`.`,
      fix: 'Try clearing the build cache with `nuxt clean` and rebuilding from scratch.',
      docs: false,
    },
    NUXT_B1014: {
      why: 'Problem checking for external configuration files.',
      fix: 'This is likely a transient file system error. If it persists, check file permissions in your project root.',
      docs: false,
    },
    NUXT_B1015: {
      why: 'Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.',
      fix: (p: { installCommand: string }) => `Install \`@parcel/watcher\` for better performance: \`${p.installCommand}\`.`,
      docs: false,
    },
    NUXT_B1016: {
      why: 'Failed to set up the `@parcel/watcher` file watcher.',
      fix: 'This is likely an environment or file system issue. Watching for file changes may not work; restart the dev server and, if the problem persists, report it.',
      docs: false,
    },
    NUXT_B1017: {
      why: (p: { builder: string, error: string }) => `Loading \`${p.builder}\` builder failed: ${p.error}`,
      fix: builderLoadFix,
      docs: false,
    },
    NUXT_B1018: {
      why: (p: { builder: string, error: string }) => `Loading \`${p.builder}\` server builder failed: ${p.error}`,
      fix: builderLoadFix,
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
    NUXT_B1021: {
      why: (p: { export: string }) => `Component export name \`${p.export}\` is not a valid JavaScript identifier.`,
      fix: 'If you are a module author, ensure the `export` you register for a component is a valid identifier. Otherwise, please report this issue.',
      docs: false,
    },
    NUXT_B1022: {
      why: (p: { count: number, templates: string }) => `The build stopped with ${p.count} template${p.count === 1 ? '' : 's'} still compiling:\n  - ${p.templates}`,
      fix: 'A `getContents` function returned a promise that never settles. Resolve it before the bundler starts (for example from `pages:resolved` or `nitro:init`), rather than waiting on something that happens during or after bundling.',
      docs: false,
    },
    NUXT_B1023: {
      why: (p: { name: string, version: string, range: string }) => `Nuxt requires \`${p.name}@${p.range}\`, but \`${p.name}@${p.version}\` is installed.`,
      fix: (p: { name: string, installCommand: string, range: string }) => `Run \`${p.installCommand}\` to add a version of \`${p.name}\` matching \`${p.range}\` to your dependencies.`,
      docs: false,
    },
    NUXT_B1024: {
      why: (p: { routes: Array<{ route: string, status?: number }> }) => {
        const shown = p.routes.slice(0, 5).map(r => r.status ? `\`${r.route}\` (${r.status})` : `\`${r.route}\``).join(', ')
        const more = p.routes.length > 5 ? ` and ${p.routes.length - 5} more` : ''
        return `${p.routes.length} route${p.routes.length === 1 ? '' : 's'} failed to prerender: ${shown}${more}.`
      },
      fix: 'Fix the errors logged above, skip the routes with `prerender.ignore` or a `prerender: false` route rule, or set `nitro.prerender.failOnError` to `false` to finish the build anyway.',
      docs: false,
    },
    NUXT_B1025: {
      why: (p: { fn: string, flags: string, file: string }) => `\`@tool\` on \`${p.fn}\` in \`${p.file}\` has unknown flags: ${p.flags}.`,
      fix: 'Use `readonly`, `consequential` or `confirm`, separated by spaces.',
      docs: false,
    },
    NUXT_B1026: {
      why: (p: { fn: string, file: string }) => `The \`@tool\` function \`${p.fn}\` in \`${p.file}\` is not bound to an element, so agents cannot call it.`,
      fix: 'Bind it to `@click` or `@submit` on an element, or to an event on a component, as `fn` or `fn(...args)`.',
      docs: false,
    },
    NUXT_B1027: {
      why: (p: { handler: string, file: string }) => `\`${p.handler}\` in \`${p.file}\` calls a \`@tool\` function, but only handlers written as \`fn\` or \`fn(...args)\` become agent tools.`,
      fix: 'Move the extra logic into the `@tool` function and bind it directly.',
      docs: false,
    },
    NUXT_B1028: {
      why: (p: { fn: string, file: string }) => `The \`@tool\` function \`${p.fn}\` in \`${p.file}\` is inside a \`v-for\` keyed by its index, so agents see positions rather than items.`,
      fix: 'Key the `v-for` by a stable id, such as `:key="item.id"`.',
      docs: false,
    },
    NUXT_B1029: {
      why: (p: { tool: string, problem: string, file: string }) => `The agent tool \`${p.tool}\` in \`${p.file}\` does not follow the tool design guidance: ${p.problem}.`,
      fix: 'Describe what the tool does for the user and when to use it, in up to 500 characters, with a name of up to 30.',
      docs: false,
    },
    NUXT_B1030: {
      why: (p: { source: string, file: string }) => `The form field bound to \`${p.source}\` in \`${p.file}\` has no label, so agents get no description for it.`,
      fix: 'Wrap the field in a `<label>`, point a `<label for>` at its `id`, or add `aria-label`.',
      docs: false,
    },
    NUXT_B1031: {
      why: (p: { file: string }) => `Could not write the agent tools registered while you browse to \`${p.file}\`.`,
      fix: 'Check that the path set in `experimental.webmcp.schema` is writable.',
      docs: false,
    },
  },
})
