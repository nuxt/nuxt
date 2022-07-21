<template>
  <Suspense @resolve="onResolve">
    <ErrorComponent v-if="error" :error="error" />
    <App v-else />
  </Suspense>
</template>

<script setup>
import { defineAsyncComponent, onErrorCaptured } from 'vue'
import { callWithNuxt, isNuxtError, showError, useError, useNuxtApp } from '#app'

const ErrorComponent = defineAsyncComponent(() => import('#build/error-component.mjs'))

const nuxtApp = useNuxtApp()
const onResolve = () => nuxtApp.callHook('app:suspense:resolve')

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
