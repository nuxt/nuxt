import { expect, describe, it, vi } from 'vitest'
import type { RouteLocation, RouteLocationRaw } from 'vue-router'
import type { NuxtLinkOptions, NuxtLinkProps } from '../src/app/components/nuxt-link'
import { defineNuxtLink } from '../src/app/components/nuxt-link'

// Mocks `h()`
vi.mock('vue', async () => {
  const vue: Record<string, unknown> = await vi.importActual('vue')
  return {
    ...vue,
    resolveComponent: (name: string) => name,
    h: (...args: any[]) => args
  }
})

// Mocks Nuxt `useRouter()`
vi.mock('../src/app/composables/router', () => ({
  useRouter: () => ({
    resolve: (route: string | RouteLocation & { to?: string }): Partial<RouteLocation> & { href?: string } => {
      if (typeof route === 'string') {
        return { href: route, path: route }
      }
      return route.to
        ? { href: route.to }
        : {
            path: route.path || `/${route.name?.toString()}` || undefined,
            query: route.query || undefined,
            hash: route.hash || undefined
          }
    }
  })
}))

// Helpers for test visibility
const EXTERNAL = 'a'
const INTERNAL = 'RouterLink'

// Renders a `<NuxtLink />`
const nuxtLink = (
  props: NuxtLinkProps = {},
  nuxtLinkOptions: Partial<NuxtLinkOptions> = {}
): { type: string, props: Record<string, unknown>, slots: unknown } => {
  const component = defineNuxtLink({ componentName: 'NuxtLink', ...nuxtLinkOptions })

  const [type, _props, slots] = (component.setup as unknown as (props: NuxtLinkProps, context: { slots: Record<string, () => unknown> }) =>
    () => [string, Record<string, unknown>, unknown])(props, { slots: { default: () => null } })()

  return { type, props: _props, slots }
}

describe('nuxt-link:to', () => {
  it('renders link with `to` prop', () => {
    expect(nuxtLink({ to: '/to' }).props.to).toBe('/to')
  })

  it('renders link with `href` prop', () => {
    expect(nuxtLink({ href: '/href' }).props.to).toBe('/href')
  })

  it('renders link with `to` prop and warns about `href` prop conflict', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn() as any)

    expect(nuxtLink({ to: '/to', href: '/href' }).props.to).toBe('/to')
    // TODO: Uncomment when `dev` mode for tests is available
    // expect(consoleWarnSpy).toHaveBeenCalledOnce()

    consoleWarnSpy.mockRestore()
  })

  it('without to and href', () => {
    const link = nuxtLink()
    expect(link.props.href).toBe(null)
    expect(link.props.rel).toBe(null)
  })
})

describe('nuxt-link:isExternal', () => {
  it('returns based on `to` value', () => {
    // Internal
    expect(nuxtLink({ to: '/foo' }).type).toBe(INTERNAL)
    expect(nuxtLink({ to: '/foo/bar' }).type).toBe(INTERNAL)
    expect(nuxtLink({ to: '/foo/bar?baz=qux' }).type).toBe(INTERNAL)

    // External
    expect(nuxtLink({ to: 'https://nuxtjs.org' }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: '//nuxtjs.org' }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: 'tel:0123456789' }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: 'mailto:hello@nuxtlabs.com' }).type).toBe(EXTERNAL)
  })

  it('returns `false` when `to` is a route location object', () => {
    expect(nuxtLink({ to: { to: '/to' } as RouteLocationRaw }).type).toBe(INTERNAL)
  })

  it('honors `external` prop', () => {
    expect(nuxtLink({ to: '/to', external: true }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: '/to', external: false }).type).toBe(INTERNAL)
  })

  it('returns `true` when using the `target` prop', () => {
    expect(nuxtLink({ to: '/foo', target: '_blank' }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: '/foo/bar', target: '_blank' }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: '/foo/bar?baz=qux', target: '_blank' }).type).toBe(EXTERNAL)
  })
})

describe('nuxt-link:propsOrAttributes', () => {
  describe('`isExternal` is `true`', () => {
    describe('href', () => {
      it('forwards `to` value', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org' }).props.href).toBe('https://nuxtjs.org')
      })

      it('resolves route location object', () => {
        expect(nuxtLink({ to: { to: '/to' } as RouteLocationRaw, external: true }).props.href).toBe('/to')
      })
    })

    describe('target', () => {
      it('forwards `target` prop', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org', target: '_blank' }).props.target).toBe('_blank')
        expect(nuxtLink({ to: 'https://nuxtjs.org', target: null }).props.target).toBe(null)
      })

      it('defaults to `null`', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org' }).props.target).toBe(null)
      })
    })

    describe('rel', () => {
      it('uses framework\'s default', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org' }).props.rel).toBe('noopener noreferrer')
      })

      it('uses user\'s default', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org' }, { externalRelAttribute: 'foo' }).props.rel).toBe('foo')
        expect(nuxtLink({ to: 'https://nuxtjs.org' }, { externalRelAttribute: null }).props.rel).toBe(null)
      })

      it('uses and favors `rel` prop', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org', rel: 'foo' }).props.rel).toBe('foo')
        expect(nuxtLink({ to: 'https://nuxtjs.org', rel: 'foo' }, { externalRelAttribute: 'bar' }).props.rel).toBe('foo')
        expect(nuxtLink({ to: 'https://nuxtjs.org', rel: null }, { externalRelAttribute: 'bar' }).props.rel).toBe(null)
        expect(nuxtLink({ to: 'https://nuxtjs.org', rel: '' }, { externalRelAttribute: 'bar' }).props.rel).toBe(null)
      })

      it('honors `noRel` prop', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org', noRel: true }).props.rel).toBe(null)
        expect(nuxtLink({ to: 'https://nuxtjs.org', noRel: false }).props.rel).toBe('noopener noreferrer')
      })

      it('honors `noRel` prop and warns about `rel` prop conflict', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn() as any)

        expect(nuxtLink({ to: 'https://nuxtjs.org', noRel: true, rel: 'foo' }).props.rel).toBe(null)
        // TODO: Uncomment when `dev` mode for tests is available
        // expect(consoleWarnSpy).toHaveBeenCalledOnce()

        consoleWarnSpy.mockRestore()
      })
    })
  })

  describe('`isExternal` is `false`', () => {
    describe('to', () => {
      it('forwards `to` prop', () => {
        expect(nuxtLink({ to: '/to' }).props.to).toBe('/to')
        expect(nuxtLink({ to: { to: '/to' } as RouteLocationRaw }).props.to).toEqual({ to: '/to' })
      })
    })

    describe('activeClass', () => {
      it('uses framework\'s default', () => {
        expect(nuxtLink({ to: '/to' }).props.activeClass).toBe(undefined)
      })

      it('uses user\'s default', () => {
        expect(nuxtLink({ to: '/to' }, { activeClass: 'activeClass' }).props.activeClass).toBe('activeClass')
      })

      it('uses and favors `activeClass` prop', () => {
        expect(nuxtLink({ to: '/to', activeClass: 'propActiveClass' }).props.activeClass).toBe('propActiveClass')
        expect(nuxtLink({ to: '/to', activeClass: 'propActiveClass' }, { activeClass: 'activeClass' }).props.activeClass).toBe('propActiveClass')
      })
    })

    describe('exactActiveClass', () => {
      it('uses framework\'s default', () => {
        expect(nuxtLink({ to: '/to' }).props.exactActiveClass).toBe(undefined)
      })

      it('uses user\'s default', () => {
        expect(nuxtLink({ to: '/to' }, { exactActiveClass: 'exactActiveClass' }).props.exactActiveClass).toBe('exactActiveClass')
      })

      it('uses and favors `exactActiveClass` prop', () => {
        expect(nuxtLink({ to: '/to', exactActiveClass: 'propExactActiveClass' }).props.exactActiveClass).toBe('propExactActiveClass')
        expect(nuxtLink({ to: '/to', exactActiveClass: 'propExactActiveClass' }, { exactActiveClass: 'exactActiveClass' }).props.exactActiveClass).toBe('propExactActiveClass')
      })
    })

    describe('replace', () => {
      it('forwards `replace` prop', () => {
        expect(nuxtLink({ to: '/to', replace: true }).props.replace).toBe(true)
        expect(nuxtLink({ to: '/to', replace: false }).props.replace).toBe(false)
      })
    })

    describe('ariaCurrentValue', () => {
      it('forwards `ariaCurrentValue` prop', () => {
        expect(nuxtLink({ to: '/to', ariaCurrentValue: 'page' }).props.ariaCurrentValue).toBe('page')
        expect(nuxtLink({ to: '/to', ariaCurrentValue: 'step' }).props.ariaCurrentValue).toBe('step')
      })
    })

    describe('trailingSlashBehavior', () => {
      it('append slash', () => {
        const appendSlashOptions: NuxtLinkOptions = { trailingSlash: 'append' }

        expect(nuxtLink({ to: '/to' }, appendSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: '/to/' }, appendSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: { name: 'to' } }, appendSlashOptions).props.to).toHaveProperty('path', '/to/')
        expect(nuxtLink({ to: { path: '/to' } }, appendSlashOptions).props.to).toHaveProperty('path', '/to/')
        expect(nuxtLink({ href: '/to' }, appendSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: '/to?param=1' }, appendSlashOptions).props.to).toEqual('/to/?param=1')
      })

      it('remove slash', () => {
        const removeSlashOptions: NuxtLinkOptions = { trailingSlash: 'remove' }

        expect(nuxtLink({ to: '/to' }, removeSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: '/to/' }, removeSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: { name: 'to' } }, removeSlashOptions).props.to).toHaveProperty('path', '/to')
        expect(nuxtLink({ to: { path: '/to/' } }, removeSlashOptions).props.to).toHaveProperty('path', '/to')
        expect(nuxtLink({ href: '/to/' }, removeSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: '/to/?param=1' }, removeSlashOptions).props.to).toEqual('/to?param=1')
      })
    })
  })
})
