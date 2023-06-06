<template>
  <Suspense @resolve="onResolve">
    <ErrorComponent v-if="error" :error="error" />
    <IslandRenderer v-else-if="islandContext" :context="islandContext" />
    <component :is="SingleRenderer" v-else-if="SingleRenderer" />
    <AppComponent v-else />
  </Suspense>
</template>

<script setup>
import { defineAsyncComponent, onErrorCaptured, onServerPrefetch, provide } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import { isNuxtError, showError, useError } from '#app/composables/error'
import { useRoute } from '#app/composables/router'
import AppComponent from '#build/app-component.mjs'
import errorComponent from '#build/error-component.mjs'

// We import ErrorComponent synchronously so that it will be pulled into the default bundle.  That way if there
// are network issues later we will still be able to render the error.
const ErrorComponent = errorComponent.default || errorComponent

const IslandRenderer = process.server
  ? defineAsyncComponent(() => import('./island-renderer').then(r => r.default || r))
  : () => null

const nuxtApp = useNuxtApp()
const onResolve = nuxtApp.deferHydration()

const url = process.server ? nuxtApp.ssrContext.url : window.location.pathname
const SingleRenderer = process.test && process.dev && process.server && url.startsWith('/__nuxt_component_test__/') && /* #__PURE__ */ defineAsyncComponent(() => import('#build/test-component-wrapper.mjs')
  .then(r => r.default(process.server ? url : window.location.href)))

// Inject default route (outside of pages) as active route
provide('_route', useRoute())

// vue:setup hook
const results = nuxtApp.hooks.callHookWith(hooks => hooks.map(hook => hook()), 'vue:setup')
if (process.dev && results && results.some(i => i && 'then' in i)) {
  console.error('[nuxt] Error in `vue:setup`. Callbacks must be synchronous.')
}

// error handling
const error = useError()
onErrorCaptured((err, target, info) => {
  nuxtApp.hooks.callHook('vue:error', err, target, info).catch(hookError => console.error('[nuxt] Error in `vue:error` hook', hookError))
  if (process.server || (isNuxtError(err) && (err.fatal || err.unhandled))) {
    const p = nuxtApp.runWithContext(() => showError(err))
    onServerPrefetch(() => p)
    return false // suppress error from breaking render
  }
})

// Component islands context
const { islandContext } = process.server && nuxtApp.ssrContext
</script>
