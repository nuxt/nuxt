import { beforeEach, describe, expect, it, vi } from 'vitest'
import { augmentAndResolve, normalizeRoutes } from '../src/pages/utils.ts'
import type { Nuxt, NuxtPage } from '../schema.ts'

const holder = vi.hoisted(() => ({ nuxt: undefined as unknown }))
vi.mock('@nuxt/kit', async (original) => {
  const mod = await original<typeof import('@nuxt/kit')>()
  return {
    ...mod,
    useNuxt: vi.fn(() => holder.nuxt),
    tryUseNuxt: vi.fn(() => holder.nuxt),
  }
})

interface FakeNuxtOptions {
  vfs: Record<string, string>
  scanPageMeta?: boolean | 'after-resolve'
  extractSerializablePageMeta?: boolean
  extraPageMetaExtractionKeys?: string[]
}

function createNuxt ({ vfs, scanPageMeta = 'after-resolve', extractSerializablePageMeta = false, extraPageMetaExtractionKeys = [] }: FakeNuxtOptions) {
  const hooks: Record<string, Array<(...args: any[]) => any>> = {}
  const nuxt = {
    vfs,
    options: {
      experimental: {
        scanPageMeta,
        extractSerializablePageMeta,
        extraPageMetaExtractionKeys,
        normalizePageNames: false,
      },
    },
    hook: (name: string, fn: (...args: any[]) => any) => void (hooks[name] ??= []).push(fn),
    callHook: async (name: string, ...args: any[]) => {
      for (const fn of hooks[name] ?? []) {
        await fn(...args)
      }
    },
  }
  holder.nuxt = nuxt
  return nuxt as unknown as Nuxt & typeof nuxt
}

function resolve (nuxt: ReturnType<typeof createNuxt>, pages: NuxtPage[]) {
  return augmentAndResolve(pages, new Set(Object.keys(nuxt.vfs)), nuxt as unknown as Nuxt)
}

function generate (pages: NuxtPage[], overrideMeta = true) {
  return normalizeRoutes(pages, new Set(), {
    clientComponentRuntime: '<client-component-runtime>',
    serverComponentRuntime: '<server-component-runtime>',
    overrideMeta,
  }).routes
}

const filePath = '/app/pages/about.vue'

beforeEach(() => {
  holder.nuxt = undefined
})

describe('page meta overrides from hooks', () => {
  it('should keep meta a module adds in `pages:resolved`', async () => {
    const nuxt = createNuxt({ vfs: { [filePath]: `<script setup>definePageMeta({ layout: someLayout })</script>` } })
    nuxt.hook('pages:resolved', (pages: NuxtPage[]) => {
      pages[0]!.meta = { ...pages[0]!.meta, fromModule: 'kept' }
    })

    const pages = await resolve(nuxt, [{ path: '/about', file: filePath }])
    const routes = generate(pages)

    // the macro module still supplies the runtime `layout`, and the module's key is layered on top
    expect(routes).toContain('|| {}), ...{"fromModule":"kept"} }')
  })

  it('should let a module override a statically extracted value without changing what was scanned', async () => {
    const nuxt = createNuxt({
      vfs: { [filePath]: `<script setup>definePageMeta({ name: 'from-file', title: 'from-file' })</script>` },
      extractSerializablePageMeta: true,
      scanPageMeta: true,
    })
    nuxt.hook('pages:resolved', (pages: NuxtPage[]) => {
      pages[0]!.name = 'from-module'
      pages[0]!.meta!.title = 'from-module'
    })

    const pages = await resolve(nuxt, [{ path: '/about', file: filePath }])
    expect(pages[0]!.name).toBe('from-module')
    expect(generate(pages)).toContain('name: "from-module"')
    expect(generate(pages)).toContain('"title":"from-module"')

    // a second route reusing the file re-reads the scanned metadata, which the override left alone
    const reused = await resolve(createNuxt({
      vfs: { [filePath]: `<script setup>definePageMeta({ name: 'from-file', title: 'from-file' })</script>` },
      extractSerializablePageMeta: true,
      scanPageMeta: true,
    }), [{ path: '/about-again', file: filePath }])
    expect(reused[0]!.name).toBe('from-file')
    expect(reused[0]!.meta).toEqual({ title: 'from-file' })
  })
})

describe('page meta through i18n-shaped route localization', () => {
  const locales = ['en', 'ja']

  /**
   * Mirrors how `@nuxtjs/i18n` uses the pages workflow: it reads custom paths from an extra
   * extraction key, replaces every page with one shallow copy per locale (the copies share the
   * original `meta` object), and then strips its own meta, dropping `page.meta` entirely when
   * nothing of its own is left.
   */
  function localize (pages: NuxtPage[]): NuxtPage[] {
    const localized = pages.flatMap(page => locales.map((locale) => {
      const custom = (page.meta?.i18n as { paths?: Record<string, string> } | undefined)?.paths?.[locale]
      const copy: NuxtPage = {
        ...page,
        path: `/${locale}${custom ?? page.path}`,
        name: `${page.name ?? 'page'}___${locale}`,
      }
      if (page.children?.length) {
        copy.children = localize(page.children)
      }
      return copy
    }))
    for (const page of localized) {
      if (typeof page.meta?.i18n === 'object') {
        delete page.meta.i18n
        if (Object.keys(page.meta).length === 0) {
          delete page.meta
        }
      }
    }
    return localized
  }

  function createI18nNuxt (vfs: Record<string, string>) {
    const nuxt = createNuxt({ vfs, extraPageMetaExtractionKeys: ['i18n'] })
    nuxt.hook('pages:resolved', (pages: NuxtPage[]) => {
      const localized = localize(pages)
      pages.length = 0
      pages.push(...localized)
    })
    return nuxt
  }

  it('should keep runtime page meta reachable after custom paths are stripped', async () => {
    const nuxt = createI18nNuxt({
      [filePath]: `<script setup>definePageMeta({ i18n: { paths: { ja: '/gaiyou' } }, layout: someLayout })</script>`,
    })

    const pages = await resolve(nuxt, [{ path: '/about', file: filePath }])
    expect(pages.map(page => page.path)).toEqual(['/en/about', '/ja/gaiyou'])
    // the copies share one meta object, so stripping the module's own key empties it for all of
    // them and drops `page.meta` from the copy that got there first
    expect(pages.map(page => page.meta)).toEqual([undefined, {}])

    const routes = generate(pages)
    // `layout` cannot be extracted, so both copies have to take their meta from the macro module
    expect(routes.match(/meta: \w+Meta \|\| \{\}/g)).toHaveLength(2)
    expect(routes).not.toContain('i18n')
  })

  it('should apply custom paths taken from an extra extraction key and strip them afterwards', async () => {
    const nuxt = createI18nNuxt({
      [filePath]: `<script setup>definePageMeta({ i18n: { paths: { ja: '/gaiyou' } } })</script>`,
    })

    const pages = await resolve(nuxt, [{ path: '/about', file: filePath }])
    expect(pages.map(page => page.path)).toEqual(['/en/about', '/ja/gaiyou'])

    const routes = generate(pages)
    expect(routes).not.toContain('i18n')
    expect(routes).toContain('path: "/ja/gaiyou"')
    // every key was statically extracted, so no route needs the macro module
    expect(routes).not.toContain('Meta?.')
  })

  it('should not leak scanned metadata between two instances reading the same file', async () => {
    const contents = `<script setup>definePageMeta({ title: 'hello' })</script>`

    // an instance that extracts `title` can hardcode it into the route record
    const withExtraKey = createNuxt({ vfs: { [filePath]: contents }, extraPageMetaExtractionKeys: ['title'] })
    const extracted = await resolve(withExtraKey, [{ path: '/about', file: filePath }])
    expect(extracted[0]!.meta).toEqual({ title: 'hello' })

    holder.nuxt = withExtraKey
    expect(generate(extracted)).toContain('meta: {"title":"hello"}')

    // an instance that does not has to leave the same key to the macro module
    const withoutExtraKey = createNuxt({ vfs: { [filePath]: contents } })
    const deferred = await resolve(withoutExtraKey, [{ path: '/about', file: filePath }])
    expect(deferred[0]!.meta).toBeUndefined()

    holder.nuxt = withoutExtraKey
    const deferredRoutes = generate(deferred)
    expect(deferredRoutes).toContain('Meta || {}')
    expect(deferredRoutes).not.toContain('"title"')
  })
})
