import type { Ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { useNuxtApp, useRouter } from '#app'

export type NuxtRouteAnnouncerOpts = {
  /** @default 'has loaded' */
  complementRoute: string
  /** @default 'polite' */
  politeness: string
}

export type RouteAnnouncer = {
  message: Ref<string>
  politeness: Ref<string>
  set: (message: string, politeness: string) => void
  polite: (message: string) => void
  assertive: (message: string) => void
  setComplementRoute: (complementRoute: string) => void
  _reset: () => void
}

const draf = (cb: () => void) => requestAnimationFrame(() => requestAnimationFrame(cb))

function createRouteAnnouncer (opts: Partial<NuxtRouteAnnouncerOpts> = {}) {
  let { complementRoute = 'has changed'} = opts
  const message = ref('')
  const politeness = ref(opts.politeness || 'polite')
  const router = useRouter();
  const nuxtApp = useNuxtApp()

  router.beforeResolve((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    if (from.fullPath !== to.fullPath) {
      nuxtApp.hook('page:loading:end', () => {
        setTimeout(() => {
          set(document?.title?.trim(), politeness.value)
        })
      })
    }
  })

  function set (messageValue: string, politenessSetting: string, includeCompelentRoute: boolean = true) {
    if (nuxtApp.isHydrating) {
      return
    }
    _reset()
    draf(() => {
      politeness.value = politenessSetting
      message.value = includeCompelentRoute ? `${messageValue} ${complementRoute}` : messageValue
    })
  }

  function polite (message: string) {
    return set(message, 'polite')
  }

  function assertive (message: string) {
    return set(message, 'assertive')
  }

  function _reset () {
    message.value = ''
    politeness.value = opts.politeness || 'polite'
  }

  function setComplementRoute (complementRouteMessage: string) {
    if (typeof complementRoute !== 'string') return
    complementRoute = complementRouteMessage
  }

  return {
    message,
    politeness,
    set,
    polite,
    assertive,
    setComplementRoute
  }
}

/**
 * composable to handle the route announcer
 */
export function useRouteAnnouncer (opts: Partial<NuxtRouteAnnouncerOpts> = {}): Omit<RouteAnnouncer, '_reset'> {
  const nuxtApp = useNuxtApp()

  // Initialise global route announcer if it doesn't exist already
  const announcer = nuxtApp._routeAnnouncer = nuxtApp._routeAnnouncer || createRouteAnnouncer(opts)
  if (import.meta.client && getCurrentScope()) {
    nuxtApp._routeAnnouncerDeps = nuxtApp._routeAnnouncerDeps || 0
    nuxtApp._routeAnnouncerDeps++
    onScopeDispose(() => {
      nuxtApp._routeAnnouncerDeps!--
      if (nuxtApp._routeAnnouncerDeps === 0) {
        announcer._reset()
        delete nuxtApp._routeAnnouncer
      }
    })
  }

  return announcer
}
