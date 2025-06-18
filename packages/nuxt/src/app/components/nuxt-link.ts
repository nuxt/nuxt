import { computed, defineComponent, h, resolveComponent } from 'vue'
import type { PropType, VNodeProps, AllowedComponentProps, ComputedRef, Ref } from 'vue'
import type { RouteLocation, RouteLocationRaw, RouterLinkProps, UseLinkReturn } from 'vue-router'
import { useLink } from 'vue-router'
import { hasProtocol, parseQuery, withQuery, withTrailingSlash, withoutTrailingSlash } from 'ufo'
import { preloadRouteComponents } from '../composables/preload'
import { navigateTo, useRouter } from '../composables/router'
import { useNuxtApp } from '../nuxt'
import type { NuxtApp } from '../nuxt'
import { cancelIdleCallback, requestIdleCallback } from '../compat/idle-callback'

// Get the default options from runtime config or set defaults
const hashMode = false

// Interface definitions
export interface NuxtLinkNavigationError extends Error {
  name: 'NavigationError' | 'NavigationAborted'
  cause?: unknown
  route?: string
}

export interface NuxtLinkProps<CustomProp extends boolean = false> extends Omit<RouterLinkProps, 'to'> {
  // Main route
  to?: RouteLocationRaw
  href?: RouteLocationRaw

  // Attributes
  target?: string
  rel?: string | null
  noRel?: boolean

  // Prefetching
  prefetch?: boolean
  noPrefetch?: boolean
  prefetchedClass?: string
  prefetchOn?: Partial<{
    visibility: boolean
    interaction: boolean
  }>

  // Styling
  activeClass?: string
  exactActiveClass?: string

  // Vue Router's `<RouterLink>` additional props
  replace?: boolean
  ariaCurrentValue?: string

  // Edge cases handling
  external?: boolean
  custom?: boolean

  // Trailing slash behavior
  trailingSlash?: 'append' | 'remove'

  // Error handling
  onError?: (error: NuxtLinkNavigationError) => void
}

export interface NuxtLinkOptions extends
  Partial<Pick<RouterLinkProps, 'activeClass' | 'exactActiveClass'>>,
  Partial<Pick<NuxtLinkProps, 'prefetch' | 'prefetchedClass'>> {
  componentName?: string
  externalRelAttribute?: string | null
  trailingSlash?: 'append' | 'remove'
  prefetchOn?: Partial<{
    visibility: boolean
    interaction: boolean
  }>
}

// Helper function for trailing slash behavior
function applyTrailingSlashBehavior (path: string, trailingSlash: 'append' | 'remove'): string {
  if (trailingSlash === 'append') {
    return withTrailingSlash(path)
  }
  if (trailingSlash === 'remove') {
    return withoutTrailingSlash(path)
  }
  return path
}

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

function useNuxtLink (props: NuxtLinkProps, options: NuxtLinkOptions = {}) {
  const router = useRouter()
  
  checkPropConflicts(props, 'to', 'href')

  const to = computed(() => {
    const path = props.to || props.href || ''
    return resolveTrailingSlashBehavior(String(path), props.trailingSlash || options.trailingSlash)
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

  const hasTarget = computed(() => Boolean(props.target && props.target !== '_self'))

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
  const link: UseLinkReturn | undefined = import.meta.client && !isExternal.value && !hasTarget.value
    ? (() => {
        try {
          return useLink({ to: to as ComputedRef<RouteLocationRaw> })
        } catch {
          return undefined
        }
      })()
    : undefined

  async function prefetch (nuxtApp: NuxtApp = useNuxtApp()) {
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
    href: href as ComputedRef<string>,
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
  } satisfies {
    to: ComputedRef<RouteLocationRaw>
    hasTarget: ComputedRef<boolean>
    isAbsoluteUrl: ComputedRef<boolean>
    isExternal: ComputedRef<boolean>
    href: ComputedRef<string>
    isActive: ComputedRef<boolean>
    isExactActive: ComputedRef<boolean>
    route: ComputedRef<RouteLocation>
    navigate: (e?: MouseEvent) => Promise<void>
    prefetch: () => Promise<void>
  }
}

export function defineNuxtLink (options: NuxtLinkOptions = {}) {
  const componentName = options.componentName || 'NuxtLink'

  return defineComponent({
    name: componentName,
    props: {
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
      target: {
        type: String,
        default: undefined,
        required: false,
      },
      rel: {
        type: String,
        default: undefined,
        required: false,
      },
      noRel: {
        type: Boolean,
        default: undefined,
        required: false,
      },
      prefetch: {
        type: Boolean,
        default: undefined,
        required: false,
      },
      noPrefetch: {
        type: Boolean,
        default: undefined,
        required: false,
      },
      activeClass: {
        type: String,
        default: undefined,
        required: false,
      },
      exactActiveClass: {
        type: String,
        default: undefined,
        required: false,
      },
      prefetchedClass: {
        type: String,
        default: undefined,
        required: false,
      },
      replace: {
        type: Boolean,
        default: undefined,
        required: false,
      },
      ariaCurrentValue: {
        type: String,
        default: undefined,
        required: false,
      },
      external: {
        type: Boolean,
        default: undefined,
        required: false,
      },
      custom: {
        type: Boolean,
        default: undefined,
        required: false,
      },
      trailingSlash: {
        type: String as PropType<'append' | 'remove'>,
        default: undefined,
        required: false,
      },
      onError: {
        type: Function as PropType<(error: NuxtLinkNavigationError) => void>,
        default: undefined,
        required: false,
      },
    },
    
    emits: {
      error: (error: NuxtLinkNavigationError) => true
    },

    setup (props: NuxtLinkProps, { slots, emit }: { slots: any, emit: any }) {
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
      const shouldPrefetch = (on: 'interaction' | 'visibility') => {
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
              // Add other slot props as needed
            }) : undefined
          )
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

// Create default NuxtLink component
const nuxtLinkDefaults: NuxtLinkOptions = {
  componentName: 'NuxtLink'
}

export default defineNuxtLink(nuxtLinkDefaults)
