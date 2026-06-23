// Regression fixtures for https://github.com/nuxt/nuxt/issues/33871: prerender
// must not deadlock when a fetch re-enters a URL already in the render chain.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/prerender/loop-self') {
    await useFetch('/prerender/loop-self')
  }
  if (to.path === '/prerender/loop-shared-a' || to.path === '/prerender/loop-shared-b') {
    await useFetch('/prerender/loop-shared-target', { key: 'prerender-loop-shared' })
  }
  if (to.path === '/prerender/loop-bare-fetch') {
    try {
      await $fetch('/prerender/loop-bare-fetch')
    } catch {
      // 508 Loop Detected — the renderer breaks the cycle so the build can finish.
    }
  }
})
