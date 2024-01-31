import type {
  AllowedComponentProps, AnchorHTMLAttributes,
  DefineComponent,
  InjectionKey,
  PropType,
  VNodeProps
} from 'vue'
import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, resolveComponent } from 'vue'
import type { RouteLocationRaw } from '#vue-router'
import { hasProtocol, parseQuery, parseURL, withTrailingSlash, withoutTrailingSlash } from 'ufo'

import type { RouterLinkProps } from 'vue-router'
import { preloadRouteComponents } from '../composables/preload'
import { onNuxtReady } from '../composables/ready'
import { navigateTo, useRouter } from '../composables/router'
import { useNuxtApp } from '../nuxt'
import { cancelIdleCallback, requestIdleCallback } from '../compat/idle-callback'

// @ts-expect-error virtual file
import { nuxtLinkDefaults } from '#build/nuxt.config.mjs'

const firstNonUndefined = <T> (...args: (T | undefined)[]) => args.find(arg => arg !== undefined)

const DEFAULT_EXTERNAL_REL_ATTRIBUTE = 'noopener noreferrer'
const NuxtLinkDevKeySymbol: InjectionKey<boolean> = Symbol('nuxt-link-dev-key')

export type NuxtLinkOptions = {
  componentName?: string
  externalRelAttribute?: string | null
  activeClass?: string
  exactActiveClass?: string
  prefetchedClass?: string
  trailingSlash?: 'append' | 'remove'
}

export type NuxtLinkProps = {
  // Routing
  to?: RouteLocationRaw
  href?: RouteLocationRaw
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

/*@__NO_SIDE_EFFECTS__*/
export function defineNuxtLink (options: NuxtLinkOptions) {
  const componentName = options.componentName || 'NuxtLink'

  const checkPropConflicts = (props: NuxtLinkProps, main: keyof NuxtLinkProps, sub: keyof NuxtLinkProps): void => {
    if (import.meta.dev && props[main] !== undefined && props[sub] !== undefined) {
      console.warn(`[${componentName}] \`${main}\` and \`${sub}\` cannot be used together. \`${sub}\` will be ignored.`)
    }
  }

  // TODO migrate to TypeScript props
  return defineComponent({
    name: componentName,
    props: {
      // Routing
      to: {
        type: [String, Object] as PropType<RouteLocationRaw>,
        default: undefined,
        required: false
      },
      href: {
        type: [String, Object] as PropType<RouteLocationRaw>,
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

      // TODO deprecate, prefer more explicit prop name
      // Should the link be rendered using an `a` tag instead of a `RouterLink`
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

      const prefetched = ref(false)
      const el = import.meta.server ? undefined : ref<HTMLElement | null>(null)
      const elRef = import.meta.server ? undefined : (ref: any) => { el!.value = props.custom ? ref?.$el?.nextElementSibling : ref?.$el }

      const link = computed(() => {
        checkPropConflicts(props, 'to', 'href')
        return props.to || props.href || '' // Defaults to empty string (won't render any `href` attribute)
      })
      const href = computed(() => {
        return typeof link.value === 'string' ? link.value : router.resolve(link.value).path
      })
      const as = computed(() => {
        const isExternalLink = hasProtocol(href.value, { acceptRelative: true })
        const forceAnchorTag = props.external
        return !forceAnchorTag && !isExternalLink ? 'RouterLink' : 'a'
      })

      const routerLinkProps = computed(() => {
        const path = applyTrailingSlashBehavior(href.value, options.trailingSlash)
        // we need to provide a unresolved to prop to router-link otherwise it will strip arguments
        const to = typeof link.value === 'string' ? path : {
          ...link.value,
          name: undefined,
          path,
        }
        const attrs: AllowedComponentProps & VNodeProps & RouterLinkProps & AnchorHTMLAttributes = {
          ref: elRef,
          to,
          activeClass: props.activeClass || options.activeClass,
          exactActiveClass: props.exactActiveClass || options.exactActiveClass,
          replace: props.replace,
          ariaCurrentValue: props.ariaCurrentValue,
          custom: props.custom
        }

        // `custom` API cannot support fallthrough attributes as the slot
        // may render fragment or text root nodes (#14897, #19375)
        if (!props.custom) {
          if (prefetched.value) {
            attrs.class = props.prefetchedClass || options.prefetchedClass
          }
          attrs.rel = props.rel
        }
        return attrs
      })

      const anchorProps = computed(() => {
        const to = link.value
        // Resolves `target` value
        const target = props.target || null

        // Resolves `rel`
        checkPropConflicts(props, 'noRel', 'rel')
        const rel = (props.noRel)
          ? null
          // converts `""` to `null` to prevent the attribute from being added as empty (`rel=""`)
          : firstNonUndefined<string | null>(props.rel, options.externalRelAttribute, to ? DEFAULT_EXTERNAL_REL_ATTRIBUTE : '') || null

        return <AnchorHTMLAttributes> { ref: el, href: to, rel, target }
      })

      // we can only prefetch valid vue-router links
      if (import.meta.client && as.value === 'RouterLink') {
        checkPropConflicts(props, 'prefetch', 'noPrefetch')
        const shouldPrefetch = props.prefetch !== false && props.noPrefetch !== true && props.target !== '_blank' && !isSlowConnection()
        if (shouldPrefetch) {
          const nuxtApp = useNuxtApp()
          let idleId: number
          let unobserve: (() => void) | null = null
          onMounted(() => {
            const observer = useObserver()
            onNuxtReady(() => {
              idleId = requestIdleCallback(() => {
                if (el?.value?.tagName) {
                  unobserve = observer!.observe(el.value as HTMLElement, async () => {
                    unobserve?.()
                    unobserve = null

                    await Promise.all([
                      nuxtApp.hooks.callHook('link:prefetch', href.value).catch(() => {}),
                      preloadRouteComponents(link.value, router).catch(() => {})
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

      if (import.meta.dev && import.meta.server && !props.custom) {
        const isNuxtLinkChild = inject(NuxtLinkDevKeySymbol, false)
        if (isNuxtLinkChild) {
          console.log('[nuxt] [NuxtLink] You can\'t nest one <a> inside another <a>. This will cause a hydration error on client-side. You can pass the `custom` prop to take full control of the markup.')
        } else {
          provide(NuxtLinkDevKeySymbol, true)
        }
      }

      return () => {
        if (as.value === 'RouterLink') {
          // Internal link
          return h(
            resolveComponent(as.value),
            routerLinkProps.value,
            slots.default
          )
        }

        if (typeof link.value === 'object') {
          console.log('[nuxt] [NuxtLink] Providing `to` as a vue-router route is not supported with external links.', link.value)
          return null
        }

        const navigate = () => navigateTo(anchorProps.value.href, {
          replace: props.replace,
          external: props.external, // must explicitly opt-in
        })

        // https://router.vuejs.org/api/#custom
        if (props.custom) {
          if (!slots.default) {
            return null
          }

          return slots.default({
            ...anchorProps.value,
            navigate,
            get route () {
              const href = anchorProps.value.href
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
            isExternal: true,
            isActive: false,
            isExactActive: false
          })
        }

        // "a" tag
        return h(as.value, anchorProps.value, slots.default?.())
      }
    }
  }) as unknown as DefineComponent<NuxtLinkProps>
}

export default defineNuxtLink(nuxtLinkDefaults)

// -- NuxtLink utils --
function applyTrailingSlashBehavior (to: string, trailingSlash?: NuxtLinkOptions['trailingSlash']): string {
  if (!trailingSlash || !to) {
    return to
  }
  const normalizeFn = trailingSlash === 'append' ? withTrailingSlash : withoutTrailingSlash
  // Until https://github.com/unjs/ufo/issues/189 is resolved
  const hasProtocolDifferentFromHttp = hasProtocol(to) && !to.startsWith('http')
  if (hasProtocolDifferentFromHttp) {
    return to
  }
  return normalizeFn(to, true)
}

// --- Prefetching utils ---
type CallbackFn = () => void
type ObserveFn = (element: Element, callback: CallbackFn) => () => void

function useObserver (): { observe: ObserveFn } | undefined {
  if (import.meta.server) { return }

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
  if (import.meta.server) { return }

  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
  const cn = (navigator as any).connection as { saveData: boolean, effectiveType: string } | null
  if (cn && (cn.saveData || /2g/.test(cn.effectiveType))) { return true }
  return false
}
