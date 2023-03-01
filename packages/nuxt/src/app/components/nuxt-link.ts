import type { PropType, DefineComponent, ComputedRef } from 'vue'
import { defineComponent, h, ref, resolveComponent, computed, onMounted, onBeforeUnmount } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { hasProtocol, parseQuery, parseURL } from 'ufo'

import { preloadRouteComponents } from '../composables/preload'
import { onNuxtReady } from '../composables/ready'
import { navigateTo, useRouter } from '../composables/router'
import { useNuxtApp } from '../nuxt'
import { cancelIdleCallback, requestIdleCallback } from '../compat/idle-callback'

const firstNonUndefined = <T> (...args: (T | undefined)[]) => args.find(arg => arg !== undefined)

const DEFAULT_EXTERNAL_REL_ATTRIBUTE = 'noopener noreferrer'

export type NuxtLinkOptions = {
  componentName?: string
  externalRelAttribute?: string | null
  activeClass?: string
  exactActiveClass?: string
  prefetchedClass?: string
}

export type NuxtLinkProps = {
  // Routing
  to?: string | RouteLocationRaw
  href?: string | RouteLocationRaw
  external?: boolean
  replace?: boolean
  custom?: boolean

  // Attributes
  target?: '_blank' | '_parent' | '_self' | '_top' | (string & {}) | null
  rel?: string | null
  noRel?: boolean

  prefetch?: boolean
  noPrefetch?: boolean

  // Styling
  activeClass?: string
  exactActiveClass?: string

  // Vue Router's `<RouterLink>` additional props
  ariaCurrentValue?: string
}

export function defineNuxtLink (options: NuxtLinkOptions) {
  const componentName = options.componentName || 'NuxtLink'

  const checkPropConflicts = (props: NuxtLinkProps, main: keyof NuxtLinkProps, sub: keyof NuxtLinkProps): void => {
    if (process.dev && props[main] !== undefined && props[sub] !== undefined) {
      console.warn(`[${componentName}] \`${main}\` and \`${sub}\` cannot be used together. \`${sub}\` will be ignored.`)
    }
  }

  return defineComponent({
    name: componentName,
    props: {
      // Routing
      to: {
        type: [String, Object] as PropType<string | RouteLocationRaw>,
        default: undefined,
        required: false
      },
      href: {
        type: [String, Object] as PropType<string | RouteLocationRaw>,
        default: undefined,
        required: false
      },

      // Attributes
      target: {
        type: String as PropType<string>,
        default: undefined,
        required: false
      },
      rel: {
        type: String as PropType<string>,
        default: undefined,
        required: false
      },
      noRel: {
        type: Boolean as PropType<boolean>,
        default: undefined,
        required: false
      },

      // Prefetching
      prefetch: {
        type: Boolean as PropType<boolean>,
        default: undefined,
        required: false
      },
      noPrefetch: {
        type: Boolean as PropType<boolean>,
        default: undefined,
        required: false
      },

      // Styling
      activeClass: {
        type: String as PropType<string>,
        default: undefined,
        required: false
      },
      exactActiveClass: {
        type: String as PropType<string>,
        default: undefined,
        required: false
      },
      prefetchedClass: {
        type: String as PropType<string>,
        default: undefined,
        required: false
      },

      // Vue Router's `<RouterLink>` additional props
      replace: {
        type: Boolean as PropType<boolean>,
        default: undefined,
        required: false
      },
      ariaCurrentValue: {
        type: String as PropType<string>,
        default: undefined,
        required: false
      },

      // Edge cases handling
      external: {
        type: Boolean as PropType<boolean>,
        default: undefined,
        required: false
      },

      // Slot API
      custom: {
        type: Boolean as PropType<boolean>,
        default: undefined,
        required: false
      }
    },
    setup (props, { slots }) {
      const router = useRouter()

      // Resolving `to` value from `to` and `href` props
      const to: ComputedRef<string | RouteLocationRaw> = computed(() => {
        checkPropConflicts(props, 'to', 'href')

        return props.to || props.href || '' // Defaults to empty string (won't render any `href` attribute)
      })

      // Resolving link type
      const isExternal = computed<boolean>(() => {
        // External prop is explicitly set
        if (props.external) {
          return true
        }

        // When `target` prop is set, link is external
        if (props.target && props.target !== '_self') {
          return true
        }

        // When `to` is a route object then it's an internal link
        if (typeof to.value === 'object') {
          return false
        }

        return to.value === '' || hasProtocol(to.value, true)
      })

      // Prefetching
      const prefetched = ref(false)
      const el = process.server ? undefined : ref<HTMLElement | null>(null)
      if (process.client) {
        checkPropConflicts(props, 'prefetch', 'noPrefetch')
        const shouldPrefetch = props.prefetch !== false && props.noPrefetch !== true && props.target !== '_blank' && !isSlowConnection()
        if (shouldPrefetch) {
          const nuxtApp = useNuxtApp()
          let idleId: number
          let unobserve: (() => void)| null = null
          onMounted(() => {
            const observer = useObserver()
            onNuxtReady(() => {
              idleId = requestIdleCallback(() => {
                if (el?.value?.tagName) {
                  unobserve = observer!.observe(el.value, async () => {
                    unobserve?.()
                    unobserve = null

                    const path = typeof to.value === 'string' ? to.value : router.resolve(to.value).fullPath
                    await Promise.all([
                      nuxtApp.hooks.callHook('link:prefetch', path).catch(() => {}),
                      !isExternal.value && preloadRouteComponents(to.value as string, router).catch(() => {})
                    ])
                    prefetched.value = true
                  })
                }
              })
            })
          })
          onBeforeUnmount(() => {
            if (idleId) { cancelIdleCallback(idleId) }
            unobserve?.()
            unobserve = null
          })
        }
      }

      return () => {
        if (!isExternal.value) {
          // Internal link
          return h(
            resolveComponent('RouterLink'),
            {
              ref: process.server ? undefined : (ref: any) => { el!.value = ref?.$el },
              to: to.value,
              ...((prefetched.value && !props.custom) ? { class: props.prefetchedClass || options.prefetchedClass } : {}),
              activeClass: props.activeClass || options.activeClass,
              exactActiveClass: props.exactActiveClass || options.exactActiveClass,
              replace: props.replace,
              ariaCurrentValue: props.ariaCurrentValue,
              custom: props.custom,
              rel: props.rel
            },
            slots.default
          )
        }

        // Resolves `to` value if it's a route location object
        // converts `'''` to `null` to prevent the attribute from being added as empty (`href=""`)
        const href = typeof to.value === 'object' ? router.resolve(to.value)?.href ?? null : to.value || null

        // Resolves `target` value
        const target = props.target || null

        // Resolves `rel`
        checkPropConflicts(props, 'noRel', 'rel')
        const rel = (props.noRel)
          ? null
          // converts `""` to `null` to prevent the attribute from being added as empty (`rel=""`)
          : firstNonUndefined<string | null>(props.rel, options.externalRelAttribute, href ? DEFAULT_EXTERNAL_REL_ATTRIBUTE : '') || null

        const navigate = () => navigateTo(href, { replace: props.replace })

        // https://router.vuejs.org/api/#custom
        if (props.custom) {
          if (!slots.default) {
            return null
          }

          return slots.default({
            href,
            navigate,
            get route () {
              if (!href) { return undefined }

              const url = parseURL(href)
              return {
                path: url.pathname,
                fullPath: url.pathname,
                get query () { return parseQuery(url.search) },
                hash: url.hash,
                // stub properties for compat with vue-router
                params: {},
                name: undefined,
                matched: [],
                redirectedFrom: undefined,
                meta: {},
                href
              }
            },
            rel,
            target,
            isExternal: isExternal.value,
            isActive: false,
            isExactActive: false
          })
        }

        return h('a', { ref: el, href, rel, target }, slots.default?.())
      }
    }
  }) as unknown as DefineComponent<NuxtLinkProps>
}

export default defineNuxtLink({ componentName: 'NuxtLink' })

// --- Prefetching utils ---
type CallbackFn = () => void
type ObserveFn = (element: Element, callback: CallbackFn) => () => void

function useObserver (): { observe: ObserveFn } | undefined {
  if (process.server) { return }

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
      })
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
    observe
  }

  return _observer
}

function isSlowConnection () {
  if (process.server) { return }

  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
  const cn = (navigator as any).connection as { saveData: boolean, effectiveType: string } | null
  if (cn && (cn.saveData || /2g/.test(cn.effectiveType))) { return true }
  return false
}
