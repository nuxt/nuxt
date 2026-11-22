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
  /**
   * message rendered in the polite live region
   * @internal
   */
  politeMessage: Ref<string>
  /**
   * message rendered in the assertive live region
   * @internal
   */
  assertiveMessage: Ref<string>
  politeness: Ref<AnnouncerPoliteness>
  set: (message: string, politeness?: AnnouncerPoliteness) => void
  polite: (message: string) => void
  assertive: (message: string) => void
  _cleanup: () => void
}

type AnnouncerRegion = 'message' | 'polite' | 'assertive'

/** @internal */
export function createAnnouncer (opts: NuxtAnnouncerOpts = {}): NuxtAnnouncer {
  const message = shallowRef('')
  const politeMessage = shallowRef('')
  const assertiveMessage = shallowRef('')
  const politeness = shallowRef<AnnouncerPoliteness>(opts.politeness || 'polite')
  const restoreTimers: Partial<Record<AnnouncerRegion, ReturnType<typeof setTimeout>>> = {}
  const pendingMessages: Partial<Record<AnnouncerRegion, string | undefined>> = {}

  // a live region is only announced when its content changes
  function write (ref: Ref<string>, region: AnnouncerRegion, messageValue: string) {
    if (restoreTimers[region]) {
      clearTimeout(restoreTimers[region])
      restoreTimers[region] = undefined
    }
    if (import.meta.client && messageValue && (ref.value === messageValue || (ref.value === '' && pendingMessages[region] === messageValue))) {
      pendingMessages[region] = messageValue
      ref.value = ''
      restoreTimers[region] = setTimeout(() => {
        restoreTimers[region] = undefined
        pendingMessages[region] = undefined
        ref.value = messageValue
      }, 100)
      return
    }
    pendingMessages[region] = undefined
    ref.value = messageValue
  }

  function set (messageValue: string = '', politenessSetting: AnnouncerPoliteness = 'polite') {
    politeness.value = politenessSetting
    // `message` mirrors the most recent announcement regardless of its urgency
    write(message, 'message', messageValue)
    // each urgency has its own fixed live region so messages never overwrite each other
    if (politenessSetting === 'polite') {
      write(politeMessage, 'polite', messageValue)
    } else if (politenessSetting === 'assertive') {
      write(assertiveMessage, 'assertive', messageValue)
    }
  }

  return {
    message,
    politeMessage,
    assertiveMessage,
    politeness,
    set,
    polite: msg => set(msg, 'polite'),
    assertive: msg => set(msg, 'assertive'),
    _cleanup () {
      for (const timer of Object.values(restoreTimers)) {
        if (timer) {
          clearTimeout(timer)
        }
      }
      restoreTimers.message = restoreTimers.polite = restoreTimers.assertive = undefined
      pendingMessages.message = pendingMessages.polite = pendingMessages.assertive = undefined
      message.value = ''
      politeMessage.value = ''
      assertiveMessage.value = ''
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
