import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/**
 * B2xxx
 * Plugin diagnostics (`addPlugin`, plugin metadata, plugin ordering).
 *
 * @internal
 */
export const pluginDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B2001: {
      why: (p: { type: string, name: string }) => `The second argument to \`${p.name}\` is a \`${p.type}\`, not an object literal.`,
      fix: 'Pass an object literal as the second argument, e.g. `defineNuxtPlugin(() => {}, { name: \'my-plugin\' })`.',
      docs: false,
    },
    NUXT_B2002: {
      why: 'Plugin options contain spread elements or computed keys, which are not supported.',
      fix: 'Use static properties instead.',
      docs: false,
    },
    NUXT_B2003: {
      why: '`dependsOn` is not an array of string literals.',
      fix: 'Use string literals in the `dependsOn` array, e.g. `dependsOn: [\'my-plugin\']`.',
      docs: false,
    },
    NUXT_B2004: {
      why: (p: { src: string }) => `Plugin \`${p.src}\` has no content.`,
      fix: 'Add content to the plugin file, or remove it from the `plugins/` directory.',
      docs: false,
    },
    NUXT_B2005: {
      why: (p: { src: string }) => `Plugin \`${p.src}\` has no default export and will be ignored at build time.`,
      fix: 'Add `export default defineNuxtPlugin(() => {})` to your plugin.',
      docs: false,
    },
    NUXT_B2006: {
      why: (p: { src: string }) => `Error parsing plugin \`${p.src}\`.`,
      fix: 'Check the plugin file for syntax errors.',
      docs: false,
    },
    NUXT_B2007: {
      why: (p: { src: string }) => `Plugin \`${p.src}\` is not wrapped in \`defineNuxtPlugin\`.`,
      fix: 'Wrap your plugin with `defineNuxtPlugin`. This may enable enhancements in future.',
      docs: false,
    },
    NUXT_B2008: {
      why: (p: { name: string, missing: string }) => `Plugin \`${p.name}\` depends on \`${p.missing}\` but they are not registered.`,
      fix: 'Register the missing dependency plugins, or remove them from the `dependsOn` array.',
      docs: false,
    },
    NUXT_B2009: {
      why: (p: { cycle: string }) => `Circular dependency detected in plugins: ${p.cycle}.`,
      fix: 'Restructure the plugin `dependsOn` declarations to break the cycle.',
      docs: false,
    },
    NUXT_B2010: {
      why: (p: { src: string }) => `Failed to parse static properties from plugin \`${p.src}\`, falling back to non-optimized runtime meta.`,
      fix: 'Use an object literal with static values as the second argument to `defineNuxtPlugin()`, and check the plugin file for syntax errors or unsupported constructs in the metadata.',
      docs: false,
    },
    NUXT_B2011: {
      why: (p: { src: string }) => `Invalid plugin \`${p.src}\`. The \`src\` option is required.`,
      fix: 'Pass a string path, or an object with a `src` property, to `addPlugin()`.',
      // No dedicated docs page: the inline why+fix is self-sufficient, so we
      // opt out of the auto-generated docs URL rather than ship a 404.
      docs: false,
    },
    NUXT_B2012: {
      why: (p: { name: string, dependencies: string[], mode: 'client' | 'server' }) => {
        const dependencies = p.dependencies.map(name => `\`${name}\``).join(', ')
        const plural = p.dependencies.length > 1
        return `Plugin \`${p.name}\` depends on ${dependencies}, but ${plural ? 'these dependencies are' : 'this dependency is'} unavailable in the ${p.mode} build and will be ignored.`
      },
      fix: 'Do not depend on plugins that are unavailable in the same build environment; remove them from the `dependsOn` array.',
      docs: false,
    },
  },
})
