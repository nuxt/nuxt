import type { createHead as createClientHead } from '@unhead/vue/client'
import type { ActiveHeadEntry } from '@unhead/vue'
import type { NuxtApp } from '#app/nuxt'

type ClientHead = ReturnType<typeof createClientHead>

export function installClientHead (nuxtApp: NuxtApp, head: ClientHead): void {
  // nuxt.config appHead is set server-side within the renderer
  nuxtApp.vueApp.use(head)

  // pause dom updates until page is ready and between page transitions
  let pauseDOMUpdates = true
  const syncHead = () => {
    pauseDOMUpdates = false
    head.render()
  }
  head.hooks?.hook('dom:beforeRender', (context) => { context.shouldRender = !pauseDOMUpdates })
  nuxtApp.hooks.hook('page:start', () => { pauseDOMUpdates = true })
  // wait for new page before unpausing dom updates (triggered after suspense resolved)
  nuxtApp.hooks.hook('page:finish', () => {
    // app:suspense:resolve hook will unpause the DOM
    if (!nuxtApp.isHydrating) { syncHead() }
  })
  // unpause on error
  nuxtApp.hooks.hook('app:error', syncHead)
  // unpause the DOM once the mount suspense is resolved
  nuxtApp.hooks.hook('app:suspense:resolve', syncHead)

  // Defer head-entry disposal during a page transition.
  const originalPush = head.push.bind(head)
  head.push = ((input: Parameters<typeof head.push>[0], options?: Parameters<typeof head.push>[1]) => {
    const entry = originalPush(input, options) as ActiveHeadEntry<typeof input>
    const originalDispose = entry.dispose.bind(entry)
    entry.dispose = () => {
      const transitionPromise = nuxtApp['~transitionPromise']
      if (transitionPromise) {
        transitionPromise.then(originalDispose)
      } else {
        originalDispose()
      }
    }
    return entry
  }) as typeof head.push
}
