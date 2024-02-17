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
  _cleanup: () => void
}

function createRouteAnnouncer (opts: Partial<NuxtRouteAnnouncerOpts> = {}) {
  const message = ref('')
  const politeness = ref(opts.politeness || 'polite')
  const router = useRouter();
  const nuxtApp = useNuxtApp()
  let rafId: number | null = null

  function set (messageValue: string, politenessSetting: string ) {
    politeness.value = politenessSetting
    message.value = messageValue
  }

  function polite (message: string) {
    return set(message, 'polite')
  }

  function assertive (message: string) {
    return set(message, 'assertive')
  }

  let _cleanup = () => {}

  if (import.meta.client) {
    let unsubLoadingFinishHook: () => void
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
    assertive,
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
