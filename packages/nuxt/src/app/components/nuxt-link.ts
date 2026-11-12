import type {
  AnchorHTMLAttributes,
  Component,
  ComponentInternalInstance,
  ComputedRef,
  DefineSetupFnComponent,
  InjectionKey,
  MaybeRef,
  PropType,
  PublicProps,
  Slot,
  Slots,
  SlotsType,
  VNode,
} from 'vue'
import { computed, createBlock, createElementBlock, createVNode, defineComponent, h, inject, normalizeClass, normalizeStyle, onBeforeUnmount, onMounted, openBlock, provide, ref, resolveComponent, shallowRef, unref } from 'vue'
import { camelize, escapeHtml } from '@vue/shared'
import type { ComponentSlots } from 'vue-component-type-helpers'
import type { RouteLocation, RouteLocationGeneric, RouteLocationRaw, RouteLocationResolved, RouteParamsGeneric, RouteRecordNormalized, Router, RouterLink, RouterLinkProps, useLink } from 'vue-router'
import { hasProtocol, joinURL, parseQuery, withTrailingSlash, withoutTrailingSlash } from 'ufo'
import { prefetchRouteComponents } from '../composables/preload'
import { onNuxtReady } from '../composables/ready'
import { encodeRoutePath, navigateTo, resolveRouteObject, useRouter } from '../composables/router'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { isAbsoluteHref, isRootedPath, sanitizeAnchorHref } from '../utils'
import { canPrefetch, prefetchGroup } from '../internal/prefetch-util'
import { documentURL } from '../internal/location'
import type { NuxtApp } from '../nuxt'
import { renderDiagnostics } from '../diagnostics/render'
import { navigationDiagnostics } from '../diagnostics/navigation'

import { componentIslands, nuxtLinkDefaults } from '#build/nuxt.config.mjs'

import { hashMode } from '#build/router.options.mjs'
import { isPlainAbsolutePath, mayMatchCurrentRoute } from './route-match'
import { PageRouteSymbol } from './injections'
import type { NuxtLinkOptions } from '../types'

const firstNonUndefined = <T> (...args: (T | undefined)[]) => args.find(arg => arg !== undefined)

const NuxtLinkDevKeySymbol: InjectionKey<boolean> = Symbol('nuxt-link-dev-key')

export type { NuxtLinkOptions } from '../types'

/**
 * `<NuxtLink>` is a drop-in replacement for both Vue Router's `<RouterLink>` component and HTML's `<a>` tag.
 * @see https://nuxt.com/docs/5.x/api/components/nuxt-link
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
}

type RouterLinkSlot = NonNullable<ComponentSlots<typeof RouterLink>['default']>
type RouterLinkSlotProps = Parameters<RouterLinkSlot>[0]

type NuxtLinkSlotProps<CustomProp extends boolean = false> = CustomProp extends true
  ? Omit<RouterLinkSlotProps, 'href' | 'route'> & {
    href: RouterLinkSlotProps['href'] | null
    route: RouterLinkSlotProps['route'] | undefined
    prefetch: (nuxtApp?: NuxtApp) => Promise<void>
    prefetched: boolean
    shouldPrefetch: (mode: 'visibility' | 'interaction') => boolean
    rel: string | null
    target: '_blank' | '_parent' | '_self' | '_top' | (string & {}) | null
    isExternal: boolean
  }
  : RouterLinkSlotProps

type NuxtLinkComponentProps<CustomProp extends boolean = false> =
  NuxtLinkProps<CustomProp> & PublicProps & Omit<AnchorHTMLAttributes, keyof NuxtLinkProps<CustomProp>>

type NuxtLinkComponentInstance<CustomProp extends boolean = false> = InstanceType<DefineSetupFnComponent<
  NuxtLinkComponentProps<CustomProp>,
  [],
  SlotsType<{
    default?: (props: NuxtLinkSlotProps<CustomProp>) => VNode[]
  }>
>>

// the non-generic signatures are required for `ComponentProps`/`ComponentSlots` and Vue Language
// Tools to resolve the component: inference against a solely generic construct signature yields `{}`
export type NuxtLinkComponent = {
  new (
    props: NuxtLinkComponentProps<true> & { custom: true }
  ): NuxtLinkComponentInstance<true>
  new (
    props: NuxtLinkComponentProps<false>
  ): NuxtLinkComponentInstance<false>
  new<CustomProp extends boolean = false>(
    props: NuxtLinkComponentProps<CustomProp>
  ): NuxtLinkComponentInstance<CustomProp>
}

/* @__NO_SIDE_EFFECTS__ */
export function defineNuxtLink (options: NuxtLinkOptions): NuxtLinkComponent & Record<string, any> {
  const componentName = options.componentName || 'NuxtLink'

  function checkPropConflicts (props: NuxtLinkProps, main: keyof NuxtLinkProps, sub: keyof NuxtLinkProps): void {
    if (import.meta.dev && props[main] !== undefined && props[sub] !== undefined) {
      renderDiagnostics.NUXT_E4010({ componentName, main, sub })
    }
  }

  function isHashLinkWithoutHashMode (link: unknown): link is string {
    return !hashMode && typeof link === 'string' && link.startsWith('#')
  }

  function resolveTrailingSlashBehavior (to: string, resolve: Router['resolve'], trailingSlash?: NuxtLinkOptions['trailingSlash']): string
  function resolveTrailingSlashBehavior (to: RouteLocationRaw, resolve: Router['resolve'], trailingSlash?: NuxtLinkOptions['trailingSlash']): Exclude<RouteLocationRaw, string>
  function resolveTrailingSlashBehavior (to: RouteLocationRaw | undefined, resolve: Router['resolve'], trailingSlash?: NuxtLinkOptions['trailingSlash']): RouteLocationRaw | RouteLocation | undefined {
    const effectiveTrailingSlash = trailingSlash ?? options.trailingSlash
    if (!to || (effectiveTrailingSlash !== 'append' && effectiveTrailingSlash !== 'remove')) {
      return to
    }

    if (typeof to === 'string') {
      return applyTrailingSlashBehavior(to, effectiveTrailingSlash)
    }

    const path = 'path' in to && to.path !== undefined ? to.path : resolve(to).path

    const resolvedPath = {
      ...to,
      name: undefined, // named routes would otherwise always override trailing slash behavior
      path: applyTrailingSlashBehavior(path, effectiveTrailingSlash),
    }

    return resolvedPath
  }

  /**
   * The link state `<NuxtLink>` renders with. Kept separate from `useNuxtLink` so the component
   * does not resolve the `<RouterLink>` link state backing `route`/`isActive`/`isExactActive`,
   * which it never reads.
   */
  function useLinkTarget (props: { [K in keyof NuxtLinkProps]: MaybeRef<NuxtLinkProps[K]> }, attrs?: Record<string, unknown>) {
    const router = useRouter()
    const config = useRuntimeConfig()
    // the history base accounts for the app base and for hash mode
    const rootedHref = router.options?.history?.createHref ?? ((path: string) => joinURL(config.app.baseURL, path))

    const hasTarget = computed(() => !!unref(props.target) && unref(props.target) !== '_self')

    // Lazily check whether to.value has a protocol
    const isAbsoluteUrl = computed(() => {
      const path = unref(props.to) || unref(props.href) || ''
      return typeof path === 'string' && isAbsoluteHref(path)
    })

    // Kept out of `isExternal` so an internal `to` still resolves against the app base
    const download = computed(() => attrs?.download !== undefined)

    // Resolving link type
    const isExternal = computed<boolean>(() => {
      // External prop is explicitly set
      if (unref(props.external)) {
        return true
      }

      const path = unref(props.to) || unref(props.href) || ''

      // When `to` is a route object then it's an internal link
      if (typeof path === 'object') {
        return false
      }

      return path === '' || isAbsoluteUrl.value
    })

    // Resolving `to` value from `to` and `href` props
    const to: ComputedRef<RouteLocationRaw> = computed(() => {
      checkPropConflicts(props as NuxtLinkProps, 'to', 'href')
      const path = unref(props.to) || unref(props.href) || '' // Defaults to empty string (won't render any `href` attribute)
      if (isExternal.value) { return path }
      return resolveTrailingSlashBehavior(path, router.resolve, unref(props.trailingSlash))
    })

    // Resolves `to` value if it's a route location object
    const href = computed(() => {
      const effectiveTrailingSlash = unref(props.trailingSlash) ?? options.trailingSlash
      if (!to.value || isAbsoluteUrl.value || isHashLinkWithoutHashMode(to.value)) {
        const raw = to.value as string
        return typeof raw === 'string' ? sanitizeAnchorHref(raw) : raw
      }

      if (isExternal.value) {
        const path = typeof to.value === 'object' && 'path' in to.value ? resolveRouteObject(to.value) : to.value
        // separately resolve route objects with a 'name' property and without 'path'
        const href = typeof path === 'object' ? router.resolve(path).href : path
        const safe = typeof href === 'string' ? sanitizeAnchorHref(href) : href
        return safe === null ? null : applyTrailingSlashBehavior(safe, effectiveTrailingSlash)
      }

      if (typeof to.value === 'object') {
        return router.resolve(to.value)?.href ?? null
      }

      // A rooted download URL must not carry the router's hash prefix
      if (download.value && isRootedPath(to.value)) {
        return joinURL(config.app.baseURL, to.value)
      }

      // only a relative path needs resolving against the current route
      const href = isRootedPath(to.value) ? rootedHref(to.value) : router.resolve(to.value).href
      return applyTrailingSlashBehavior(href, effectiveTrailingSlash)
    })

    return {
      to,
      hasTarget,
      isAbsoluteUrl,
      isExternal,
      download,
      //
      href,
      async navigate (_e?: MouseEvent) {
        if (href.value === null) {
          if (import.meta.dev) {
            navigationDiagnostics.NUXT_E2011({ componentName })
          }
          return
        }
        await navigateTo(href.value, { replace: unref(props.replace), external: isExternal.value || hasTarget.value })
      },
    }
  }

  function useNuxtLink (props: { [K in keyof NuxtLinkProps]: MaybeRef<NuxtLinkProps[K]> }) {
    const router = useRouter()
    const target = useLinkTarget(props)

    const builtinRouterLink = resolveComponent('RouterLink') as string | typeof RouterLink
    const useBuiltinLink = builtinRouterLink && typeof builtinRouterLink !== 'string' ? builtinRouterLink.useLink : undefined
    const link = target.isExternal.value ? undefined : useBuiltinLink?.({ ...props, to: target.to, viewTransition: unref(props.viewTransition) })

    return {
      ...target,
      isActive: link?.isActive ?? computed(() => target.to.value === router.currentRoute.value.path),
      isExactActive: link?.isExactActive ?? computed(() => target.to.value === router.currentRoute.value.path),
      route: link?.route ?? computed(() => router.resolve(target.to.value)),
    } satisfies Omit<ReturnType<typeof useLink>, 'href'> & {
      to: ComputedRef<RouteLocationRaw>
      href: ComputedRef<string | null>
      hasTarget: ComputedRef<boolean | null | undefined>
      isAbsoluteUrl: ComputedRef<boolean>
      isExternal: ComputedRef<boolean>
    }
  }

  function checkNuxtLinkNesting () {
    if (inject(NuxtLinkDevKeySymbol, false)) {
      renderDiagnostics.NUXT_E4009()
    } else {
      provide(NuxtLinkDevKeySymbol, true)
    }
  }

  /**
   * Resolve the link state `<RouterLink>` exposes for an internal location.
   */
  function resolveStaticLink (props: NuxtLinkProps, router: Router, rawTo: RouteLocationRaw, currentRoute: RouteLocationGeneric = router.currentRoute.value) {
    if (import.meta.dev) {
      checkPropConflicts(props, 'to', 'href')
      checkPropConflicts(props, 'noRel', 'rel')
    }

    let route: RouteLocationResolved | undefined
    let href: string
    let isActive = false
    let isExactActive = false
    // the router used without pages has no `history`
    if (typeof rawTo === 'string' && router.options.history && isPlainAbsolutePath(rawTo) && !hashMode && !props.trailingSlash && !options.trailingSlash && !mayMatchCurrentRoute(currentRoute, rawTo)) {
      href = router.options.history.base + rawTo
    } else {
      route = router.resolve(resolveTrailingSlashBehavior(rawTo, router.resolve, props.trailingSlash))
      href = route.href
      const index = activeRecordIndex(route, currentRoute)
      isActive = index > -1 && includesParams(currentRoute.params, route.params)
      isExactActive = index > -1 && index === currentRoute.matched.length - 1 && isSameRouteLocationParams(currentRoute.params, route.params)
    }
    return new StaticLink(router, rawTo, route, href, isActive, isExactActive, props.replace)
  }

  /**
   * Render an internal link as a plain anchor, matching the markup `<RouterLink>` produces
   * for the same location.
   */
  function renderStaticInternalLink (props: NuxtLinkProps, slots: { default?: (props?: any) => VNode[] }, router: Router, rawTo: RouteLocationRaw) {
    const link = resolveStaticLink(props, router, rawTo)
    return h('a', staticInternalLinkAttrs(props, router, link), slots.default?.(link))
  }

  function staticInternalLinkClasses (props: NuxtLinkProps, router: Router): [active: string, exactActive: string] {
    return [
      getLinkClass(props.activeClass || options.activeClass, router.options.linkActiveClass, 'router-link-active'),
      getLinkClass(props.exactActiveClass || options.exactActiveClass, router.options.linkExactActiveClass, 'router-link-exact-active'),
    ]
  }

  function staticInternalLinkDataInternal (props: NuxtLinkProps): string | undefined {
    let dataInternal: string | undefined
    if (componentIslands && useNuxtApp().ssrContext?.islandContext) {
      const flags: string[] = []
      if (props.replace) { flags.push('replace') }
      const prefetchOnVisibility = typeof props.prefetchOn === 'string' ? props.prefetchOn === 'visibility' : (props.prefetchOn?.visibility ?? options.prefetchOn?.visibility)
      if (prefetchOnVisibility && (props.prefetch ?? options.prefetch) !== false && props.noPrefetch !== true) { flags.push('prefetch') }
      dataInternal = flags.join(' ')
    }
    return dataInternal
  }

  function staticInternalLinkAttrs (props: NuxtLinkProps, router: Router, link: ReturnType<typeof resolveStaticLink>): Record<string, unknown> {
    const linkClass = staticInternalLinkClass(props, router, link)
    return {
      'aria-current': link.isExactActive ? (props.ariaCurrentValue ?? 'page') : null,
      'href': link.href,
      ...linkClass && { class: linkClass },
      'rel': props.rel || undefined,
      'data-internal': staticInternalLinkDataInternal(props),
    }
  }

  function staticInternalLinkClass (props: NuxtLinkProps, router: Router, link: ReturnType<typeof resolveStaticLink>): string {
    if (!link.isActive && !link.isExactActive) { return '' }
    const [activeClass, exactActiveClass] = staticInternalLinkClasses(props, router)
    return link.isExactActive
      ? (activeClass === exactActiveClass ? activeClass : `${activeClass} ${exactActiveClass}`)
      : (activeClass !== exactActiveClass ? activeClass : '')
  }

  function staticInternalLinkOpenTag (props: NuxtLinkProps, router: Router, link: ReturnType<typeof resolveStaticLink>): string {
    const dataInternal = staticInternalLinkDataInternal(props)
    let tag = '<a'
    if (link.isExactActive) { tag += ` aria-current="${escapeHtml(props.ariaCurrentValue ?? 'page')}"` }
    tag += ` href="${escapeHtml(link.href)}"`
    const linkClass = staticInternalLinkClass(props, router, link)
    if (linkClass) { tag += ` class="${escapeHtml(linkClass)}"` }
    if (props.rel) { tag += ` rel="${escapeHtml(props.rel)}"` }
    if (dataInternal !== undefined) { tag += ` data-internal="${escapeHtml(dataInternal)}"` }
    return tag
  }

  function isStaticInternalLink (props: NuxtLinkProps, rawTo: RouteLocationRaw, download = false): boolean {
    const isExternalLink = props.external || download || (typeof rawTo === 'string' && (rawTo === '' || isAbsoluteHref(rawTo)))
    return !isExternalLink && !isHashLinkWithoutHashMode(rawTo) && (!props.target || props.target === '_self')
  }

  /** Resolves the anchor of a template `<NuxtLink>` that can be rendered without a component instance. */
  function resolveSsrLink (rawProps: Record<string, unknown>, parent: ComponentInternalInstance): NuxtLinkSsrState | undefined {
    const props = directRenderProps(rawProps)
    const rawTo = props?.to
    if (!props || !rawTo || !isStaticInternalLink(props, rawTo, props.attrs?.download !== undefined)) { return }
    const router = ((parent.appContext.app as { $nuxt?: NuxtApp }).$nuxt?.$router ?? useRouter()) as Router
    const link = resolveStaticLink(props, router, rawTo)
    return {
      link,
      openTag: props.class || props.style || props.attrs ? undefined : staticInternalLinkOpenTag(props, router, link),
      attrs: () => {
        const attrs = staticInternalLinkAttrs(props, router, link)
        if (props.attrs) { Object.assign(attrs, props.attrs) }
        if (props.class) { attrs.class = [attrs.class, props.class] }
        if (props.style) { attrs.style = props.style }
        return attrs
      },
    }
  }

  /**
   * Render the slot of an internal `custom` link with the props `<RouterLink custom>` passes to it.
   */
  function renderStaticCustomLink (props: NuxtLinkProps, slots: { default?: (props: NuxtLinkSlotProps<true>) => VNode[] }, router: Router, rawTo: RouteLocationRaw) {
    const link = resolveStaticLink(props, router, rawTo)
    const vnodes = slots.default?.({
      ...link,
      route: link.route,
      rel: firstNonUndefined<string | null>(props.noRel ? '' : props.rel, options.externalRelAttribute, '') || null,
      target: props.target || null,
      isExternal: false,
      prefetch: async () => {},
      prefetched: false,
      shouldPrefetch: () => false,
    })
    return vnodes?.length === 1 ? vnodes[0] : vnodes
  }

  const component = defineComponent({
    name: componentName,
    props: {
      // Routing
      to: {
        type: [String, Object] as PropType<RouteLocationRaw>,
        required: false,
      },
      href: {
        type: [String, Object] as PropType<RouteLocationRaw>,
        required: false,
      },

      // Attributes
      target: {
        type: String as PropType<NuxtLinkProps['target']>,
        required: false,
      },
      rel: {
        type: String as PropType<NuxtLinkProps['rel']>,
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
        required: false,
      },
      exactActiveClass: {
        type: String as PropType<NuxtLinkProps['exactActiveClass']>,
        required: false,
      },
      prefetchedClass: {
        type: String as PropType<NuxtLinkProps['prefetchedClass']>,
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
        required: false,
      },
    },
    useLink: useNuxtLink,
    setup (props, { slots, attrs }) {
      const router = useRouter()

      // On the server an internal link resolves to static markup, so it is rendered directly:
      // no `<RouterLink>` instance, no reactive link state and none of the client-only
      // prefetching setup below.
      if (import.meta.server) {
        const rawTo = props.to || props.href || ''
        if (isStaticInternalLink(props, rawTo, attrs.download !== undefined)) {
          if (props.custom) {
            return () => renderStaticCustomLink(props, slots, router, rawTo)
          }
          if (import.meta.dev) {
            checkNuxtLinkNesting()
          }
          return () => renderStaticInternalLink(props, slots, router, rawTo)
        }
      }

      const routerLinkComponent = resolveComponent('RouterLink')

      const { to, href, navigate, isExternal, hasTarget, isAbsoluteUrl, download } = useLinkTarget(props, attrs)

      // Prefetching
      const prefetched = shallowRef(false)
      const el = import.meta.server ? undefined : ref<HTMLElement | null>(null)
      const elRef = import.meta.server ? undefined : (ref: any) => { el!.value = props.custom ? ref?.$el?.nextElementSibling : ref?.$el }

      function prefetchOn (mode: 'visibility' | 'interaction'): boolean | undefined {
        return typeof props.prefetchOn === 'string' ? props.prefetchOn === mode : (props.prefetchOn?.[mode] ?? options.prefetchOn?.[mode])
      }

      function prefetchAllowed (): boolean {
        return Boolean((props.prefetch ?? options.prefetch) !== false && props.noPrefetch !== true && props.target !== '_blank' && canPrefetch())
      }

      function shouldPrefetch (mode: 'visibility' | 'interaction'): boolean {
        if (import.meta.server) { return false }
        return Boolean(!prefetched.value && prefetchOn(mode) && prefetchAllowed())
      }

      function resolvedPath (): string {
        const path = typeof to.value === 'string'
          ? to.value
          : isExternal.value ? resolveRouteObject(to.value) : router.resolve(to.value).fullPath
        return isExternal.value ? new URL(path, documentURL()).href : path
      }

      function escalate () {
        if (!prefetched.value) {
          if (prefetchOn('interaction')) { prefetch() }
          return
        }
        if (!isExternal.value) {
          useNuxtApp()._prefetch?.promote(prefetchGroup(resolvedPath()))
        }
      }

      async function prefetch (nuxtApp = useNuxtApp()) {
        if (import.meta.server) { return }

        if (download.value || prefetched.value) { return }

        if (href.value === null) { return }

        prefetched.value = true

        const normalizedPath = resolvedPath()
        await Promise.all([
          nuxtApp.hooks.callHook('link:prefetch', normalizedPath)?.catch(() => {}),
          !import.meta.dev && !isExternal.value && !hasTarget.value && prefetchRouteComponents(to.value as string, router),
        ])
      }

      if (import.meta.client && !props.custom) {
        checkPropConflicts(props, 'noPrefetch', 'prefetch')
        if (shouldPrefetch('visibility')) {
          const nuxtApp = useNuxtApp()
          let unobserve: (() => void) | null = null
          onMounted(() => {
            if (el?.value?.tagName) {
              unobserve = useObserver()!.observe(el.value, async () => {
                unobserve?.()
                unobserve = null
                await prefetch(nuxtApp)
              }, true)
            }
          })
          onBeforeUnmount(() => {
            unobserve?.()
            unobserve = null
          })
        }
      }

      if (import.meta.dev && import.meta.server && !props.custom) {
        checkNuxtLinkNesting()
      }

      return () => {
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

        const getCustomSlotProps = (routerLinkSlotProps?: RouterLinkSlotProps): NuxtLinkSlotProps<true> => ({
          navigate,
          get route () {
            if (!href.value) { return undefined }

            const url = new URL(href.value, import.meta.client ? documentURL() : 'http://localhost')
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
            } as unknown as RouteLocation & { href: string }
          },
          rel,
          target,
          isExternal: isExternal.value || hasTarget.value,
          isActive: false,
          isExactActive: false,
          ...routerLinkSlotProps,
          href: typeof routerLinkSlotProps?.href === 'string' ? sanitizeAnchorHref(routerLinkSlotProps.href) : href.value,
          prefetch,
          prefetched: prefetched.value,
          shouldPrefetch,
        })

        if (!isExternal.value && !download.value && !hasTarget.value && !isHashLinkWithoutHashMode(to.value)) {
          const routerLinkProps: RouterLinkProps & PublicProps & AnchorHTMLAttributes & { 'data-internal'?: string } = {
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
            if (import.meta.client) {
              // before prefetching, only interaction mode has anything to escalate
              if ((prefetchOn('interaction') || prefetched.value) && prefetchAllowed()) {
                routerLinkProps.onPointerenter = escalate
                routerLinkProps.onFocus = escalate
                routerLinkProps.onPointerdown = escalate
              }
              if (prefetched.value) {
                routerLinkProps.class = props.prefetchedClass || options.prefetchedClass
              }
            }
            routerLinkProps.rel = props.rel || undefined

            if (import.meta.server && componentIslands && useNuxtApp().ssrContext?.islandContext) {
              // marks internal links within island HTML for client-side navigation
              const flags: string[] = []
              if (props.replace) { flags.push('replace') }
              const prefetchOnVisibility = typeof props.prefetchOn === 'string' ? props.prefetchOn === 'visibility' : (props.prefetchOn?.visibility ?? options.prefetchOn?.visibility)
              if (prefetchOnVisibility && (props.prefetch ?? options.prefetch) !== false && props.noPrefetch !== true) { flags.push('prefetch') }
              routerLinkProps['data-internal'] = flags.join(' ')
            }
          }

          // Internal link
          return h(
            routerLinkComponent,
            routerLinkProps,
            props.custom && slots.default
              ? { default: (slotProps: RouterLinkSlotProps) => slots.default!(getCustomSlotProps(slotProps)) }
              : slots.default,
          )
        }

        // https://router.vuejs.org/api/interfaces/routerlinkprops#custom-
        if (props.custom) {
          if (!slots.default) {
            return null
          }

          return slots.default(getCustomSlotProps())
        }

        return h('a', {
          ref: el,
          href: href.value || null, // converts `""` to `null` to prevent the attribute from being added as empty (`href=""`)
          rel,
          target,
          onClick: async (event) => {
            if (isExternal.value || hasTarget.value || download.value) {
              return
            }

            event.preventDefault()

            try {
              const encodedHref = encodeRoutePath(href.value ?? '')
              return await (props.replace ? router.replace(encodedHref) : router.push(encodedHref))
            } finally {
              // Focus the target element for hash links to restore accessibility behavior
              // that was prevented by event.preventDefault()
              if (import.meta.client && isHashLinkWithoutHashMode(to.value)) {
                const rawHash = (to.value as string).slice(1)
                let hash = rawHash
                try {
                  hash = decodeURIComponent(rawHash)
                } catch {
                  // ignore errors
                }
                const el = document.getElementById(hash)
                el?.focus()
              }
            }
          },
        }, slots.default?.())
      }
    },
  }) as unknown as NuxtLinkComponent & Record<string, any>

  if (import.meta.server && !import.meta.dev) {
    component.__ssrLink = resolveSsrLink
  }

  if (import.meta.client && !import.meta.dev) {
    component.__inlineLink = createInlineLinkVNode
  }

  return component

  /** Creates the anchor of a template `<NuxtLink>` rendered without a component instance. */
  function createInlineLinkVNode (rawProps: Record<string, unknown> | null, slots: Slots | null, block: boolean): VNode | undefined {
    const props = rawProps && !hashMode && !options.prefetchedClass ? directRenderProps(rawProps) : undefined
    const rawTo = props?.to
    const slot = slots?.default as (Slot & { _c?: boolean, _d?: boolean }) | undefined
    if (!props || !rawTo || (typeof rawTo === 'object' ? ('state' in rawTo || 'force' in rawTo || 'replace' in rawTo) : typeof rawTo !== 'string') || props.prefetchedClass || (slot && !slot._c) || !isStaticInternalLink(props, rawTo, props.attrs?.download !== undefined)) { return }
    const prefetchOn = (mode: 'visibility' | 'interaction') => typeof props.prefetchOn === 'string' ? props.prefetchOn === mode : (props.prefetchOn?.[mode] ?? options.prefetchOn?.[mode])
    if (prefetchOn('interaction')) { return }
    const nuxtApp = useNuxtApp() as NuxtApp & { _inlineLinks?: InlineLinks | false }
    const inline = nuxtApp._inlineLinks ??= createInlineLinks(nuxtApp)
    if (!inline) { return }

    const router = inline.router
    const to = resolveTrailingSlashBehavior(rawTo, router.resolve, props.trailingSlash)
    const link = resolveStaticLink(props, router, rawTo, inject(PageRouteSymbol, nuxtApp._route))
    link.navigate = (e?: MouseEvent) => {
      if (e && !guardEvent(e, e.currentTarget as Element)) { return Promise.resolve() }
      e?.preventDefault()
      return router.push(to).then(() => {}, () => {})
    }
    const [activeClass, exactActiveClass] = staticInternalLinkClasses(props, router)
    // absent attributes are omitted rather than nullish, which mounting would remove from the fresh element
    const anchorProps: Record<string, unknown> = { key: (props as { key?: unknown }).key }
    if (link.isExactActive) { anchorProps['aria-current'] = props.ariaCurrentValue ?? 'page' }
    if (link.href !== null) { anchorProps.href = link.href }
    const className = link.isActive ? normalizeClass([{ [activeClass]: true, [exactActiveClass]: link.isExactActive }, props.class]) : props.class && normalizeClass(props.class)
    if (className) { anchorProps.class = className }
    if (props.style) { anchorProps.style = normalizeStyle(props.style) }
    if (props.rel) { anchorProps.rel = props.rel }
    if (props.attrs) { Object.assign(anchorProps, props.attrs) }
    const onClick = typeof rawTo === 'object' ? link.navigate : inline.onClick
    anchorProps.onClick = props.attrs?.onClick ? [onClick].concat(props.attrs.onClick as () => void) : onClick
    if (prefetchOn('visibility') && options.prefetch !== false) {
      anchorProps.onVnodeMounted = inline.observe
      anchorProps.onVnodeBeforeUnmount = inline.unobserve
    }

    if (!block) { openBlock() }
    // tracks the dynamic vnodes of the slot content in the anchor block
    if (slot) { slot._d = false }
    const children = slot?.(link)
    if (slot) { slot._d = true }
    // dynamic slots can change shape between renders, so their content is diffed in full
    return createElementBlock('a', anchorProps, children, (slots as { _?: number } | null)?._ === 2 ? -2 /* PatchFlags.BAIL */ : 16 /* PatchFlags.FULL_PROPS */)
  }
}

interface InlineLinks {
  router: Router
  onClick: (e: MouseEvent) => void
  observe: (vnode: VNode) => void
  unobserve: (vnode: VNode) => void
}

function createInlineLinks (nuxtApp: NuxtApp): InlineLinks | false {
  const routerLink = nuxtApp.vueApp.component('RouterLink')
  if (!routerLink || !('useLink' in routerLink)) { return false }
  const router = nuxtApp.$router as unknown as Router
  const base = router.options.history.base
  const pathOf = (el: Element) => {
    const href = el.getAttribute('href') || ''
    return (href.startsWith(base) ? href.slice(base.length) : href) || '/'
  }

  let observer: ReturnType<typeof useObserver>
  const unobservers = new WeakMap<Element, () => void>()
  const prefetched = new WeakSet<Element>()
  let listening = false

  function escalate (e: Event) {
    const el = (e.target as Element | null)?.closest?.('a')
    if (el && prefetched.has(el)) {
      nuxtApp._prefetch?.promote(prefetchGroup(pathOf(el)))
    }
  }

  async function prefetch (el: Element) {
    if (!canPrefetch()) { return }
    prefetched.add(el)
    if (!listening) {
      listening = true
      for (const type of ['pointerover', 'focusin', 'pointerdown']) {
        document.addEventListener(type, escalate, { capture: true, passive: true })
      }
    }
    const path = pathOf(el)
    await Promise.all([
      nuxtApp.hooks.callHook('link:prefetch', path)?.catch(() => {}),
      prefetchRouteComponents(path, router),
    ])
  }

  function unobserve (vnode: VNode) {
    const el = vnode.el as Element
    unobservers.get(el)?.()
    unobservers.delete(el)
  }

  return {
    router,
    onClick (e) {
      const anchor = e.currentTarget as Element
      if (guardEvent(e, anchor)) {
        e.preventDefault()
        router.push(pathOf(anchor)).catch(() => {})
      }
    },
    observe (vnode) {
      const el = vnode.el as Element
      observer ||= nuxtApp.runWithContext(() => useObserver()) as ReturnType<typeof useObserver>
      unobservers.set(el, observer!.observe(el, () => {
        unobserve(vnode)
        return prefetch(el)
      }, true))
    },
    unobserve,
  }
}

const NuxtLink: NuxtLinkComponent & Record<string, any> = defineNuxtLink(nuxtLinkDefaults)
export default NuxtLink

type InlineLinkComponent = Component & { __inlineLink?: (props: Record<string, unknown> | null, slots: Slots | null, block: boolean) => VNode | undefined }

/**
 * Creates the vnode of a template `<NuxtLink>`, as a plain anchor without a component instance
 * when the link resolves to a static internal anchor.
 * @internal
 */
export function createNuxtLinkVNode (comp: InlineLinkComponent, props?: Record<string, unknown> | null, slots?: Slots | null, patchFlag?: number, dynamicProps?: string[] | null): VNode {
  return comp.__inlineLink?.(props ?? null, slots ?? null, false) ?? createVNode(comp, props, slots, patchFlag, dynamicProps)
}

/**
 * Block variant of {@link createNuxtLinkVNode}.
 * @internal
 */
export function createNuxtLinkBlock (comp: InlineLinkComponent, props?: Record<string, unknown> | null, slots?: Slots | null, patchFlag?: number, dynamicProps?: string[]): VNode {
  return comp.__inlineLink?.(props ?? null, slots ?? null, true) ?? createBlock(comp, props, slots, patchFlag, dynamicProps)
}

// -- NuxtLink utils --

/*
 * Active-link resolution, kept in step with the semantics `<RouterLink>` applies so a
 * server-rendered anchor hydrates against an identical client-rendered one. Route records are
 * compared through their alias origin, and a link is active when the current location matches
 * its deepest record and carries at least its params.
 */
function isSameRouteRecord (a: RouteRecordNormalized, b: RouteRecordNormalized): boolean {
  return (a.aliasOf || a) === (b.aliasOf || b)
}

function getOriginalPath (record: RouteRecordNormalized | undefined): string {
  return record ? (record.aliasOf ? record.aliasOf.path : record.path) : ''
}

function isEquivalentArray (a: readonly unknown[], b: unknown): boolean {
  return Array.isArray(b) ? a.length === b.length && a.every((value, i) => value === b[i]) : a.length === 1 && a[0] === b
}

function isSameParamValue (a: unknown, b: unknown): boolean {
  return Array.isArray(a)
    ? isEquivalentArray(a, b)
    : Array.isArray(b) ? isEquivalentArray(b, a) : (a && a.valueOf()) === (b && b.valueOf())
}

function isSameRouteLocationParams (a: RouteParamsGeneric, b: RouteParamsGeneric): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) { return false }
  for (const key in a) {
    if (!isSameParamValue(a[key], b[key])) { return false }
  }
  return true
}

/** The link state `<RouterLink>` exposes for an internal location, resolving `route` when it is read. */
class StaticLink {
  href: string | null
  isActive: boolean
  isExactActive: boolean
  navigate: (e?: MouseEvent) => Promise<void>
  #router: Router
  #to: RouteLocationRaw
  #route: RouteLocationResolved | undefined

  constructor (router: Router, to: RouteLocationRaw, route: RouteLocationResolved | undefined, href: string, isActive: boolean, isExactActive: boolean, replace: boolean | undefined) {
    this.href = sanitizeAnchorHref(href)
    this.isActive = isActive
    this.isExactActive = isExactActive
    this.navigate = async () => { await navigateTo(href, { replace }) }
    this.#router = router
    this.#to = to
    this.#route = route
  }

  get route (): RouteLocationResolved {
    return this.#route ??= this.#router.resolve(this.#to)
  }
}

/** @internal */
export interface NuxtLinkSsrState {
  link: object
  /** The opening tag without its closing `>`, when no fallthrough `class` or `style` needs merging. */
  openTag?: string
  attrs: () => Record<string, unknown>
}

type DirectRenderProps = NuxtLinkProps & { to: RouteLocationRaw, class?: unknown, style?: unknown, attrs?: Record<string, unknown> }

// Boolean props are excluded: without prop normalisation a bare attribute arrives as `''`.
const DIRECT_RENDER_PROPS = new Set(['key', 'to', 'class', 'style', 'rel', 'activeClass', 'exactActiveClass', 'ariaCurrentValue', 'prefetchOn', 'prefetchedClass'])

// Props and attributes that need the component: everything else falls through to the anchor.
const COMPONENT_RENDER_KEYS = new Set(['href', 'target', 'noRel', 'prefetch', 'noPrefetch', 'replace', 'external', 'custom', 'trailingSlash', 'viewTransition', 'ref', 'ref_for', 'ref_key', 'innerHTML', 'textContent'])

function directRenderProps (raw: Record<string, unknown>): DirectRenderProps | undefined {
  let props = raw
  let attrs: Record<string, unknown> | undefined
  for (const key in raw) {
    const name = key.includes('-') ? camelize(key) : key
    if (!DIRECT_RENDER_PROPS.has(name)) {
      if (COMPONENT_RENDER_KEYS.has(name) || key.startsWith('onVnode')) { return }
      (attrs ??= {})[key] = raw[key]
    } else if (name !== key) {
      if (props === raw) { props = { ...raw } }
      props[name] = raw[key]
    }
  }
  if (attrs) {
    if (props === raw) { props = { ...raw } }
    props.attrs = attrs
  }
  return props as unknown as DirectRenderProps
}

function includesParams (outer: RouteParamsGeneric, inner: RouteParamsGeneric): boolean {
  for (const key in inner) {
    const innerValue = inner[key]
    const outerValue = outer[key]
    if (typeof innerValue === 'string') {
      if (innerValue !== outerValue) { return false }
    } else if (!Array.isArray(outerValue) || outerValue.length !== innerValue!.length || innerValue!.some((value, i) => value.valueOf() !== outerValue[i]!.valueOf())) {
      return false
    }
  }
  return true
}

function activeRecordIndex (route: RouteLocationGeneric, currentRoute: RouteLocationGeneric): number {
  const { matched } = route
  const { length } = matched
  const routeMatched = matched[length - 1]
  const currentMatched = currentRoute.matched
  if (!routeMatched || !currentMatched.length) { return -1 }
  const index = currentMatched.findIndex(isSameRouteRecord.bind(null, routeMatched))
  if (index > -1) { return index }
  const parentRecordPath = getOriginalPath(matched[length - 2])
  return length > 1 && getOriginalPath(routeMatched) === parentRecordPath && currentMatched[currentMatched.length - 1]!.path !== parentRecordPath
    ? currentMatched.findIndex(isSameRouteRecord.bind(null, matched[length - 2]!))
    : index
}

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

/** Resolve an active-link class, falling back from the per-link value to the router-wide one. */
function getLinkClass (propClass: string | undefined, globalClass: string | undefined, defaultClass: string): string {
  return propClass ?? globalClass ?? defaultClass
}

function applyTrailingSlashBehavior (to: string, trailingSlash: NuxtLinkOptions['trailingSlash']): string {
  // When `trailingSlash` is unset (or not a valid value) the URL is returned untouched
  if (trailingSlash !== 'append' && trailingSlash !== 'remove') {
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
