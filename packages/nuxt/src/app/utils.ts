import { useNuxtApp } from './nuxt'
import defu from 'defu'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export type CallbackFn = () => void
export type ObserveFn = (element: Element, callback: CallbackFn) => () => void

export function useIntersectionObserver (options?: Partial<IntersectionObserverInit>): { observe: ObserveFn } {
  if (import.meta.server) { return {observe: () => () => {}} }

  const nuxtApp = useNuxtApp()
  if (nuxtApp._observer) {
    return nuxtApp._observer
  }

  let observer: IntersectionObserver | null = null
  const callbacks = new Map<Element, CallbackFn>()

  const observe: ObserveFn = (element, callback) => {
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const callback = callbacks.get(entry.target)
          const isVisible = entry.isIntersecting || entry.intersectionRatio > 0
          if (isVisible && callback) { callback() }
        }
      },defu(options ?? {},{root: null, rootMargin: "0px", threshold: 0}))
    }
    callbacks.set(element, callback)
    observer.observe(element)
    return () => {
      callbacks.delete(element)
      observer!.unobserve(element)
      if (callbacks.size === 0) {
        observer!.disconnect()
        observer = null
      }
    }
  }

  const _observer = nuxtApp._observer = {
    observe,
  }

  return _observer
}