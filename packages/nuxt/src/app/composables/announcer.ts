import type { Ref } from 'vue'
import { effectScope, getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'
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
  _regions: Record<AnnouncerPoliteness, Ref<string>>
  _cleanup: () => void
}

/** @internal */
export function createAnnouncer (opts: NuxtAnnouncerOpts = {}, separateRegions = false): NuxtAnnouncer {
  const message = shallowRef('')
  const politeness = shallowRef<AnnouncerPoliteness>(opts.politeness || 'polite')
  const regions = { polite: shallowRef(''), assertive: shallowRef(''), off: shallowRef('') }
  const regionTimers: Partial<Record<AnnouncerPoliteness, ReturnType<typeof setTimeout>>> = {}
  const pendingRegions: Partial<Record<AnnouncerPoliteness, string>> = {}
  let updating = false
  let directUpdateVersion = 0
  let restore: ReturnType<typeof setTimeout> | undefined
  let pendingMessage: string | undefined
  const scope = separateRegions ? effectScope(true) : undefined

  function updateRegion (urgency: AnnouncerPoliteness, value: string) {
    clearTimeout(regionTimers[urgency])
    const region = regions[urgency]
    // Clear and restore a repeated message so the live region changes again.
    if (import.meta.client && value && (region.value === value || pendingRegions[urgency] === value)) {
      pendingRegions[urgency] = value
      region.value = ''
      regionTimers[urgency] = setTimeout(() => {
        delete pendingRegions[urgency]
        delete regionTimers[urgency]
        region.value = value
      }, 100)
    } else {
      delete pendingRegions[urgency]
      region.value = value
    }
  }

  if (scope) {
    // A direct ref update replaces pending repetitions, just like set().
    scope.run(() => watch(message, (value) => {
      if (updating) { return }
      clearTimeout(restore)
      pendingMessage = undefined
      const version = ++directUpdateVersion
      // Wait for synchronous ref writes so the final politeness selects the region.
      queueMicrotask(() => {
        if (version !== directUpdateVersion) { return }
        updateRegion(politeness.value, value)
      })
    }, { flush: 'sync' }))
  }

  function set (messageValue: string = '', politenessSetting: AnnouncerPoliteness = 'polite') {
    directUpdateVersion++
    if (separateRegions) {
      // Each urgency has its own timer, so one announcement cannot cancel another.
      updateRegion(politenessSetting, messageValue)
    }
    clearTimeout(restore)
    updating = true
    politeness.value = politenessSetting
    // a live region is only announced when its content changes
    if (import.meta.client && messageValue && (message.value === messageValue || (message.value === '' && pendingMessage === messageValue))) {
      pendingMessage = messageValue
      message.value = ''
      updating = false
      restore = setTimeout(() => {
        restore = undefined
        pendingMessage = undefined
        updating = true
        message.value = messageValue
        updating = false
      }, 100)
      return
    }
    pendingMessage = undefined
    message.value = messageValue
    updating = false
  }

  return {
    message,
    politeness,
    _regions: regions,
    set,
    polite: msg => set(msg, 'polite'),
    assertive: msg => set(msg, 'assertive'),
    _cleanup () {
      directUpdateVersion++
      scope?.stop()
      for (const urgency of ['polite', 'assertive', 'off'] as const) {
        clearTimeout(regionTimers[urgency])
        regions[urgency].value = ''
        delete pendingRegions[urgency]
      }
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
  return useSharedAnnouncer('_announcer', opts, () => createAnnouncer(opts, true))
}
