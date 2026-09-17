/**
 * Holds the app's start-up open (plugins are awaited before `app:created`
 * runs) so a test can start a navigation while the router is live but the
 * initial forced `router.replace` has not happened yet.
 */
export default defineNuxtPlugin(async () => {
  if (new URLSearchParams(window.location.search).has('bootgate')) {
    await useTestGate('__releaseBoot')
  }
})
