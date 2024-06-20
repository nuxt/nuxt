import type {
  AllowedComponentProps,
  AnchorHTMLAttributes,
  ComputedRef,
  DefineComponent,
  InjectionKey, PropType,
  VNodeProps,
} from 'vue'
import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, resolveComponent } from 'vue'
import type { RouteLocation, RouteLocationRaw, Router, RouterLink, RouterLinkProps, useLink } from '#vue-router'
import { hasProtocol, joinURL, parseQuery, withTrailingSlash, withoutTrailingSlash } from 'ufo'
import { preloadRouteComponents } from '../composables/preload'
import { onNuxtReady } from '../composables/ready'
import { navigateTo, resolveRouteObject, useRouter } from '../composables/router'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { cancelIdleCallback, requestIdleCallback } from '../compat/idle-callback'

// @ts-expect-error virtual file
import { nuxtLinkDefaults } from '#build/nuxt.config.mjs'

const firstNonUndefined = <T> (...args: (T | undefined)[]) => args.find(arg => arg !== undefined)

const NuxtLinkDevKeySymbol: InjectionKey<boolean> = Symbol('nuxt-link-dev-key')

/**
 * `<NuxtLink>` is a drop-in replacement for both Vue Router's `<RouterLink>` component and HTML's `<a>` tag.
 * @see https://nuxt.com/docs/api/components/nuxt-link
 */
export interface NuxtLinkProps extends Omit<RouterLinkProps, 'to'> {
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
   * Escape hatch to disable `prefetch` attribute.
   */
  noPrefetch?: boolean
}

/**
 * Create a NuxtLink component with given options as defaults.
 * @see https://nuxt.com/docs/api/components/nuxt-link
 */
export interface NuxtLinkOptions extends
  Partial<Pick<RouterLinkProps, 'activeClass' | 'exactActiveClass'>>,
  Partial<Pick<NuxtLinkProps, 'prefetchedClass'>> {
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
}

/* @__NO_SIDE_EFFECTS__ */
export function defineNuxtLink (options: NuxtLinkOptions) {
  const componentName = options.componentName || 'NuxtLink'

  function checkPropConflicts (props: NuxtLinkProps, main: keyof NuxtLinkProps, sub: keyof NuxtLinkProps): void {
    if (import.meta.dev && props[main] !== undefined && props[sub] !== undefined) {
      console.warn(`[${componentName}] \`${main}\` and \`${sub}\` cannot be used together. \`${sub}\` will be ignored.`)
    }
  }

  function resolveTrailingSlashBehavior (to: string, resolve: Router['resolve']): string
  function resolveTrailingSlashBehavior (to: RouteLocationRaw, resolve: Router['resolve']): Exclude<RouteLocationRaw, string>
  function resolveTrailingSlashBehavior (to: RouteLocationRaw | undefined, resolve: Router['resolve']): RouteLocationRaw | RouteLocation | undefined {
    if (!to || (options.trailingSlash !== 'append' && options.trailingSlash !== 'remove')) {
      return to
    }

    if (typeof to === 'string') {
      return applyTrailingSlashBehavior(to, options.trailingSlash)
    }

    const path = 'path' in to && to.path !== undefined ? to.path : resolve(to).path

    const resolvedPath = {
      ...to,
      name: undefined, // named routes would otherwise always override trailing slash behavior
      path: applyTrailingSlashBehavior(path, options.trailingSlash),
    }

    return resolvedPath
  }

  function useNuxtLink (props: NuxtLinkProps) {
    const router = useRouter()
    const config = useRuntimeConfig()

    const hasTarget = computed(() => !!props.target && props.target !== '_self')

    // Lazily check whether to.value has a protocol
    const isAbsoluteUrl = computed(() => {
      const path = props.to || props.href || ''
      return typeof path === 'string' && hasProtocol(path, { acceptRelative: true })
    })

    const builtinRouterLink = resolveComponent('RouterLink') as string | typeof RouterLink
    const useBuiltinLink = builtinRouterLink && typeof builtinRouterLink !== 'string' ? builtinRouterLink.useLink : undefined

    // Resolving link type
    const isExternal = computed<boolean>(() => {
      // External prop is explicitly set
      if (props.external) {
        return true
      }

      const path = props.to || props.href || ''

      // When `to` is a route object then it's an internal link
      if (typeof path === 'object') {
        return false
      }

      return path === '' || isAbsoluteUrl.value
    })

    // Resolving `to` value from `to` and `href` props
    const to: ComputedRef<RouteLocationRaw> = computed(() => {
      checkPropConflicts(props, 'to', 'href')
      const path = props.to || props.href || '' // Defaults to empty string (won't render any `href` attribute)
      if (isExternal.value) { return path }
      return resolveTrailingSlashBehavior(path, router.resolve)
    })

    const link = isExternal.value ? undefined : useBuiltinLink?.({ ...props, to })

    // Resolves `to` value if it's a route location object
    const href = computed(() => {
      if (!to.value || isAbsoluteUrl.value) { return to.value as string }

      if (isExternal.value) {
        const path = typeof to.value === 'object' ? resolveRouteObject(to.value) : to.value
        return resolveTrailingSlashBehavior(path, router.resolve /* will not be called */) as string
      }

      if (typeof to.value === 'object') {
        return router.resolve(to.value)?.href ?? null
      }

      return resolveTrailingSlashBehavior(joinURL(config.app.baseURL, to.value), router.resolve /* will not be called */)
    })

    return {
      to,
      hasTarget,
      isAbsoluteUrl,
      isExternal,
      //
      href,
      isActive: link?.isActive ?? computed(() => to.value === router.currentRoute.value.path),
      isExactActive: link?.isExactActive ?? computed(() => to.value === router.currentRoute.value.path),
      route: link?.route ?? computed(() => router.resolve(to.value)),
      async navigate () {
        await navigateTo(href.value, { replace: props.replace, external: isExternal.value || hasTarget.value })
      },
    } satisfies ReturnType<typeof useLink> & {
      to: ComputedRef<RouteLocationRaw>
      hasTarget: ComputedRef<boolean | null | undefined>
      isAbsoluteUrl: ComputedRef<boolean>
      isExternal: ComputedRef<boolean>
    }
  }

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
    },
    useLink: useNuxtLink,
    setup (props, { slots }) {
      const router = useRouter()

      const { to, href, navigate, isExternal, hasTarget, isAbsoluteUrl } = useNuxtLink(props)

      // Prefetching
      const prefetched = ref(false)
      const el = import.meta.server ? undefined : ref<HTMLElement | null>(null)
      const elRef = import.meta.server ? undefined : (ref: any) => { el!.value = props.custom ? ref?.$el?.nextElementSibling : ref?.$el }

      if (import.meta.client) {
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

                    const path = typeof to.value === 'string'
                      ? to.value
                      : isExternal.value ? resolveRouteObject(to.value) : router.resolve(to.value).fullPath
                    await Promise.all([
                      nuxtApp.hooks.callHook('link:prefetch', path).catch(() => {}),
                      !isExternal.value && !hasTarget.value && preloadRouteComponents(to.value as string, router).catch(() => {}),
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
        if (!isExternal.value && !hasTarget.value) {
          const routerLinkProps: RouterLinkProps & VNodeProps & AllowedComponentProps & AnchorHTMLAttributes = {
            ref: elRef,
            to: to.value,
            activeClass: props.activeClass || options.activeClass,
            exactActiveClass: props.exactActiveClass || options.exactActiveClass,
            replace: props.replace,
            ariaCurrentValue: props.ariaCurrentValue,
            custom: props.custom,
          }

          // `custom` API cannot support fallthrough attributes as the slot
          // may render fragment or text root nodes (#14897, #19375)
          if (!props.custom) {
            if (prefetched.value) {
              routerLinkProps.class = props.prefetchedClass || options.prefetchedClass
            }
            routerLinkProps.rel = props.rel || undefined
          }

          // Internal link
          return h(
            resolveComponent('RouterLink'),
            routerLinkProps,
            slots.default,
          )
        }

        // Resolves `target` value
        const target = props.target || null

        // Resolves `rel`
        checkPropConflicts(props, 'noRel', 'rel')
        const rel = firstNonUndefined<string | null>(
          // converts `""` to `null` to prevent the attribute from being added as empty (`rel=""`)
          props.noRel ? '' : props.rel,
          options.externalRelAttribute,
          /*
          * A fallback rel of `noopener noreferrer` is applied for external links or links that open in a new tab.
          * This solves a reverse tabnapping security flaw in browsers pre-2021 as well as improving privacy.
          */
          (isAbsoluteUrl.value || hasTarget.value) ? 'noopener noreferrer' : '',
        ) || null

        // https://router.vuejs.org/api/#custom
        if (props.custom) {
          if (!slots.default) {
            return null
          }

          return slots.default({
            href: href.value,
            navigate,
            get route () {
              if (!href.value) { return undefined }

              const url = new URL(href.value, import.meta.client ? window.location.href : 'http://localhost')
              return {
                path: url.pathname,
                fullPath: url.pathname,
                get query () { return parseQuery(url.search) },
                hash: url.hash,
                params: {},
                name: undefined,
                matched: [],
                redirectedFrom: undefined,
                meta: {},
                href: href.value,
              } satisfies RouteLocation & { href: string }
            },
            rel,
            target,
            isExternal: isExternal.value || hasTarget.value,
            isActive: false,
            isExactActive: false,
          })
        }

        // converts `""` to `null` to prevent the attribute from being added as empty (`href=""`)
        return h('a', { ref: el, href: href.value || null, rel, target }, slots.default?.())
      }
    },
  }) as unknown as DefineComponent<NuxtLinkProps>
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
    observe,
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
