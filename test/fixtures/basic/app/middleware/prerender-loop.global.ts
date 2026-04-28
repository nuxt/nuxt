export default defineNuxtRouteMiddleware(async (to) => {
  // Regression for https://github.com/nuxt/nuxt/issues/33871
  // The build used to silently fail when middleware called `useFetch` against
  // a path that fell through to the renderer during prerender (creating a
  // recursive render of the same URL). Both code paths (`sharedPrerenderData`
  // dedup hit and miss) need to succeed.
  if (to.path === '/prerender/loop-self') {
    await useFetch('/prerender/loop-self')
  }
  if (to.path === '/prerender/loop-shared-a' || to.path === '/prerender/loop-shared-b') {
    await useFetch('/prerender/loop-shared-target', { key: 'prerender-loop-shared' })
  }
})
