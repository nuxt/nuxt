<template>
  <Suspense @resolve="onResolve">
    <ErrorComponent v-if="error" :error="error" />
    <AppComponent v-else />
  </Suspense>
</template>

<script setup>
import { defineAsyncComponent, onErrorCaptured, provide } from 'vue'
import { callWithNuxt, isNuxtError, showError, useError, useRoute, useNuxtApp } from '#app'
import AppComponent from '#build/app-component.mjs'

const ErrorComponent = defineAsyncComponent(() => import('#build/error-component.mjs').then(r => r.default || r))

const nuxtApp = useNuxtApp()
const onResolve = nuxtApp.deferHydration()

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
    callWithNuxt(nuxtApp, showError, [err])
  }
})
</script>
