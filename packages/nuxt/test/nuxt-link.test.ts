import { describe, expect, it, vi } from 'vitest'
import type { RouteLocation, RouteLocationRaw } from 'vue-router'
import { withQuery } from 'ufo'
import type { NuxtLinkOptions, NuxtLinkProps } from '../src/app/components/nuxt-link'
import { defineNuxtLink } from '../src/app/components/nuxt-link'
import { useRuntimeConfig } from '../src/app/nuxt'

// mocks `useRuntimeConfig()`
vi.mock('../src/app/nuxt', () => ({
  useRuntimeConfig: vi.fn(() => ({
    app: {
      baseURL: '/',
    },
  })),
}))

// Mocks `h()`
vi.mock('vue', async () => {
  const vue: Record<string, unknown> = await vi.importActual('vue')
  return {
    ...vue,
    resolveComponent: (name: string) => name,
    h: (...args: any[]) => args,
  }
})

// Mocks Nuxt `useRouter()`
vi.mock('../src/app/composables/router', () => ({
  resolveRouteObject (to: Exclude<RouteLocationRaw, string>) {
    return withQuery(to.path || '', to.query || {}) + (to.hash || '')
  },
  useRouter: () => ({
    resolve: (route: string | RouteLocation): Partial<RouteLocation> & { href: string } => {
      if (typeof route === 'string') {
        return { path: route, href: route }
      }
      return {
        path: route.path || `/${route.name?.toString()}`,
        query: route.query || undefined,
        hash: route.hash || undefined,
        href: route.path || `/${route.name?.toString()}`,
      }
    },
  }),
}))

// Helpers for test visibility
const EXTERNAL = 'a'
const INTERNAL = 'RouterLink'

// Renders a `<NuxtLink />`
const nuxtLink = (
  props: NuxtLinkProps = {},
  nuxtLinkOptions: Partial<NuxtLinkOptions> = {},
): { type: string, props: Record<string, unknown>, slots: unknown } => {
  const component = defineNuxtLink({ componentName: 'NuxtLink', ...nuxtLinkOptions })

  const [type, _props, slots] = (
    component as unknown as { setup: (props: NuxtLinkProps, context: { slots: Record<string, () => unknown> }) => () => [string, Record<string, unknown>, unknown] }
  ).setup(props, { slots: { default: () => null } })()

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
    expect(nuxtLink({ to: { path: '/to' } }).type).toBe(INTERNAL)
  })

  it('returns `true` when `to` has a `target`', () => {
    expect(nuxtLink({ to: { path: '/to' }, target: '_blank' }).type).toBe(EXTERNAL)
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

  it('returns `true` if link starts with hash', () => {
    expect(nuxtLink({ href: '#hash' }).type).toBe(EXTERNAL)
    expect(nuxtLink({ to: '#hash' }).type).toBe(EXTERNAL)
  })
})

describe('nuxt-link:propsOrAttributes', () => {
  describe('`isExternal` is `true`', () => {
    describe('href', () => {
      it('forwards `to` value', () => {
        expect(nuxtLink({ to: 'https://nuxtjs.org' }).props.href).toBe('https://nuxtjs.org')
      })

      it('resolves route location object', () => {
        expect(nuxtLink({ to: { path: '/to' }, external: true }).props.href).toBe('/to')
      })

      it('resolves route location object with name', () => {
        expect(nuxtLink({ to: { name: 'to' }, external: true }).props.href).toBe('/to')
      })

      it('applies trailing slash behaviour', () => {
        expect(nuxtLink({ to: { path: '/to' }, external: true }, { trailingSlash: 'append' }).props.href).toBe('/to/')
        expect(nuxtLink({ to: '/to', external: true }, { trailingSlash: 'append' }).props.href).toBe('/to/')
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

      it('prefixes target="_blank" internal links with baseURL', () => {
        vi.mocked(useRuntimeConfig).withImplementation(() => {
          return {
            app: {
              baseURL: '/base',
            },
          } as any
        }, () => {
          expect(nuxtLink({ to: '/', target: '_blank' }).props.href).toBe('/base')
          expect(nuxtLink({ to: '/base', target: '_blank' }).props.href).toBe('/base/base')
          expect(nuxtLink({ to: '/to', target: '_blank' }).props.href).toBe('/base/to')
          expect(nuxtLink({ to: '/base/to', target: '_blank' }).props.href).toBe('/base/base/to')
          expect(nuxtLink({ to: '//base/to', target: '_blank' }).props.href).toBe('//base/to')
          expect(nuxtLink({ to: '//to.com/thing', target: '_blank' }).props.href).toBe('//to.com/thing')
          expect(nuxtLink({ to: 'https://test.com/to', target: '_blank' }).props.href).toBe('https://test.com/to')

          expect(nuxtLink({ to: '/', target: '_blank' }, { trailingSlash: 'append' }).props.href).toBe('/base/')
          expect(nuxtLink({ to: '/base/', target: '_blank' }, { trailingSlash: 'remove' }).props.href).toBe('/base/base')
        })
      })

      it('excludes the baseURL for external links', () => {
        vi.mocked(useRuntimeConfig).withImplementation(() => {
          return {
            app: {
              baseURL: '/base',
            },
          } as any
        }, () => {
          expect(nuxtLink({ to: 'http://nuxtjs.org/app/about', target: '_blank' }).props.href).toBe('http://nuxtjs.org/app/about')
          expect(nuxtLink({ to: '//nuxtjs.org/app/about', target: '_blank' }).props.href).toBe('//nuxtjs.org/app/about')
          expect(nuxtLink({ to: { path: '/' }, external: true }).props.href).toBe('/')
          expect(nuxtLink({ to: '/', external: true }).props.href).toBe('/')
        })
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
        expect(nuxtLink({ to: { path: '/to' } }).props.to).toEqual({ path: '/to' })
        expect(nuxtLink({ to: { name: 'to' } }).props.to).toEqual({ name: 'to' })
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
      it('append slash using options', () => {
        const appendSlashOptions: NuxtLinkOptions = { trailingSlash: 'append' }

        expect(nuxtLink({ to: '/to' }, appendSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: '/to/' }, appendSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: '/to#abc' }, appendSlashOptions).props.to).toEqual('/to/#abc')
        expect(nuxtLink({ to: { name: 'to' } }, appendSlashOptions).props.to).toHaveProperty('path', '/to/')
        expect(nuxtLink({ to: { path: '/to' } }, appendSlashOptions).props.to).toHaveProperty('path', '/to/')
        expect(nuxtLink({ to: { path: '/to#abc' } }, appendSlashOptions).props.to).toHaveProperty('path', '/to/#abc')
        expect(nuxtLink({ href: '/to' }, appendSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ href: '/to#abc' }, appendSlashOptions).props.to).toEqual('/to/#abc')
        expect(nuxtLink({ to: '/to?param=1' }, appendSlashOptions).props.to).toEqual('/to/?param=1')
        expect(nuxtLink({ to: '/to?param=1#abc' }, appendSlashOptions).props.to).toEqual('/to/?param=1#abc')
        expect(nuxtLink({ href: 'mailto:test@example.com' }, appendSlashOptions).props.href).toEqual('mailto:test@example.com')
      })

      it('remove slash using options', () => {
        const removeSlashOptions: NuxtLinkOptions = { trailingSlash: 'remove' }

        expect(nuxtLink({ to: '/to' }, removeSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: '/to/' }, removeSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: '/to/#abc' }, removeSlashOptions).props.to).toEqual('/to#abc')
        expect(nuxtLink({ to: { name: 'to' } }, removeSlashOptions).props.to).toHaveProperty('path', '/to')
        expect(nuxtLink({ to: { path: '/to/' } }, removeSlashOptions).props.to).toHaveProperty('path', '/to')
        expect(nuxtLink({ to: { path: '/to/#abc' } }, removeSlashOptions).props.to).toHaveProperty('path', '/to#abc')
        expect(nuxtLink({ href: '/to/' }, removeSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: '/to/?param=1' }, removeSlashOptions).props.to).toEqual('/to?param=1')
        expect(nuxtLink({ to: '/to/?param=1#abc' }, removeSlashOptions).props.to).toEqual('/to?param=1#abc')
        expect(nuxtLink({ href: 'mailto:test@example.com' }, removeSlashOptions).props.href).toEqual('mailto:test@example.com')
      })

      it('prop overrides option: append', () => {
        const removeSlashOptions: NuxtLinkOptions = { trailingSlash: 'remove' }
        // Prop takes priority
        expect(nuxtLink({ to: '/to', trailingSlash: 'append' }, removeSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: '/to/', trailingSlash: 'append' }, removeSlashOptions).props.to).toEqual('/to/')
        expect(nuxtLink({ to: { path: '/to' }, trailingSlash: 'append' }, removeSlashOptions).props.to).toHaveProperty('path', '/to/')
        // External links
        expect(nuxtLink({ to: '/to', external: true, trailingSlash: 'append' }, removeSlashOptions).props.href).toBe('/to/')
      })

      it('prop overrides option: remove', () => {
        const appendSlashOptions: NuxtLinkOptions = { trailingSlash: 'append' }
        // Prop takes priority
        expect(nuxtLink({ to: '/to/', trailingSlash: 'remove' }, appendSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: '/to', trailingSlash: 'remove' }, appendSlashOptions).props.to).toEqual('/to')
        expect(nuxtLink({ to: { path: '/to/' }, trailingSlash: 'remove' }, appendSlashOptions).props.to).toHaveProperty('path', '/to')
        // External links
        expect(nuxtLink({ to: '/to/', external: true, trailingSlash: 'remove' }, appendSlashOptions).props.href).toBe('/to')
      })

      it('uses option when prop is not provided', () => {
        const appendSlashOptions: NuxtLinkOptions = { trailingSlash: 'append' }
        const removeSlashOptions: NuxtLinkOptions = { trailingSlash: 'remove' }

        // Use append option
        expect(nuxtLink({ to: '/to' }, appendSlashOptions).props.to).toEqual('/to/')
        // Use remove option
        expect(nuxtLink({ to: '/to/' }, removeSlashOptions).props.to).toEqual('/to')
        // External links with options
        expect(nuxtLink({ to: '/to', external: true }, appendSlashOptions).props.href).toBe('/to/')
        expect(nuxtLink({ to: '/to/', external: true }, removeSlashOptions).props.href).toBe('/to')
      })
    })
  })
})
