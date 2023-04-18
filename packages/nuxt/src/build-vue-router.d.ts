/**
 * This file adds types for `#build/vue-router` and other build-time generated files that depend on Project
 * Configuration.
 */

export {}

// declare module '#build/vue-router' {
//   export * from 'vue-router'
// }

// to have type errors during dev
declare module '@nuxt/schema' {
  export interface NuxtHooks {
    'pages:extendOne': (page: EditableTreeNode) => HookResult;
    'pages:beforeWrite': (rootPage: EditableTreeNode) => HookResult;
  }
}

