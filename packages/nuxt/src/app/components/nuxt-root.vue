<template>
  <Suspense @resolve="onResolve">
    <div v-if="abortRender" />
    <ErrorComponent
      v-else-if="error"
      :error="error"
    />
    <IslandRenderer
      v-else-if="islandContext"
      :context="islandContext"
    />
    <component
      :is="SingleRenderer"
      v-else-if="SingleRenderer"
    />
    <AppComponent v-else />
  </Suspense>
</template>

<script setup>
import { defineAsyncComponent, onErrorCaptured, onServerPrefetch, provide } from 'vue'
import { useNuxtApp } from '../nuxt'
import { isNuxtError, showError, useError } from '../composables/error'
import { useRoute, useRouter } from '../composables/router'
import { runtimeWarn } from '../utils'
import { E1009, E1010, E1012 } from '../error-codes'
import { PageRouteSymbol } from '../components/injections'
import AppComponent from '#build/app-component.mjs'
import ErrorComponent from '#build/error-component.mjs'
// @ts-expect-error virtual file
import { componentIslands } from '#build/nuxt.config.mjs'

const IslandRenderer = import.meta.server && componentIslands
  ? defineAsyncComponent(() => import('./island-renderer').then(r => r.default || r))
  : () => null

const nuxtApp = useNuxtApp()
const onResolve = nuxtApp.deferHydration()
if (import.meta.client && nuxtApp.isHydrating) {
  const removeErrorHook = nuxtApp.hooks.hookOnce('app:error', onResolve)
  const removeGuard = useRouter().beforeEach(() => {
    removeErrorHook()
    removeGuard()
  })
}

const url = import.meta.server ? nuxtApp.ssrContext.url : window.location.pathname
const SingleRenderer = import.meta.test && import.meta.dev && import.meta.server && url.startsWith('/__nuxt_component_test__/') && defineAsyncComponent(() => import('#build/test-component-wrapper.mjs')
  .then(r => r.default(import.meta.server ? url : window.location.href)))

// Inject default route (outside of pages) as active route
provide(PageRouteSymbol, useRoute())

// vue:setup hook
const results = nuxtApp.hooks.callHookWith(hooks => hooks.map(hook => hook()), 'vue:setup', [])
if (import.meta.dev && results && results.some(i => i && 'then' in i)) {
  runtimeWarn('Error in `vue:setup`. Callbacks must be synchronous.', { code: E1012, fix: 'Remove `async` from your `vue:setup` hook callback, or move async logic into `onMounted` or a plugin.' })
}

// error handling
const error = useError()
// render an empty <div> when plugins have thrown an error but we're not yet rendering the error page
const abortRender = import.meta.server && error.value && !nuxtApp.ssrContext.error
const BOT_RE = /bot\b|chrome-lighthouse|facebookexternalhit|google\b/i
onErrorCaptured((err, target, info) => {
  nuxtApp.hooks.callHook('vue:error', err, target, info)?.catch(hookError => runtimeWarn('Error in `vue:error` hook.', { code: E1009, fix: 'Check your `vue:error` hook handler for uncaught exceptions.', cause: hookError }))
  if (import.meta.client && BOT_RE.test(navigator.userAgent)) {
    nuxtApp.hooks.callHook('app:error', err)
    runtimeWarn(`Not rendering error page for bot with user agent \`${navigator.userAgent}\`.`, { code: E1010, fix: 'This is expected behavior — bot user agents receive the raw error instead of the error page.', cause: err })
    return false
  }
  if (import.meta.server || (isNuxtError(err) && (err.fatal || err.unhandled))) {
    const p = nuxtApp.runWithContext(() => showError(err))
    onServerPrefetch(() => p)
    return false // suppress error from breaking render
  }
})

// Component islands context
const islandContext = import.meta.server && nuxtApp.ssrContext.islandContext
</script>
