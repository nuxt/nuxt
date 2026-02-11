import type { Ref } from 'vue'
import { getCurrentScope, nextTick, onScopeDispose, shallowRef } from 'vue'
import { useNuxtApp } from '../nuxt'

export type AnnouncerPoliteness = 'assertive' | 'polite' | 'off'

export type NuxtAnnouncerOpts = {
  /** @default 'polite' */
  politeness?: AnnouncerPoliteness
}

export type NuxtAnnouncer = {
  message: Ref<string>
  politeness: Ref<AnnouncerPoliteness>
  set: (message: string, politeness?: AnnouncerPoliteness) => void
  polite: (message: string) => void
  assertive: (message: string) => void
  _cleanup: () => void
}

function createAnnouncer (opts: NuxtAnnouncerOpts = {}): NuxtAnnouncer {
  const message = shallowRef('')
  const politeness = shallowRef<AnnouncerPoliteness>(opts.politeness || 'polite')

  function set (messageValue: string = '', politenessSetting: AnnouncerPoliteness = 'polite') {
    // Clear first to ensure re-announcement of same message
    message.value = ''
    nextTick(() => {
      message.value = messageValue
      politeness.value = politenessSetting
    })
  }

  function polite (msg: string) {
    set(msg, 'polite')
  }

  function assertive (msg: string) {
    set(msg, 'assertive')
  }

  function _cleanup () {
    message.value = ''
    politeness.value = opts.politeness || 'polite'
  }

  return {
    message,
    politeness,
    set,
    polite,
    assertive,
    _cleanup,
  }
}

/**
 * Composable for announcing messages to screen readers
 * @since 3.17.0
 * @example
 * const { polite, assertive } = useAnnouncer()
 * polite('Item saved successfully')
 * assertive('Error: Form is invalid')
 */
export function useAnnouncer (opts: NuxtAnnouncerOpts = {}): Omit<NuxtAnnouncer, '_cleanup'> {
  const nuxtApp = useNuxtApp()

  // Initialise global announcer if it doesn't exist already
  const announcer = nuxtApp._announcer ||= createAnnouncer(opts)

  // Update politeness if different from current
  if (opts.politeness && opts.politeness !== announcer.politeness.value) {
    announcer.politeness.value = opts.politeness
  }

  if (import.meta.client && getCurrentScope()) {
    nuxtApp._announcerDeps ||= 0
    nuxtApp._announcerDeps++
    onScopeDispose(() => {
      nuxtApp._announcerDeps!--
      if (nuxtApp._announcerDeps === 0) {
        announcer._cleanup()
        delete nuxtApp._announcer
      }
    })
  }

  return announcer
}
