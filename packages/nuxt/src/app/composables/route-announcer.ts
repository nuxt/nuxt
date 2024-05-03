import type { Ref } from 'vue'
import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { injectHead } from '@unhead/vue'
import { useNuxtApp } from '#app'

export type Politeness = 'assertive' | 'polite' | 'off'

export type NuxtRouteAnnouncerOpts = {
  /** @default 'polite' */
  politeness?: Politeness
}

export type RouteAnnouncer = {
  message: Ref<string>
  politeness: Ref<Politeness>
  set: (message: string, politeness: Politeness) => void
  polite: (message: string) => void
  assertive: (message: string) => void
  _cleanup: () => void
}

function createRouteAnnouncer (opts: NuxtRouteAnnouncerOpts = {}) {
  const message = ref('')
  const politeness = ref<Politeness>(opts.politeness || 'polite')
  const activeHead = injectHead()

  function set (messageValue: string = '', politenessSetting: Politeness = 'polite') {
    message.value = messageValue
    politeness.value = politenessSetting
  }

  function polite (message: string) {
    return set(message, 'polite')
  }

  function assertive (message: string) {
    return set(message, 'assertive')
  }

  function _updateMessageWithPageHeading () {
    set(document?.title?.trim(), politeness.value)
  }

  function _cleanup () {
    activeHead?.hooks?.removeHook('dom:rendered', _updateMessageWithPageHeading)
  }

  _updateMessageWithPageHeading()

  activeHead?.hooks?.hook('dom:rendered', () => {
    _updateMessageWithPageHeading()
  })

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
 * @since 3.12.0
 */
export function useRouteAnnouncer (opts: Partial<NuxtRouteAnnouncerOpts> = {}): Omit<RouteAnnouncer, '_cleanup'> {
  const nuxtApp = useNuxtApp()

  // Initialise global route announcer if it doesn't exist already
  const announcer = nuxtApp._routeAnnouncer = nuxtApp._routeAnnouncer || createRouteAnnouncer(opts)
  if (opts.politeness !== announcer.politeness.value) {
    announcer.politeness.value = opts.politeness || 'polite'
  }
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
