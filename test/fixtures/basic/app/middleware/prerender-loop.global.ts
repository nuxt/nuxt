export default defineNuxtRouteMiddleware(async (to) => {
  // Regression for https://github.com/nuxt/nuxt/issues/33871
  // The build used to silently fail when a fetch during prerender caused the
  // renderer to recurse into itself for the same URL. Three shapes are
  // covered:
  //  - `useFetch` self-recursion (exercises both renderer guard and shared
  //    cache cycle detection)
  //  - `useFetch` with a shared key from sibling prerendered pages (exercises
  //    the parallel `sharedPrerenderData` path)
  //  - bare `$fetch` self-recursion (exercises the renderer guard alone, no
  //    `~sharedPrerenderCache` involvement)
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
      // expected: 508 Loop Detected from the renderer guard
    }
  }
})
