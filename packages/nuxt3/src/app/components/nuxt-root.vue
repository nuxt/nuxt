<template>
  <Suspense @resolve="onResolve">
    <App />
  </Suspense>
</template>

<script>
import { useNuxtApp } from '#app'

export default {
  setup () {
    const nuxtApp = useNuxtApp()
    const results = nuxtApp.hooks.callHookWith(hooks => hooks.map(hook => hook()), 'vue:setup')
    if (process.dev && results && results.some(i => i && 'then' in i)) {
      console.error('[nuxt] Error in `vue:setup`. Callbacks must be synchronous.')
    }
    return {
      onResolve: () => nuxtApp.callHook('app:suspense:resolve')
    }
  }
}
</script>
