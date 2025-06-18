import type {
  AllowedComponentProps,
  AnchorHTMLAttributes,
  ComputedRef,
  DefineSetupFnComponent,
  InjectionKey,
  PropType,
  SlotsType,
  UnwrapRef,
  VNode,
  VNodeProps,
} from 'vue'
import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, resolveComponent, shallowRef } from 'vue'
import type { RouteLocation, RouteLocationRaw, Router, RouterLink, RouterLinkProps, UseLinkReturn, useLink } from 'vue-router'
import { hasProtocol, joinURL, parseQuery, withTrailingSlash, withoutTrailingSlash } from 'ufo'
import { preloadRouteComponents } from '../composables/preload'
import { onNuxtReady } from '../composables/ready'
import { navigateTo, resolveRouteObject, useRouter } from '../composables/router'
import { type NuxtApp, useNuxtApp, useRuntimeConfig } from '../nuxt'
import { cancelIdleCallback, requestIdleCallback } from '../compat/idle-callback'

// @ts-expect-error virtual file
import { nuxtLinkDefaults } from '#build/nuxt.config.mjs'

import { hashMode } from '#build/router.options'

const firstNonUndefined = <T> (...args: (T | undefined)[]) => args.find(arg => arg !== undefined)

const NuxtLinkDevKeySymbol: InjectionKey<boolean> = Symbol('nuxt-link-dev-key')

/**
 * `<NuxtLink>` is a drop-in replacement for both Vue Router's `<RouterLink>` component and HTML's `<a>` tag.
 * @see https://nuxt.com/docs/api/components/nuxt-link
 */
export interface NuxtLinkProps<CustomProp extends boolean = false> extends Omit<RouterLinkProps, 'to'> {
  custom?: CustomProp
  /**
   * Route Location the link should navigate to when clicked on.
   */
  to?: RouteLocationRaw // need to manually type to avoid breaking typedPages
  /**
   * An alias for `to`. If used with `to`, `href` will be ignored
   */
  href?: NuxtLinkProps['to']
  /**
   * Forces the link to be considered as external (true) or internal (false). This is helpful to handle edge-cases
   */
  external?: boolean
  /**
   * Where to display the linked URL, as the name for a browsing context.
   */
  target?: '_blank' | '_parent' | '_self' | '_top' | (string & {}) | null
  /**
   * A rel attribute value to apply on the link. Defaults to "noopener noreferrer" for external links.
   */
  rel?: 'noopener' | 'noreferrer' | 'nofollow' | 'sponsored' | 'ugc' | (string & {}) | null
  /**
   * If set to true, no rel attribute will be added to the link
   */
  noRel?: boolean
  /**
   * A class to apply to links that have been prefetched.
   */
  prefetchedClass?: string
  /**
   * When enabled will prefetch middleware, layouts and payloads of links in the viewport.
   */
  prefetch?: boolean
  /**
   * Allows controlling when to prefetch links. By default, prefetch is triggered only on visibility.
   */
  prefetchOn?: 'visibility' | 'interaction' | Partial<{
    visibility: boolean
    interaction: boolean
  }>
  /**
   * Escape hatch to disable `prefetch` attribute.
   */
  noPrefetch?: boolean
  /**
   * An option to either add or remove trailing slashes in the `href` for this specific link.
   * Overrides the global `trailingSlash` option if provided.
   */
  trailingSlash?: 'append' | 'remove'
  /**
   * Event emitted when navigation fails
   */
  onError?: (error: Error) => void
}

/**
 * Create a NuxtLink component with given options as defaults.
 * @see https://nuxt.com/docs/api/components/nuxt-link
 */
export interface NuxtLinkOptions extends
  Partial<Pick<RouterLinkProps, 'activeClass' | 'exactActiveClass'>>,
  Partial<Pick<NuxtLinkProps, 'prefetch' | 'prefetchedClass'>> {
  /**
   * The name of the component.
   * @default "NuxtLink"
   */
  componentName?: string
  /**
   * A default `rel` attribute value applied on external links. Defaults to `"noopener noreferrer"`. Set it to `""` to disable.
   */
  externalRelAttribute?: string | null
  /**
   * An option to either add or remove trailing slashes in the `href`.
   * If unset or not matching the valid values `append` or `remove`, it will be ignored.
   */
  trailingSlash?: 'append' | 'remove'

  /**
   * Allows controlling default setting for when to prefetch links. By default, prefetch is triggered only on visibility.
   */
  prefetchOn?: Exclude<NuxtLinkProps['prefetchOn'], string>
}

type NuxtLinkDefaultSlotProps<CustomProp extends boolean = false> = CustomProp extends true
  ? {
      href: string
      navigate: (e?: MouseEvent) => Promise<void>
      prefetch: (nuxtApp?: NuxtApp) => Promise<void>
      route: (RouteLocation & { href: string }) | undefined
      rel: string | null
      target: '_blank' | '_parent' | '_self' | '_top' | (string & {}) | null
      isExternal: boolean
      isActive: false
      isExactActive: false
    }
  : UnwrapRef<UseLinkReturn>

type NuxtLinkSlots<CustomProp extends boolean = false> = {
  default?: (props: NuxtLinkDefaultSlotProps<CustomProp>) => VNode[]
}

/* @__NO_SIDE_EFFECTS__ */
export function defineNuxtLink (options: NuxtLinkOptions = {}) {
  const componentName = options.componentName || 'NuxtLink'

  return defineComponent({
    name: componentName,
    props: {
      // Routing
      to: {
        type: [String, Object] as PropType<RouteLocationRaw>,
        default: undefined,
        required: false,
      },
      href: {
        type: [String, Object] as PropType<RouteLocationRaw>,
        default: undefined,
        required: false,
      },

      // Attributes
      target: {
        type: String as PropType<NuxtLinkProps['target']>,
        default: undefined,
        required: false,
      },
      rel: {
        type: String as PropType<NuxtLinkProps['rel']>,
        default: undefined,
        required: false,
      },
      noRel: {
        type: Boolean as PropType<NuxtLinkProps['noRel']>,
        default: undefined,
        required: false,
      },

      // Prefetching
      prefetch: {
        type: Boolean as PropType<NuxtLinkProps['prefetch']>,
        default: undefined,
        required: false,
      },
      prefetchOn: {
        type: [String, Object] as PropType<NuxtLinkProps['prefetchOn']>,
        default: undefined,
        required: false,
      },
      noPrefetch: {
        type: Boolean as PropType<NuxtLinkProps['noPrefetch']>,
        default: undefined,
        required: false,
      },

      // Styling
      activeClass: {
        type: String as PropType<NuxtLinkProps['activeClass']>,
        default: undefined,
        required: false,
      },
      exactActiveClass: {
        type: String as PropType<NuxtLinkProps['exactActiveClass']>,
        default: undefined,
        required: false,
      },
      prefetchedClass: {
        type: String as PropType<NuxtLinkProps['prefetchedClass']>,
        default: undefined,
        required: false,
      },

      // Vue Router's `<RouterLink>` additional props
      replace: {
        type: Boolean as PropType<NuxtLinkProps['replace']>,
        default: undefined,
        required: false,
      },
      ariaCurrentValue: {
        type: String as PropType<NuxtLinkProps['ariaCurrentValue']>,
        default: undefined,
        required: false,
      },

      // Edge cases handling
      external: {
        type: Boolean as PropType<NuxtLinkProps['external']>,
        default: undefined,
        required: false,
      },

      // Slot API
      custom: {
        type: Boolean as PropType<NuxtLinkProps['custom']>,
        default: undefined,
        required: false,
      },
      // Behavior
      trailingSlash: {
        type: String as PropType<NuxtLinkProps['trailingSlash']>,
        default: undefined,
        required: false,
      },
      onError: {
        type: Function as PropType<(error: NuxtLinkNavigationError) => void>,
        default: undefined,
        required: false,
      },
    } as unknown as NuxtLinkProps,
    
    emits: {
      error: (error: NuxtLinkNavigationError) => true
    },

    setup (props, { slots, emit }) {
      // Pass options to useNuxtLink
      const { to, href, navigate, isExternal, hasTarget, isAbsoluteUrl, prefetch } = useNuxtLink(props, options)

      // Enhanced navigate function with error handling
      const navigateWithErrorHandling = async (e?: MouseEvent) => {
        try {
          await navigate(e)
        } catch (error) {
          const navigationError = error as NuxtLinkNavigationError
          
          // Emit error event
          emit('error', navigationError)
          
          // Call onError prop if provided
          if (props.onError) {
            props.onError(navigationError)
          }
          
          // Re-throw if no handlers are provided to maintain existing behavior
          if (!props.onError) {
            throw error
          }
        }
      }

      // Prefetch logic
      const shouldPrefetch = (on?: NuxtLinkOptions['prefetchOn']) => {
        return props.prefetch !== false && 
               !props.noPrefetch && 
               typeof to.value === 'string' && 
               !isExternal.value &&
               !hasTarget.value
      }

      return () => {
        if (!isExternal.value && !hasTarget.value) {
          // Internal RouterLink
          const routerLinkProps: RouterLinkProps & VNodeProps & AllowedComponentProps = {
            to: to.value,
            activeClass: props.activeClass || options.activeClass,
            exactActiveClass: props.exactActiveClass || options.exactActiveClass,
            replace: props.replace,
            ariaCurrentValue: props.ariaCurrentValue,
            custom: props.custom,
          }

          if (!props.custom) {
            Object.assign(routerLinkProps, {
              onClick: (e: MouseEvent) => {
                e.preventDefault()
                return navigateWithErrorHandling(e)
              }
            })
          }

          return h(
            resolveComponent('RouterLink') as string,
            routerLinkProps,
            slots.default ? () => slots.default({
              href: href.value,
              navigate: navigateWithErrorHandling,
              get route() {
                if (!href.value) { return undefined }
                return router.resolve(to.value)
              },
              rel: props.rel,
              target: props.target,
              isExternal: false,
              isActive: false,
              isExactActive: false,
            }) : undefined
          )
        }

        // Handle custom prop case
        if (props.custom) {
          if (!slots.default) {
            return null
          }

          return slots.default({
            href: href.value,
            navigate: navigateWithErrorHandling,
            prefetch,
            get route() {
              if (!href.value) { return undefined }
              const url = new URL(href.value, import.meta.client ? window.location.href : 'http://localhost')
              return {
                path: url.pathname,
                fullPath: url.pathname,
                get query() { return parseQuery(url.search) },
                hash: url.hash,
                params: {},
                name: undefined,
                matched: [],
                redirectedFrom: undefined,
                meta: {},
                href: href.value,
              } satisfies RouteLocation & { href: string }
            },
            rel: props.rel,
            target: props.target,
            isExternal: isExternal.value || hasTarget.value,
            isActive: false,
            isExactActive: false,
          })
        }

        // External link (anchor tag)
        return h('a', {
          href: href.value || null,
          rel: props.rel,
          target: props.target,
          onClick: (event: MouseEvent) => {
            event.preventDefault()
            return navigateWithErrorHandling(event)
          },
          onMouseenter: shouldPrefetch('interaction') ? prefetch.bind(null, undefined) : undefined,
          onFocus: shouldPrefetch('interaction') ? prefetch.bind(null, undefined) : undefined,
        }, slots.default?.())
      }
    },
  })
}

export default defineNuxtLink(nuxtLinkDefaults)

// -- NuxtLink utils --
function applyTrailingSlashBehavior (to: string, trailingSlash: NuxtLinkOptions['trailingSlash']): string {
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
    observer ||= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const callback = callbacks.get(entry.target)
        const isVisible = entry.isIntersecting || entry.intersectionRatio > 0
        if (isVisible && callback) { callback() }
      }
    })
    callbacks.set(element, callback)
    observer.observe(element)
    return () => {
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

const IS_2G_RE = /2g/
function isSlowConnection () {
  if (import.meta.server) { return }

  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
  const cn = (navigator as any).connection as { saveData: boolean, effectiveType: string } | null
  if (cn && (cn.saveData || IS_2G_RE.test(cn.effectiveType))) { return true }
  return false
}

// Enhanced error types for better error handling
export interface NuxtLinkNavigationError extends Error {
  name: 'NavigationError' | 'NavigationAborted'
  cause?: unknown
  route?: string
}

// Add onError to NuxtLinkProps interface
function useNuxtLink (props: NuxtLinkProps, options: NuxtLinkOptions = {}) {
  const router = useRouter()
  
  checkPropConflicts(props, 'to', 'href')

  const to = computed(() => {
    const path = props.to || props.href || ''
    return resolveTrailingSlashBehavior(path, props.trailingSlash || options.trailingSlash)
  })

  const isExternal = computed<boolean>(() => {
    // if the user used the `external` prop, use it
    if (props.external) {
      return true
    }

    // if the user used the `target` prop, it's external
    if (props.target && props.target !== '_self') {
      return true
    }

    if (typeof to.value === 'object') {
      return false
    }

    return to.value === '' || to.value == null || hasProtocol(to.value, { acceptRelative: true })
  })

  const hasTarget = computed(() => props.target && props.target !== '_self')

  const isAbsoluteUrl = computed(() => {
    return typeof to.value === 'string' && hasProtocol(to.value, { acceptRelative: true })
  })

  const href = computed(() => {
    if (isExternal.value) {
      return to.value as string
    }

    if (typeof to.value === 'object') {
      return router?.resolve(to.value)?.href ?? null
    }

    return resolveTrailingSlashBehavior(to.value || '', props.trailingSlash || options.trailingSlash) || null
  })

  // Use Vue Router's useLink for internal links
  const link = import.meta.client && !isExternal.value && !hasTarget.value
    ? (() => {
        try {
          return useLink({ to: to as ComputedRef<RouteLocationRaw> })
        } catch {
          return undefined
        }
      })()
    : undefined

  async function prefetch (nuxtApp = useNuxtApp()) {
    if (import.meta.server || isExternal.value || hasTarget.value) { return }

    const path = typeof to.value === 'string'
      ? to.value
      : router.resolve(to.value).fullPath

    await Promise.all([
      nuxtApp.hooks.callHook('link:prefetch', path).catch(() => {}),
      preloadRouteComponents(to.value as string, router).catch(() => {}),
    ])
  }

  return {
    to,
    hasTarget,
    isAbsoluteUrl,
    isExternal,
    href,
    isActive: link?.isActive ?? computed(() => to.value === router.currentRoute.value.path),
    isExactActive: link?.isExactActive ?? computed(() => to.value === router.currentRoute.value.path),
    route: link?.route ?? computed(() => router.resolve(to.value)),
    async navigate (e?: MouseEvent) {
      try {
        await navigateTo(href.value, { 
          replace: props.replace, 
          external: isExternal.value || hasTarget.value 
        })
      } catch (error) {
        // Enhanced error handling for different navigation failure types
        if (error instanceof Error) {
          // Check if it's a route not found error
          if (error.message.includes('Page not found') || error.message.includes('Page Not Found')) {
            const routeError = new Error(`Navigation failed: Route "${to.value}" not found`) as NuxtLinkNavigationError
            routeError.name = 'NavigationError'
            routeError.route = String(to.value)
            throw routeError
          }
          
          // Check if it's a middleware error
          if (error.message.includes('aborted') || error.message.includes('Aborted')) {
            const middlewareError = new Error(`Navigation aborted by middleware`) as NuxtLinkNavigationError
            middlewareError.name = 'NavigationAborted'
            middlewareError.route = String(to.value)
            throw middlewareError
          }
        }
        
        // Re-throw original error with enhanced context
        const navigationError = new Error(`Navigation failed: ${error instanceof Error ? error.message : String(error)}`) as NuxtLinkNavigationError
        navigationError.name = 'NavigationError'
        navigationError.cause = error
        navigationError.route = String(to.value)
        throw navigationError
      }
    },
    prefetch,
  } satisfies ReturnType<typeof useLink> & {
    isAbsoluteUrl: Ref<boolean>
    prefetch: () => Promise<void>
  }
}

// Helper function for trailing slash behavior
function checkPropConflicts (props: NuxtLinkProps, ...keys: (keyof NuxtLinkProps)[]): void {
  if (import.meta.dev && import.meta.client) {
    const resolvedProps = keys.map(k => props[k]).filter(Boolean)
    if (resolvedProps.length > 1) {
      console.warn(`[NuxtLink] You should not use \`${keys.join('` and `')}\` together. \`${keys[resolvedProps.length - 1]}\` will be used.`)
    }
  }
}

function resolveTrailingSlashBehavior (path: string, trailingSlash?: 'append' | 'remove'): string {
  if (!trailingSlash) {
    return path
  }
  return applyTrailingSlashBehavior(path, trailingSlash)
}

function isHashLinkWithoutHashMode (to: RouteLocationRaw): boolean {
  return (typeof to === 'string' && to.startsWith('#')) && !hashMode
}
