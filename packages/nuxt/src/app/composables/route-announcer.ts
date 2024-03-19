import type { Ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { useNuxtApp, useRouter } from '#app'

export enum Politeness {
  Assertive = 'assertive',
  Polite = 'polite',
  Off = 'off',
}

export type NuxtRouteAnnouncerOpts = {
  /** @default 'polite' */
  politeness: Politeness
}

export type RouteAnnouncer = {
  message: Ref<string>
  politeness: Ref<Politeness>
  set: (message: string, politeness: Politeness) => void
  polite: (message: string) => void
  assertive: (message: string) => void
  _cleanup: () => void
}

function createRouteAnnouncer (opts: Partial<NuxtRouteAnnouncerOpts> = {}) {
  const message = ref('')
  const politeness = ref(opts.politeness || Politeness.Polite)
  const router = useRouter()
  const nuxtApp = useNuxtApp()
  let rafId: number | null = null
  let unsubLoadingFinishHook: () => void = () => {}

  set(document?.title?.trim(), politeness.value)

  function set (messageValue: string = '', politenessSetting: Politeness = Politeness.Polite) {
    message.value = messageValue
    politeness.value = politenessSetting
  }

  function polite (message: string) {
    return set(message, Politeness.Polite)
  }

  function assertive (message: string) {
    return set(message, Politeness.Assertive)
  }

  let _cleanup: () => void = () => {}

  if (import.meta.client) {
    const removeBeforeResolveGuard = router.beforeResolve((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
      cancelAnimationFrame(rafId!)
      if (from.fullPath === to.fullPath) { return }
      unsubLoadingFinishHook = nuxtApp.hook('page:loading:end', () => {
        rafId = requestAnimationFrame(() => {
          set(document?.title?.trim(), politeness.value)
        })
      })
    })

    _cleanup = () => {
      cancelAnimationFrame(rafId!)
      removeBeforeResolveGuard()
      unsubLoadingFinishHook()
    }
  }

  return {
    _cleanup,
    message,
    politeness,
    set,
    polite,
    assertive
  }
}

/**
 * composable to handle the route announcer
 */
export function useRouteAnnouncer (opts: Partial<NuxtRouteAnnouncerOpts> = {}): Omit<RouteAnnouncer, '_cleanup'> {
  const nuxtApp = useNuxtApp()

  // Initialise global route announcer if it doesn't exist already
  const announcer = nuxtApp._routeAnnouncer = nuxtApp._routeAnnouncer || createRouteAnnouncer(opts)
  if (import.meta.client && getCurrentScope()) {
    nuxtApp._routeAnnouncerDeps = nuxtApp._routeAnnouncerDeps || 0
    nuxtApp._routeAnnouncerDeps++
    onScopeDispose(() => {
      nuxtApp._routeAnnouncerDeps!--
      if (nuxtApp._routeAnnouncerDeps === 0) {
        announcer._cleanup()
        delete nuxtApp._routeAnnouncer
      }
    })
  }

  return announcer
}
