/**
 * This file adds module hooks for typed router support.
 */

import type { EditableTreeNode, HookResult } from 'unplugin-vue-router/types'
// to have type errors during dev
declare module '@nuxt/schema' {
  export interface NuxtHooks {
    'pages:extendOne': (page: EditableTreeNode) => HookResult
    'pages:beforeWrite': (rootPage: EditableTreeNode) => HookResult
  }
}

