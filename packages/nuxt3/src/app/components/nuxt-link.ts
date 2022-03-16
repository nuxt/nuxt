import { defineComponent, h, resolveComponent, PropType, computed, DefineComponent } from 'vue'
import { RouteLocationRaw, Router } from 'vue-router'
import { hasProtocol } from 'ufo'

import { useRouter } from '#app'

const firstNonUndefined = <T>(...args: T[]): T => args.find(arg => arg !== undefined)

const DEFAULT_EXTERNAL_REL_ATTRIBUTE = 'noopener noreferrer'

export type NuxtLinkOptions = {
  componentName?: string;
  externalRelAttribute?: string | null;
  activeClass?: string;
  exactActiveClass?: string;
}

export type NuxtLinkProps = {
  // Routing
  to?: string | RouteLocationRaw;
  href?: string | RouteLocationRaw;
  external?: boolean;

  // Attributes
  target?: string;
  rel?: string;
  noRel?: boolean;

  // Styling
  activeClass?: string;
  exactActiveClass?: string;

  // Vue Router's `<RouterLink>` additional props
  replace?: boolean;
  ariaCurrentValue?: string;
};

export function defineNuxtLink (options: NuxtLinkOptions) {
  const componentName = options.componentName || 'NuxtLink'

  const checkPropConflicts = (props: NuxtLinkProps, main: string, sub: string): void => {
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
      const router = useRouter() as Router | undefined

      // Resolving `to` value from `to` and `href` props
      const to = computed<string | RouteLocationRaw>(() => {
        checkPropConflicts(props, 'to', 'href')

        return props.to || props.href || '' // Defaults to empty string (won't render any `href` attribute)
      })

      // Resolving link type
      const isExternal = computed<boolean>(() => {
        // External prop is explictly set
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

        // Directly check if `to` is an external URL by checking protocol
        return hasProtocol(to.value, true)
      })

      return () => {
        if (!isExternal.value) {
          // Internal link
          return h(
            resolveComponent('RouterLink'),
            {
              to: to.value,
              activeClass: props.activeClass || options.activeClass,
              exactActiveClass: props.exactActiveClass || options.exactActiveClass,
              replace: props.replace,
              ariaCurrentValue: props.ariaCurrentValue
            },
            // TODO: Slot API
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
        const rel = props.noRel
          ? null
          // converts `""` to `null` to prevent the attribute from being added as empty (`rel=""`)
          : firstNonUndefined<string | null>(props.rel, options.externalRelAttribute, DEFAULT_EXTERNAL_REL_ATTRIBUTE) || null

        return h('a', { href, rel, target }, slots.default())
      }
    }
  }) as unknown as DefineComponent<NuxtLinkProps>
}

export default defineNuxtLink({ componentName: 'NuxtLink' })
