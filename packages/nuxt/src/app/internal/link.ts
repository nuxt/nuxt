import { useNuxtApp } from '../nuxt'
import { onNuxtReady } from '../composables/ready'

/**
 * Whether a click should be handled as a client-side navigation rather than by the browser.
 * @internal
 */
export function guardEvent (e: MouseEvent, anchor: Element | undefined): boolean {
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) { return false }
  if (e.button !== undefined && e.button !== 0) { return false }
  if (anchor) {
    const target = anchor.getAttribute('target')
    if (target && /\b_blank\b/i.test(target)) { return false }
  }
  return true
}

type CallbackFn = () => void
type ObserveFn = (element: Element, callback: CallbackFn, whenReady?: boolean) => () => void

/** @internal */
export function useObserver (): { observe: ObserveFn } | undefined {
  if (import.meta.server) { return }

  const nuxtApp = useNuxtApp()
  if (nuxtApp._observer) {
    return nuxtApp._observer
  }

  let observer: IntersectionObserver | null = null

  const callbacks = new Map<Element, CallbackFn>()
  const pending = new Set<Element>()
  let flushScheduled = false

  const start = (element: Element) => {
    observer ||= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const callback = callbacks.get(entry.target)
        const isVisible = entry.isIntersecting || entry.intersectionRatio > 0
        if (isVisible && callback) { callback() }
      }
    })
    observer.observe(element)
  }

  const observe: ObserveFn = (element, callback, whenReady) => {
    callbacks.set(element, callback)
    if (!whenReady) {
      start(element)
    } else {
      pending.add(element)
      if (!flushScheduled) {
        flushScheduled = true
        nuxtApp.runWithContext(() => onNuxtReady(() => {
          flushScheduled = false
          pending.forEach(start)
          pending.clear()
        }))
      }
    }
    return () => {
      pending.delete(element)
      callbacks.delete(element)
      observer?.unobserve(element)
      if (callbacks.size === 0) {
        observer?.disconnect()
        observer = null
      }
    }
  }

  const _observer = nuxtApp._observer = {
    observe,
  }

  return _observer
}
