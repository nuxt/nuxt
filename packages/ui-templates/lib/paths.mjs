/**
 * Files copied out of the `@nuxt/ui-templates` build into other packages, keyed by their path
 * relative to the repository root and mapped to their source within the build output.
 * @type {Record<string, string>}
 */
export const generatedTemplateCopies = {
  'packages/nuxt/src/app/components/error-404.vue': 'templates/error-404.vue',
  'packages/nuxt/src/app/components/error-500.vue': 'templates/error-500.vue',
  'packages/nuxt/src/app/components/welcome.vue': 'templates/welcome.vue',
  'packages/nuxt/src/runtime/server/renderer/error-template.ts': 'templates/error-500.ts',
  'packages/nitro-server/src/templates/spa-loading-icon.ts': 'templates/spa-loading-icon.ts',
  'packages/vite-server/src/templates/spa-loading-icon.ts': 'templates/spa-loading-icon.ts',
  'packages/schema/src/templates/loading.ts': 'templates/loading.ts',
}

/**
 * Every committed file written by the `@nuxt/ui-templates` build, relative to the repository root.
 */
export const generatedOutputs = [
  'packages/ui-templates/test/__snapshots__/templates.spec.ts.snap',
  ...Object.keys(generatedTemplateCopies),
]
