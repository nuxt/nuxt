import type { Ref } from 'vue'
import { getCurrentScope, onScopeDispose, shallowRef } from 'vue'
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

/** @internal */
export function createAnnouncer (opts: NuxtAnnouncerOpts = {}): NuxtAnnouncer {
  const message = shallowRef('')
  const politeness = shallowRef<AnnouncerPoliteness>(opts.politeness || 'polite')
  let restore: ReturnType<typeof setTimeout> | undefined
  let pendingMessage: string | undefined

  function set (messageValue: string = '', politenessSetting: AnnouncerPoliteness = 'polite') {
    clearTimeout(restore)
    politeness.value = politenessSetting
    // a live region is only announced when its content changes
    if (import.meta.client && messageValue && (message.value === messageValue || (message.value === '' && pendingMessage === messageValue))) {
      pendingMessage = messageValue
      message.value = ''
      restore = setTimeout(() => {
        restore = undefined
        pendingMessage = undefined
        message.value = messageValue
      }, 100)
      return
    }
    pendingMessage = undefined
    message.value = messageValue
  }

  return {
    message,
    politeness,
    set,
    polite: msg => set(msg, 'polite'),
    assertive: msg => set(msg, 'assertive'),
    _cleanup () {
      clearTimeout(restore)
      pendingMessage = undefined
      message.value = ''
      politeness.value = opts.politeness || 'polite'
    },
  }
}

/** @internal */
export function useSharedAnnouncer (key: '_announcer' | '_routeAnnouncer', opts: NuxtAnnouncerOpts, create: () => NuxtAnnouncer): Omit<NuxtAnnouncer, '_cleanup'> {
  const nuxtApp = useNuxtApp()
  const announcer = nuxtApp[key] ||= create()

  if (opts.politeness && opts.politeness !== announcer.politeness.value) {
    announcer.politeness.value = opts.politeness
  }

  if (import.meta.client && getCurrentScope()) {
    const depsKey = `${key}Deps` as const
    nuxtApp[depsKey] = (nuxtApp[depsKey] || 0) + 1
    onScopeDispose(() => {
      if (--nuxtApp[depsKey]! === 0) {
        announcer._cleanup()
        delete nuxtApp[key]
      }
    })
  }

  return announcer
}

/**
 * Composable for announcing messages to screen readers
 * @since 4.4.2
 * @example
 * const { polite, assertive } = useAnnouncer()
 * polite('Item saved successfully')
 * assertive('Error: Form is invalid')
 */
export function useAnnouncer (opts: NuxtAnnouncerOpts = {}): Omit<NuxtAnnouncer, '_cleanup'> {
  return useSharedAnnouncer('_announcer', opts, () => createAnnouncer(opts))
}
