import type { ActiveHeadEntry } from '@unhead/vue'
import { headSymbol } from '@unhead/vue'
import type { VueHeadClient } from '@unhead/vue/types'
import type { NuxtApp } from '#app/nuxt'
import { getClientHeadState } from './client-head-state'

import { appHead } from '#build/nuxt.config.mjs'
import { appComponentHead, createClientHead } from '#build/unhead-client.mjs'

export function useClientHead (nuxtApp: NuxtApp): VueHeadClient {
  const state = getClientHeadState(nuxtApp)
  if (!state.head) {
    installClientHead(nuxtApp, createClientHead())
  }
  return state.head!
}

export function installClientHead (nuxtApp: NuxtApp, head: VueHeadClient): void {
  const state = getClientHeadState(nuxtApp)
  state.head = head

  // pause dom updates until page is ready and between page transitions
  const render = head.render
  state.render = render
  head.render = () => {
    if (state.paused) { return false }
    return render()
  }

  // re-push server-only `app.head` so `titleTemplate` survives hydration (#35468)
  head.push(appHead)
  state.pushAppComponentHead = () => {
    for (const input of appComponentHead) {
      head.push(input)
    }
  }
  if (state.rootSetup) {
    state.pushAppComponentHead()
  }

  delete nuxtApp.vueApp._context?.provides[headSymbol]
  nuxtApp.vueApp.use(head)

  head.hooks?.hook('dom:beforeRender', (context) => { context.shouldRender = !state.paused })

  // Defer head-entry disposal during a page transition.
  const originalPush = head.push.bind(head)
  head.push = ((input: Parameters<typeof head.push>[0], options?: Parameters<typeof head.push>[1]) => {
    const entry = originalPush(input, options) as ActiveHeadEntry<typeof input>
    const originalDispose = entry.dispose.bind(entry)
    entry.dispose = () => {
      const transitionPromise = nuxtApp['~transitionPromise']
      if (transitionPromise) {
        transitionPromise.finally(originalDispose)
      } else {
        originalDispose()
      }
    }
    return entry
  }) as typeof head.push
}
