import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import { compileScript, parse } from '@vue/compiler-sfc'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { defu } from 'defu'
import { klona } from 'klona'
import { parse as toAst } from 'acorn'

import { useNuxt } from '@nuxt/kit'
import { PageMetaPlugin } from '../src/pages/plugins/page-meta.ts'
import { augmentPages, normalizeRoutes } from '../src/pages/utils.ts'
import { getRouteMeta as _getRouteMeta, defaultExtractionKeys, dynamicPageMetaCache, getDynamicMetaKeys, getDynamicPageMeta, shouldExtractSerializablePageMeta } from '../src/pages/page-meta-extraction.ts'
import type { Nuxt, NuxtPage } from '../schema.ts'

const filePath = '/app/pages/index.vue'

function augmentForNuxt (pages: NuxtPage[], vfs: Record<string, string>, ctx: Parameters<typeof augmentPages>[2] = {}) {
  return augmentPages(pages, vfs, { nuxt: mockNuxt as unknown as Nuxt, ...ctx })
}

function augmentFile (pages: NuxtPage[], contents: string, ctx: Parameters<typeof augmentPages>[2] = {}) {
  const file = pages[0]!.file!
  return augmentForNuxt(pages, { [file]: contents }, { fullyResolvedPaths: new Set([file]), ...ctx })
}

function generate (pages: NuxtPage[], overrideMeta = true) {
  return normalizeRoutes(pages, new Set(), {
    clientComponentRuntime: '<client-component-runtime>',
    serverComponentRuntime: '<server-component-runtime>',
    overrideMeta,
  })
}

/**
 * Extracted metadata, plus the keys the file leaves to the runtime macro module (which are no
 * longer part of the extracted object).
 */
function getRouteMeta (contents: string, absolutePath: string, extraExtractionKeys?: Set<string>, options: { extractSerializable?: boolean } = {}) {
  const meta = _getRouteMeta(contents, absolutePath, extraExtractionKeys, options)
  const dynamic = getDynamicMetaKeys(absolutePath, extraExtractionKeys, options)
  return dynamic.size ? { ...meta, dynamic } : meta
}

let fileCounter = 0
const uniquePath = (ext = 'vue') => `/app/pages/page-${fileCounter++}.${ext}`
const setup = (script: string) => `<script setup lang="ts">\n${script}\n</script>`

type MacroPlugin = { transform: { handler: (code: string, id: string) => { code: string } | null } }
function createMacroPlugin (options: Parameters<typeof PageMetaPlugin>[0]) {
  return PageMetaPlugin(options).raw({}, {} as any) as MacroPlugin
}
function transformSFC (sfc: string, plugin: MacroPlugin) {
  const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
  return plugin.transform.handler(res.content, 'component.vue?macro=true')?.code
}

vi.mock('klona', { spy: true })
const mockNuxt = vi.hoisted(() => ({
  options: {
    rootDir: '/',
    experimental: {
      normalizePageNames: false,
    },
  },
}))
vi.mock('@nuxt/kit', async (original) => {
  const mod = await original<typeof import('@nuxt/kit')>()
  return {
    ...mod,
    useNuxt: vi.fn(() => mockNuxt),
  }
})

const dynamic = (...keys: string[]) => new Set(keys)

describe('page metadata', () => {
  it.each<[description: string, contents: string, expected: Record<string, any>, extraKeys?: string[]]>([
    ['an empty file', '', {}],
    ['a file without scripts', '<template><div>Hi</div></template>', {}],
    ['a file using `<Script*>` components', `
<template>
  <div>
    <ScriptYouTubePlayer video-id="dQw4w9WgXcQ" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dark',
})
</script>`, { dynamic: dynamic('meta') }],
    ['multiple script blocks and escaped closing tags', `
<script>
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
const snippet = '<\\/script>'
definePageMeta({
  name: 'multi',
})
</script>

<template><div /></template>`, { name: 'multi' }],
    ['a template referencing script tags', `
<template>
  <div>
    <script-placeholder />
    <component is="script" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  path: '/safe',
})
</script>`, { path: '/safe' }],
    ['`lang="jsx"` vue files', `
  <script setup lang="jsx">
  const foo = <></>;
  definePageMeta({ name: 'bar' })
  </script>`, { name: 'bar' }],
    ['`lang="tsx"` vue files using multiple macros', `
<template><PageContent /></template>
<script setup lang="tsx">
definePageMeta({ name: 'bar' })
defineRouteRules({})
const PageContent = () => (<div>Home Page</div>)
</script>`, { name: 'bar', rules: {} }],
    ['files using experimental decorators', setup(`
function something (_method: () => unknown) {
  return () => 'decorated'
}
class SomeClass {
  @something
  public someMethod () {
    return 'initial'
  }
}
definePageMeta({ name: 'bar' })`), { name: 'bar' }],
    ['serialisable values of every type', `
    <script setup>
    definePageMeta({
      path: '/some-custom-path',
      validate: () => true,
      middleware: [
        function () {},
      ],
      otherValue: {
        foo: 'bar',
      },
      name: 'some-custom-name',
      props: {
        foo: 'bar',
      },
      alias: ['/alias'],
    })
    </script>
    `, { alias: ['/alias'], name: 'some-custom-name', path: '/some-custom-path', props: { foo: 'bar' }, dynamic: dynamic('middleware', 'meta') }],
    ['values wrapped in TS expressions', setup(`
type PageName = 'name-from-page-meta' | 'whatever';

definePageMeta({
  name: 'name-from-page-meta' as PageName,
  path: ('/some-custom-path') as const,
  alias: <string>'/some-alias',
  redirect: '/some-redirect'!,
  props: <{ foo: string }>{
    foo: 'bar' satisfies string,
  },
} as const);`), { alias: '/some-alias', name: 'name-from-page-meta', path: '/some-custom-path', props: { foo: 'bar' }, redirect: '/some-redirect' }],
    ['typed macro calls', setup(`
interface PageMeta {
  name: string
}

definePageMeta<PageMeta>({
  name: 'name-from-page-meta',
  props: { foo: 'bar' },
});`), { name: 'name-from-page-meta', props: { foo: 'bar' } }],
    ['non-serialisable values', setup(`definePageMeta({ redirect: () => '/' })`), { dynamic: dynamic('redirect') }],
    ['files with an options API block and a setup block', `
    <script lang="ts">
    export default {
      name: 'thing'
    }
    </script>
    <script setup>
    definePageMeta({
      name: 'some-custom-name',
      path: '/some-custom-path',
      validate: () => true,
      middleware: [
        function () {},
      ],
      otherValue: {
        foo: 'bar',
      },
    })
    </script>
    `, { name: 'some-custom-name', path: '/some-custom-path', dynamic: dynamic('middleware', 'meta') }],
    ['an options API `setup()`', `
    <script>
    export default {
      setup() {
        definePageMeta({
          name: 'some-custom-name',
          path: '/some-custom-path',
          middleware: (from, to) => console.warn('middleware'),
        })
      },
    };
    </script>
    `, { name: 'some-custom-name', path: '/some-custom-path', dynamic: dynamic('middleware') }],
    ['quoted unlisted keys', setup(`definePageMeta({ "otherValue": { foo: 'bar' } })`), { dynamic: dynamic('meta') }],
    ['configured extra keys, into the page meta', setup(`definePageMeta({ foo: 'bar', bar: true })`), { meta: { bar: true, foo: 'bar' } }, ['bar', 'foo']],
    ['default keys, not into the page meta', setup(`definePageMeta({ alias: '/alias', bar: true })`), { alias: '/alias', meta: { bar: true } }, ['bar']],
    ['spread properties, as dynamic', setup(`definePageMeta({ ...common })`), { dynamic: dynamic('meta') }],
    ['computed keys, as dynamic', setup(`definePageMeta({ [name]: 'some-custom-name' })`), { dynamic: dynamic('meta') }],
    ['an argument that is not an object literal, as dynamic', setup(`const meta = { name: 'some-custom-name' }\ndefinePageMeta(meta)`), { dynamic: dynamic('meta') }],
    ['a macro call that is not a statement', setup(`if (condition) { void definePageMeta({ name: 'some-custom-name' }) }`), { name: 'some-custom-name' }],
    ['nothing for a mention of a macro name', setup(`// definePageMeta({ name: 'commented-out' })\nconst doc = 'call definePageMeta to set page metadata'`), {}],
  ])('should extract %s', (_, contents, expected, extraKeys = []) => {
    expect(getRouteMeta(contents, filePath, new Set(extraKeys))).toStrictEqual(expected)
  })

  it.each(['js', 'jsx', 'ts', 'cts', 'mts', 'tsx', 'mjs', 'cjs'])('should extract metadata from .%s files', (ext) => {
    expect(getRouteMeta(`definePageMeta({ name: 'bar' })`, `/app/pages/index.${ext}`)).toStrictEqual({ name: 'bar' })
  })

  it('should parse JSX files', () => {
    const contents = `
export default {
  setup () {
    definePageMeta({ name: 'bar' })
    return () => <div></div>
  }
}`
    expect(getRouteMeta(contents, `/app/pages/index.jsx`)).toStrictEqual({ name: 'bar' })
  })

  it('should use and invalidate cache', () => {
    const _klona = klona as unknown as MockedFunction<typeof klona>
    _klona.mockImplementation(obj => obj)
    const fileContents = `<script setup>definePageMeta({ foo: 'bar' })</script>`
    const meta = _getRouteMeta(fileContents, filePath)
    expect(meta === _getRouteMeta(fileContents, filePath)).toBeTruthy()
    expect(meta === _getRouteMeta(fileContents, '/app/pages/other.vue')).toBeFalsy()
    expect(meta === _getRouteMeta('<template><div>Hi</div></template>' + fileContents, filePath)).toBeFalsy()
    _klona.mockReset()
  })

  it('should key the extraction cache on the extra extraction keys', () => {
    const sfc = `<script setup>definePageMeta({ middleware: someRef })</script>`
    const path = '/app/pages/extra-keys.vue'
    // whether `middleware` is an extra extraction key decides if the route field or the whole meta
    // object has to come from the macro module, so it cannot share a cache entry
    expect(getRouteMeta(sfc, path, new Set(['middleware']))).toEqual({ dynamic: dynamic('meta') })
    expect(getRouteMeta(sfc, path, new Set())).toEqual({ dynamic: dynamic('middleware') })
  })

  it('should not share state between page metadata', () => {
    const fileContents = `<script setup>definePageMeta({ foo: 'bar' })</script>`
    const meta = _getRouteMeta(fileContents, filePath)
    expect(meta === _getRouteMeta(fileContents, filePath)).toBeFalsy()
  })
})

describe('page metadata macro position', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(pageDiagnostics, 'NUXT_B4007').mockReturnValue(undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['at the top level', setup(`definePageMeta({ name: 'some-custom-name' })\ndefineRouteRules({ prerender: true })`)],
    ['wrapped in parentheses', setup(`;(definePageMeta({ name: 'some-custom-name' }))`)],
    ['wrapped in a type assertion', setup(`definePageMeta({ name: 'some-custom-name' }) as void`)],
    ['at the top level of an Options API `setup()`', `<script>\nexport default {\n  setup () {\n    definePageMeta({ middleware: ['authenticated'] })\n  },\n}\n</script>`],
    ['at the top level of a `defineComponent` `setup()`', `<script lang="ts">\nexport default defineComponent({\n  async setup () {\n    definePageMeta({ middleware: ['authenticated'] })\n  },\n})\n</script>`],
  ])('should not warn when a macro is called %s', (_, contents) => {
    getRouteMeta(contents, uniquePath())
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    ['conditionally inside an Options API `setup()`', `<script>\nexport default {\n  setup () {\n    if (condition) {\n      definePageMeta({ middleware: ['authenticated'] })\n    }\n  },\n}\n</script>`, 'definePageMeta', '5:7'],
    ['conditionally', setup(`if (condition) {\n  definePageMeta({ name: 'some-custom-name' })\n}`), 'definePageMeta', '3:3'],
    ['as an expression', setup(`void definePageMeta({ name: 'some-custom-name' })`), 'definePageMeta', '2:6'],
    ['inside a function', setup(`function setup () {\n  defineRouteRules({ prerender: true })\n}`), 'defineRouteRules', '3:3'],
  ])('should warn when a macro is called %s', (_, contents, fnName, position) => {
    getRouteMeta(contents, uniquePath())
    expect(warn).toHaveBeenCalledWith({ fnName, file: expect.stringMatching(new RegExp(`\\.vue:${position}$`)) })
  })
})

describe('shouldExtractSerializablePageMeta', () => {
  const nuxt = (experimental: Record<string, unknown>) => ({ options: { experimental } }) as any

  it.each([
    { scanPageMeta: 'after-resolve', extractSerializablePageMeta: true, expected: true },
    { scanPageMeta: true, extractSerializablePageMeta: true, expected: true },
    { scanPageMeta: 'after-resolve', extractSerializablePageMeta: false, expected: false },
    // `typedPages` still augments pages when meta is not scanned, but the route record does not
    // override the macro module then, so extracting would duplicate values rather than replace
    // them, and would leak extra keys into the generated route types.
    { scanPageMeta: false, extractSerializablePageMeta: true, expected: false },
    { scanPageMeta: false, extractSerializablePageMeta: false, expected: false },
  ])('$scanPageMeta + $extractSerializablePageMeta -> $expected', ({ expected, ...experimental }) => {
    expect(shouldExtractSerializablePageMeta(nuxt(experimental))).toBe(expected)
  })
})

describe('normalizeRoutes', () => {
  it('should produce valid route objects when used with extracted meta', async () => {
    const page: NuxtPage = { path: '/', file: filePath }
    await augmentFile([page], `
      <script setup>
      definePageMeta({
        name: 'some-custom-name',
        path: ref('/some-custom-path'), /* dynamic */
        validate: () => true,
        redirect: '/',
        middleware: [
          function () {},
        ],
        otherValue: {
          foo: 'bar',
        },
      })
      </script>
      `)

    page.meta ||= {}
    page.meta.layout = 'test'
    page.meta.foo = 'bar'

    expect(generate([page])).toMatchInlineSnapshot(`
      {
        "imports": Set {
          "import { default as indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta } from "/app/pages/index.vue?macro=true";",
        },
        "routes": "[
        {
          name: "some-custom-name",
          path: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.path ?? "/",
          meta: { ...(indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta || {}), ...{"layout":"test","foo":"bar"} },
          redirect: "/",
          component: () => import("/app/pages/index.vue")
        }
      ]",
      }
    `)
  })

  it('should not import the macro module when all metadata was extracted', async () => {
    const page: NuxtPage = { path: '/', file: filePath }
    await augmentFile([page], `<script setup>definePageMeta({ name: 'some-custom-name', alias: ['/some-alias'] })</script>`)

    const { routes, imports } = generate([page])
    expect(imports).toEqual(new Set())
    expect(routes).toMatchInlineSnapshot(`
      "[
        {
          name: "some-custom-name",
          path: "/",
          alias: ["/some-alias"],
          component: () => import("/app/pages/index.vue")
        }
      ]"
    `)
  })

  it('should not import the macro module for pages without page metadata', () => {
    expect(generate([{ path: '/', name: 'index', file: filePath }]).imports).toEqual(new Set())
  })

  it('should generate the same import names when the project is built from another directory', () => {
    const importNameFor = (rootDir: string) => {
      vi.mocked(useNuxt).mockReturnValueOnce({ options: { ...mockNuxt.options, rootDir } } as unknown as Nuxt)
      const { imports } = generate([{ path: '/', name: 'index', file: `${rootDir}/app/pages/index.vue`, _sync: true }], false)
      return [...imports][0]?.match(/default as (\w+)/)?.[1]
    }

    expect(importNameFor('/builds/project')).toBeDefined()
    expect(importNameFor('/home/runner/work/project')).toBe(importNameFor('/builds/project'))
  })

  it('should import the macro module for pages the scanner cannot parse', async () => {
    const page: NuxtPage = { path: '/about', name: 'about', file: '/app/pages/about.md' }
    await augmentFile([page], '---\nmeta:\n  layout: dark\n---\n# About')

    const { routes, imports } = generate([page])
    expect(imports.size).toBe(1)
    expect(routes).toMatchInlineSnapshot(`
      "[
        {
          name: aboutRqheZq9_Iw3x97GGSQFGSL7qA2iT3W_eWQGyZTyyCMMMeta?.name ?? "about",
          path: aboutRqheZq9_Iw3x97GGSQFGSL7qA2iT3W_eWQGyZTyyCMMMeta?.path ?? "/about",
          props: aboutRqheZq9_Iw3x97GGSQFGSL7qA2iT3W_eWQGyZTyyCMMMeta?.props ?? false,
          meta: aboutRqheZq9_Iw3x97GGSQFGSL7qA2iT3W_eWQGyZTyyCMMMeta || {},
          alias: aboutRqheZq9_Iw3x97GGSQFGSL7qA2iT3W_eWQGyZTyyCMMMeta?.alias || [],
          redirect: aboutRqheZq9_Iw3x97GGSQFGSL7qA2iT3W_eWQGyZTyyCMMMeta?.redirect,
          component: () => import("/app/pages/about.md")
        }
      ]"
    `)
  })

  it('should import the macro module for a route whose name was stripped as a duplicate', async () => {
    const pages: NuxtPage[] = [
      { path: '/', file: filePath },
      { path: '/duplicate', file: filePath },
    ]
    await augmentFile(pages, `<script setup>definePageMeta({ name: 'from-macro', alias: ['/some-alias'] })</script>`)

    const { routes, imports } = generate(pages)
    expect(imports.size).toBe(1)
    expect(routes).toMatchInlineSnapshot(`
      "[
        {
          name: "from-macro",
          path: "/",
          alias: ["/some-alias"],
          component: () => import("/app/pages/index.vue")
        },
        {
          name: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.name,
          path: "/duplicate",
          alias: ["/some-alias"],
          component: () => import("/app/pages/index.vue")
        }
      ]"
    `)
  })

  it('should import the macro module when metadata is not statically analysable', async () => {
    const page: NuxtPage = { path: '/', name: 'index', file: filePath }
    await augmentFile([page], `<script setup>definePageMeta({ layout: 'custom' })</script>`)

    expect(generate([page]).imports).toEqual(new Set([
      'import { default as indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta } from "/app/pages/index.vue?macro=true";',
    ]))
  })

  it.each([
    // a module adding and then stripping its own meta key, dropping `page.meta` once it is empty
    (page: NuxtPage) => {
      page.meta = defu({ fromModule: {} }, klona(page.meta))
      delete page.meta.fromModule
      if (Object.keys(page.meta).length === 0) {
        delete page.meta
      }
      return [page]
    },
    // route localization: page objects are replaced by one shallow copy per locale, then the
    // module strips its own meta and drops `page.meta` once nothing of its own is left
    (page: NuxtPage) => ['en', 'fr'].map((locale) => {
      const localized: NuxtPage = { ...page, path: `/${locale}`, meta: { ...page.meta, i18n: {} } }
      delete localized.meta!.i18n
      if (Object.keys(localized.meta!).length === 0) {
        delete localized.meta
      }
      return localized
    }),
  ])('should keep dynamic keys when a module rewrites pages (case %#)', async (rewritePages) => {
    const page: NuxtPage = { path: '/', file: filePath }
    await augmentFile([page], `<script setup>definePageMeta({ name: ref('some-custom-name'), layout: 'custom' })</script>`)

    expect(generate(rewritePages(page)).routes).toContain('?.name ?? undefined')
  })

  it('should not share dynamic keys between nuxt instances', async () => {
    const sfc = `<script setup>definePageMeta({ middleware: someRef })</script>`
    // `middleware` is an extraction key for one instance only, so the two disagree about the key
    const withExtraKeys = { options: { experimental: { normalizePageNames: false } } } as unknown as Nuxt
    const withoutExtraKeys = { options: { experimental: { normalizePageNames: false } } } as unknown as Nuxt

    const augment = async (nuxt: Nuxt, extraExtractionKeys: Set<string>) => {
      const page: NuxtPage = { path: '/', file: filePath }
      await augmentPages([page], { [filePath]: sfc }, { nuxt, extraExtractionKeys, fullyResolvedPaths: new Set([filePath]) })
      return page
    }

    const page = await augment(withExtraKeys, new Set(['middleware']))
    expect(getDynamicPageMeta(page, dynamicPageMetaCache(withExtraKeys))).toEqual(dynamic('meta'))
    expect(getDynamicPageMeta(page, dynamicPageMetaCache(withoutExtraKeys))).toEqual(dynamic())

    // the same file, extracted by an instance that does not treat `middleware` as an extra key,
    // marks the route field itself rather than the whole meta object
    await augment(withoutExtraKeys, new Set())
    expect(getDynamicPageMeta(page, dynamicPageMetaCache(withoutExtraKeys))).toEqual(dynamic('middleware'))
    expect(getDynamicPageMeta(page, dynamicPageMetaCache(withExtraKeys))).toEqual(dynamic('meta'))

    const routesFor = (nuxt: Nuxt) => {
      vi.mocked(useNuxt).mockReturnValueOnce(nuxt)
      return generate([page]).routes
    }

    // the instance that extracted the file defers `meta` to the macro module; the other one has
    // no record of the page and would drop it
    expect(routesFor(withExtraKeys)).toContain('meta:')
    expect(routesFor(withoutExtraKeys)).not.toContain('meta:')
  })

  it('should produce valid route objects when used without extracted meta', () => {
    const page: NuxtPage = { path: '/', file: filePath, meta: { layout: 'test', foo: 'bar' } }

    expect(generate([page], false)).toMatchInlineSnapshot(`
      {
        "imports": Set {
          "import { default as indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta } from "/app/pages/index.vue?macro=true";",
        },
        "routes": "[
        {
          name: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.name ?? undefined,
          path: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.path ?? "/",
          props: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.props ?? false,
          meta: { ...(indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta || {}), ...{"layout":"test","foo":"bar"} },
          alias: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.alias || [],
          redirect: indexcpcWNSbn9wmmk6rj_vIV3Lfs0pLXdg5oPT5xBB9CGloMeta?.redirect,
          component: () => import("/app/pages/index.vue")
        }
      ]",
      }
    `)
  })
})

describe('rewrite page meta', () => {
  const transformPlugin = createMacroPlugin({ extractedKeys: ['extracted'], pageMetaRuntime: '#page-meta' })
  const transform = (sfc: string) => transformSFC(sfc, transformPlugin)

  it('should throw when multiple definePageMeta', () => {
    expect(() => transform(setup(`definePageMeta({ name: 'hi' })\ndefinePageMeta({ layout: 'hi' })`))).toThrowErrorMatchingInlineSnapshot(`[NUXT_B4003: \`definePageMeta()\` is called 2 times in \`component.vue\`, but only one call is allowed.]`)
  })

  it('should throw for await expressions', () => {
    expect(() => transform(setup(`const asyncValue = await Promise.resolve('test')\ndefinePageMeta({ key: asyncValue })`))).toThrow('`await` expression is used in a variable referenced by `definePageMeta`')
  })

  it('should extract metadata from vue components', () => {
    expect(transform(setup(`definePageMeta({
  name: 'hi',
  other: 'value'
})`))).toMatchInlineSnapshot(`
      "const __nuxt_page_meta = {
        name: 'hi',
        other: 'value'
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should extract local functions', () => {
    expect(transform(setup(`
function isNumber(value) {
  return value && !isNaN(Number(value))
}

function validateIdParam (route) {
  return isNumber(route.params.id)
}

definePageMeta({
  validate: validateIdParam,
  test: () => 'hello',
})`))).toMatchInlineSnapshot(`
      "function isNumber(value) {
        return value && !isNaN(Number(value))
      }
      function validateIdParam (route) {
        return isNumber(route.params.id)
      }
      const __nuxt_page_meta = {
        validate: validateIdParam,
        test: () => 'hello',
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should extract user imports', () => {
    expect(transform(setup(`
import { validateIdParam } from './utils.ts'

definePageMeta({
  validate: validateIdParam,
  dynamic: ref(true),
})`))).toMatchInlineSnapshot(`
      "import { validateIdParam } from './utils.ts'
      import { createPageMetaError as __nuxt_createPageMetaError } from "#page-meta"
      let __nuxt_page_meta
      try {
      __nuxt_page_meta = {
        validate: validateIdParam,
        dynamic: ref(true),
      }
      } catch (error) {
      __nuxt_page_meta = __nuxt_createPageMetaError(error)
      }
      export default __nuxt_page_meta"
    `)
  })

  it.each([
    ['in the same scope', `
  middleware: () => {
    const useState = (key) => ({ value: { isLoggedIn: false } })
    const auth = useState('auth')
    return auth.value.isLoggedIn
  },`],
    ['in a parent scope', `
  middleware: () => {
    function isLoggedIn() {
      const auth = useState('auth')
      return auth.value.isLoggedIn
    }

    const useState = (key) => ({ value: { isLoggedIn: false } })
    return isLoggedIn()
  },`],
  ])('should not import static identifiers when shadowed %s', (_, meta) => {
    const code = transform(setup(`import { useState } from '#app/composables/state'\ndefinePageMeta({${meta}\n})`))
    expect(code).not.toContain('import')
    expect(code).toContain(`const __nuxt_page_meta = {${meta}`)
  })

  it.each([
    ['in different functions', `
  middleware: [
    () => {
      const useState = (key) => ({ value: { isLoggedIn: false } })
      return useState('auth')
    },
    () => useState('auth'),
  ]`],
    ['in the same scope', `
  middleware: () => {
    const auth1 = useState('auth')
    const useState = (key) => ({ value: { isLoggedIn: false } })
    const auth2 = useState('auth')
    return auth1.value.isLoggedIn || auth2.value.isLoggedIn
  },`],
  ])('should import static identifiers when a shadowed and a non-shadowed one are used %s', (_, meta) => {
    const code = transform(setup(`import { useState } from '#app/composables/state'\ndefinePageMeta({${meta}\n})`))
    expect(code).toContain(`import { useState } from '#app/composables/state'`)
    expect(code).toContain(`const __nuxt_page_meta = {${meta}`)
  })

  it('should work when keeping names = true', () => {
    expect(transform(setup(`
import { foo } from './utils.ts'

const checkNum = (value) => {
  return !isNaN(Number(foo(value)))
}

function isNumber (value) {
  return value && checkNum(value)
}

definePageMeta({
  validate: ({ params }) => {
    return isNumber(params.id)
  },
})`))).toMatchInlineSnapshot(`
      "import { foo } from './utils.ts'
      const checkNum = (value) => {
        return !isNaN(Number(foo(value)))
      }
      function isNumber (value) {
        return value && checkNum(value)
      }
      const __nuxt_page_meta = {
        validate: ({ params }) => {
          return isNumber(params.id)
        },
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should only add definitions for reference identifiers', () => {
    expect(transform(setup(`
const foo = 'foo'
const bar = { bar: 'bar' }.bar, baz = { baz: 'baz' }.baz, x = { foo }
const test = 'test'
const prop = 'prop'
const num = 1

const val = 'val'

const useVal = () => ({ val: 'val' })

function recursive () {
  recursive()
}

const route = useRoute()

definePageMeta({
  middleware: [
    () => {
      console.log(bar, baz)
      recursive()

      const val = useVal().val
      const obj = {
        num,
        prop: 'prop',
      }

      const c = class test {
        prop = 'prop'
        test () {}
      }

      const someFunction = () => {
        const someValue = 'someValue'
        console.log(someValue)
      }

      console.log(hoisted.value, val)
    },
  ],
  validate: (route) => {
    return route.params.id === 'test'
  }
})

// the order of a ref relative to the 'definePageMeta' call should be preserved (in contrast to a simple const)
// this tests whether the extraction handles all variables in the upper scope
const hoisted = ref('hoisted')
`))).toMatchInlineSnapshot(`
      "import { createPageMetaError as __nuxt_createPageMetaError } from "#page-meta"
      let __nuxt_page_meta
      try {
      const foo = 'foo'
      const num = 1
      const bar = { bar: 'bar' }.bar, baz = { baz: 'baz' }.baz, x = { foo }
      const useVal = () => ({ val: 'val' })
      function recursive () {
        recursive()
      }
      const hoisted = ref('hoisted')
      __nuxt_page_meta = {
        middleware: [
          () => {
            console.log(bar, baz)
            recursive()

            const val = useVal().val
            const obj = {
              num,
              prop: 'prop',
            }

            const c = class test {
              prop = 'prop'
              test () {}
            }

            const someFunction = () => {
              const someValue = 'someValue'
              console.log(someValue)
            }

            console.log(hoisted.value, val)
          },
        ],
        validate: (route) => {
          return route.params.id === 'test'
        }
      }
      } catch (error) {
      __nuxt_page_meta = __nuxt_createPageMetaError(error)
      }
      export default __nuxt_page_meta"
    `)
  })

  it.each([
    ['destructured bindings inside `definePageMeta`', `
const params = useShadowedParams()
const query = useShadowedQuery()

definePageMeta({
  validate: ({ params }) => params.id === 'test',
  middleware: [(to) => {
    const { query } = to
    return query.foo === 'bar'
  }],
})`, []],
    ['params and locals of functions in hoisted initializers', `
import { sep } from './utils'

const spacer = useShadowedSpacer()
const t = useShadowedT()

const helper = ({ sep }, spacer) => sep + spacer
const title = (() => { const t = 'hello'; return t })()

definePageMeta({
  validate: () => helper({ sep: 'x' }, '-') === title,
})`, ['const helper = ({ sep }, spacer) => sep + spacer', `const title = (() => { const t = 'hello'; return t })()`]],
    ['statement labels', `
const outer = useShadowedOuter()

definePageMeta({
  middleware: () => {
    outer: for (const x of [1]) { break outer }
  },
})`, []],
  ])('should not hoist declarations shadowed by %s', (_, script, hoisted) => {
    const code = transform(setup(script))!
    expect(code).not.toMatch(/useShadowed|import \{ sep \}/)
    for (const declaration of hoisted) {
      expect(code).toContain(declaration)
    }
  })

  it('should hoist identifiers referenced as computed members and computed keys', () => {
    expect(transform(setup(`
const idx = 2
const arr = [1, 2, 3]
const key = 'foo'

definePageMeta({
  middleware: () => ({ [key]: arr[idx] }),
})`))).toMatchInlineSnapshot(`
      "const idx = 2
      const key = 'foo'
      const arr = [1, 2, 3]
      const __nuxt_page_meta = {
        middleware: () => ({ [key]: arr[idx] }),
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should not add imports or declarations for type-only references', () => {
    expect(transform(setup(`
import { validators } from './utils'
import type { RouteThing } from './types'

const helper = (route: RouteThing) => validators.isNumber(route.params.id)

definePageMeta({
  validate: (route: RouteThing) => helper(route),
})`))).toMatchInlineSnapshot(`
      "import { validators } from './utils'
      const helper = (route: RouteThing) => validators.isNumber(route.params.id)
      const __nuxt_page_meta = {
        validate: (route: RouteThing) => helper(route),
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should transform layout written in object syntax', () => {
    expect(transform(setup(`
definePageMeta({
  layout: {
    name: 'foo',
    props: {
      bar: 'bar',
    },
  },
})`))).toMatchInlineSnapshot(`
      "const __nuxt_page_meta = {
        layout: 'foo',
      layoutProps: {
            bar: 'bar',
          },

      }
      export default __nuxt_page_meta"
    `)
  })

  describe('setup-only values', () => {
    const toDataURL = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`
    const evaluatingPlugin = createMacroPlugin({
      pageMetaRuntime: toDataURL('export const createPageMetaError = error => ({ error: String(error) })'),
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should warn when a key reads a destructured prop', () => {
      const b4024 = vi.spyOn(pageDiagnostics, 'NUXT_B4024').mockReturnValue(undefined as never)
      transform(setup(`const { foo } = defineProps<{ foo: string }>()\ndefinePageMeta({ title: foo, name: 'page' })`))
      expect(b4024).toHaveBeenCalledTimes(1)
      expect(b4024).toHaveBeenCalledWith({ key: 'title', sources: [expect.stringContaining('component.vue')] })
    })

    it('should not report a computed key by the name of its variable', () => {
      const b4024 = vi.spyOn(pageDiagnostics, 'NUXT_B4024').mockReturnValue(undefined as never)
      transform(setup(`const { foo } = defineProps<{ foo: string }>()\nconst key = 'title'\ndefinePageMeta({ [key]: foo })`))
      expect(b4024).toHaveBeenCalledWith({ key: '[computed]', sources: [expect.stringContaining('component.vue')] })
    })

    it('should guard evaluation of hoisted setup values', () => {
      expect(transform(setup(`const route = useRoute()\ndefinePageMeta({ key: route.path, name: 'page' })`))).toMatchInlineSnapshot(`
        "import { createPageMetaError as __nuxt_createPageMetaError } from "#page-meta"
        let __nuxt_page_meta
        try {
        const route = useRoute()
        __nuxt_page_meta = { key: route.path, name: 'page' }
        } catch (error) {
        __nuxt_page_meta = __nuxt_createPageMetaError(error)
        }
        export default __nuxt_page_meta"
      `)
    })

    it.each([
      ['a destructured prop', `const { foo } = defineProps<{ foo: string }>()\ndefinePageMeta({ title: foo })`, '__props is not defined'],
      ['a composable result', `const route = useRoute()\ndefinePageMeta({ key: route.path })`, 'useRoute is not defined'],
      ['a composable result in a callback', `const route = useRoute()\ndefinePageMeta({ validate: () => !!route.query.ok })`, 'useRoute is not defined'],
      ['the current instance', `const instance = getCurrentInstance()\ndefinePageMeta({ title: instance.props.title })`, 'getCurrentInstance is not defined'],
    ])('should not throw when page metadata reads %s', async (_, script, message) => {
      vi.spyOn(pageDiagnostics, 'NUXT_B4024').mockReturnValue(undefined as never)
      const { default: meta } = await import(/* @vite-ignore */ toDataURL(transformSFC(setup(script), evaluatingPlugin)!))
      expect(meta).toEqual({ error: expect.stringContaining(message) })
    })

    it.each([
      ['static values', `definePageMeta({ layout: 'custom', middleware: ['auth'] })`],
      ['inline functions', `definePageMeta({ middleware: [to => to.query.ok ? undefined : navigateTo('/')] })`],
      ['hoisted literals and functions', `const title = 'hello'\nfunction validate () { return true }\ndefinePageMeta({ title, validate })`],
    ])('should not guard evaluation of %s', (_, script) => {
      expect(transform(setup(script))).not.toContain('__nuxt_createPageMetaError')
    })

    it.each([
      ['a member of an import', `import { config } from './config'\nconst layout = config.layout\ndefinePageMeta({ layout })`, 'const layout = config.layout'],
      ['a route middleware', `const auth = defineNuxtRouteMiddleware(() => {})\ndefinePageMeta({ middleware: [auth] })`, 'const auth = defineNuxtRouteMiddleware(() => {})'],
      ['an imported helper call', `import { make } from './utils'\nconst title = make('x')\ndefinePageMeta({ title })`, `const title = make('x')`],
      ['a concatenation', `const suffix = 'x'\nconst title = 'a' + suffix\ndefinePageMeta({ title })`, `const title = 'a' + suffix`],
      ['an `import.meta.dev` ternary', `const title = import.meta.dev ? 'a' : 'b'\ndefinePageMeta({ title })`, `const title = (globalThis.__TEST_DEV__ ?? false) ? 'a' : 'b'`],
      ['a `let` declaration', `let title = 'x'\ndefinePageMeta({ title })`, `let title = 'x'`],
    ])('should hoist %s', (_, script, declaration) => {
      const b4024 = vi.spyOn(pageDiagnostics, 'NUXT_B4024').mockReturnValue(undefined as never)
      expect(transform(setup(script))).toContain(declaration)
      expect(b4024).not.toHaveBeenCalled()
    })
  })

  it.each([
    ['when it is the last key, with a trailing comma and an inline closing brace', `definePageMeta({\n  foo :'foo',\n  extracted: 'value', })`],
    ['when it is the first key and another key follows on the same line', `definePageMeta({\n  extracted: 'value',foo :'foo'})`],
    ['when it is the only key, with a trailing comma', `definePageMeta({\n  extracted: 'value',\n})`],
    ['when it is the only key, without a trailing comma', `definePageMeta({\n  extracted: 'value'\n})`],
  ])('should strip extracted metadata from the script block %s', (_, script) => {
    const result = transform(`<script setup>\n${script}\n</script>`)
    expect.soft(result).not.contain('extracted')
    if (script.includes('foo')) {
      expect.soft(result).contain('foo')
    }
    expect(() => toAst(result!, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow()
  })

  interface AgreementCase {
    extracted: Record<string, any>
    contains?: string[]
    excludes?: string[]
    extraKeys?: string[]
  }

  function expectAgreement (script: string, { extracted, contains = [], excludes = [], extraKeys = [] }: AgreementCase, extractSerializable = false) {
    const sfc = setup(script)
    const macro = transformSFC(sfc, createMacroPlugin({ extractedKeys: [...defaultExtractionKeys, ...extraKeys], extractSerializable }))
    for (const text of contains) {
      expect(macro).toContain(text)
    }
    for (const text of excludes) {
      expect(macro).not.toContain(text)
    }
    expect(getRouteMeta(sfc, uniquePath(), new Set(extraKeys), { extractSerializable })).toEqual(extracted)
  }

  it.each<[string, string, AgreementCase]>([
    ['keep a computed key whose name collides with an extracted key', `const name = 'title'\ndefinePageMeta({ [name]: 'some-title' })`, { extracted: { dynamic: dynamic('meta') }, contains: [`[name]: 'some-title'`] }],
    ['reshape an object layout even when `layout` is an extraction key', `definePageMeta({ layout: { name: 'admin', props: { collapsed: true } } })`, { extracted: { dynamic: dynamic('meta') }, contains: [`layout: 'admin'`, 'layoutProps: { collapsed: true }'], extraKeys: ['layout'] }],
    ['strip a quoted key that is extracted into the route record', `definePageMeta({ 'name': 'quoted-name' })`, { extracted: { name: 'quoted-name' }, excludes: ['quoted-name'] }],
    ['extract from a call the transform also strips, whatever its position', `void definePageMeta({ name: 'voided-name' })`, { extracted: { name: 'voided-name' }, excludes: ['voided-name'] }],
    ['keep the macro module when the argument is not an object literal', `const meta = { name: 'from-variable', title: 'hello' }\ndefinePageMeta(meta)`, { extracted: { dynamic: dynamic('meta') }, contains: ['const __nuxt_page_meta = meta'] }],
    ['keep an object layout with sub-properties that cannot be reshaped', `const shared = { name: 'admin' }\ndefinePageMeta({ layout: { ...shared, props: { collapsed: true } } })`, { extracted: { dynamic: dynamic('meta') }, contains: ['...shared'], excludes: ['layoutProps'] }],
    ['extract the last occurrence of a duplicate key', `definePageMeta({ name: 'first', name: 'last' })`, { extracted: { name: 'last' }, excludes: ['first', 'last'] }],
    ['keep a getter whose name collides with an extracted key', `definePageMeta({ get name () { return 'from-getter' } })`, { extracted: { dynamic: dynamic('meta') }, contains: ['from-getter'] }],
  ])('macro module and extracted route meta should agree: %s', (_, script, expected) => {
    expectAgreement(script, expected)
  })

  describe('extractSerializablePageMeta', () => {
    const options = { extractSerializable: true }

    it.each<[string, string, AgreementCase]>([
      ['extract an unlisted serializable key into route meta', `definePageMeta({ title: 'hello', order: -2, tags: ['a', 'b'], nested: { deep: true } })`, { extracted: { meta: { title: 'hello', order: -2, tags: ['a', 'b'], nested: { deep: true } } }, contains: ['const __nuxt_page_meta = {'], excludes: ['hello'] }],
      ['fall back to the macro module for an unlisted key that is not serializable', `definePageMeta({ title: 'hello', validate: () => true })`, { extracted: { meta: { title: 'hello' }, dynamic: dynamic('meta') }, contains: ['validate'] }],
      ['still mark a listed key as dynamic rather than runtime', `definePageMeta({ path: ref('/dynamic') })`, { extracted: { dynamic: dynamic('path') }, contains: [`ref('/dynamic')`] }],
      ['keep the last occurrence of a duplicate unlisted key', `definePageMeta({ title: 'first', title: 'last' })`, { extracted: { meta: { title: 'last' } }, excludes: ['first', 'last'] }],
      ['extract a string layout', `definePageMeta({ layout: 'dark' })`, { extracted: { meta: { layout: 'dark' } }, excludes: ['dark'] }],
      ['extract `layout: false`', `definePageMeta({ layout: false })`, { extracted: { meta: { layout: false } }, excludes: ['layout'] }],
      ['split `{ name }` into `layout`', `definePageMeta({ layout: { name: 'admin' } })`, { extracted: { meta: { layout: 'admin' } }, excludes: ['admin', 'layoutProps'] }],
      ['split `{ name, props }` into `layout` and `layoutProps`', `definePageMeta({ layout: { name: 'admin', props: { collapsed: true } } })`, { extracted: { meta: { layout: 'admin', layoutProps: { collapsed: true } } }, excludes: ['admin', 'collapsed'] }],
      ['unwrap a statically wrapped layout object', `definePageMeta({ layout: { name: 'admin', props: { collapsed: true } } as const })`, { extracted: { meta: { layout: 'admin', layoutProps: { collapsed: true } } }, excludes: ['admin'] }],
      ['leave `{ props }` without a name to the macro module', `definePageMeta({ layout: { props: { collapsed: true } } })`, { extracted: { dynamic: dynamic('meta') }, contains: ['layoutProps: { collapsed: true }'], excludes: ['layout:'] }],
      ['leave an empty layout object to the macro module', `definePageMeta({ layout: {} })`, { extracted: { dynamic: dynamic('meta') } }],
      ['leave a non-serializable layout name to the macro module', `const layoutName = 'admin'\ndefinePageMeta({ layout: { name: layoutName } })`, { extracted: { dynamic: dynamic('meta') }, contains: ['layout: layoutName'] }],
      ['leave non-serializable layout props to the macro module', `definePageMeta({ layout: { name: 'admin', props: { onClick: () => {} } } })`, { extracted: { dynamic: dynamic('meta') }, contains: [`layout: 'admin'`, 'layoutProps: { onClick: () => {} }'] }],
      ['leave a spread layout object to the macro module', `const shared = { name: 'admin' }\ndefinePageMeta({ layout: { ...shared } })`, { extracted: { dynamic: dynamic('meta') }, contains: ['...shared'] }],
      ['leave a layout object with unknown keys to the macro module', `definePageMeta({ layout: { name: 'admin', other: 1 } })`, { extracted: { dynamic: dynamic('meta') }, contains: ['other: 1'] }],
      ['keep the last occurrence when a string layout follows an object layout', `definePageMeta({ layout: { name: 'admin', props: { collapsed: true } }, layout: 'dark' })`, { extracted: { meta: { layout: 'dark' } }, excludes: ['admin', 'dark'] }],
      ['reshape into meta when `layout` is also an extraction key', `definePageMeta({ layout: { name: 'admin', props: { collapsed: true } } })`, { extracted: { meta: { layout: 'admin', layoutProps: { collapsed: true } } }, excludes: ['admin'], extraKeys: ['layout'] }],
    ])('should %s', (_, script, expected) => {
      expectAgreement(script, expected, true)
    })

    it('should keep all metadata in the macro module for files the scanner cannot parse', () => {
      const code = `
import { definePageMeta } from '#app/composables/pages'
export const meta = { redirect: '/about' }
const _sfc_main = {
  setup() {
    definePageMeta({ redirect: '/about', layout: 'dark' })
    return () => null
  }
}
export default _sfc_main
      `
      expect(getRouteMeta(code, '/app/pages/redirect.md', new Set(), options)).toEqual({
        dynamic: dynamic(...defaultExtractionKeys, 'meta'),
      })
      const macro = createMacroPlugin({ extractedKeys: [...defaultExtractionKeys], extractSerializable: true }).transform.handler(code, '/app/pages/redirect.md?macro=true')?.code
      expect(macro).toContain(`redirect: '/about'`)
      expect(macro).toContain(`layout: 'dark'`)
    })

    it('should key the extraction cache on the flag', () => {
      const sfc = setup(`definePageMeta({ title: 'hello' })`)
      const path = '/app/pages/cache-key.vue'
      expect(getRouteMeta(sfc, path, new Set(), options)).toEqual({ meta: { title: 'hello' } })
      expect(getRouteMeta(sfc, path)).toEqual({ dynamic: dynamic('meta') })
    })

    it('should invalidate both extraction modes when contents change', () => {
      const path = '/app/pages/cache-invalidation.vue'
      getRouteMeta(setup(`definePageMeta({ title: 'hello' })`), path, new Set(), options)
      getRouteMeta(setup(`definePageMeta({ title: 'hello' })`), path)

      const updated = setup(`definePageMeta({ title: 'goodbye' })`)
      expect(getRouteMeta(updated, path, new Set(), options)).toEqual({ meta: { title: 'goodbye' } })
      expect(getRouteMeta(updated, path)).toEqual({ dynamic: dynamic('meta') })
    })

    it('should not import the macro module when every key is serializable', async () => {
      const page: NuxtPage = { path: '/', file: filePath }
      await augmentFile([page], setup(`definePageMeta({
  name: 'some-custom-name',
  layout: { name: 'admin', props: { collapsed: true } },
  title: 'hello',
})`), { extractSerializable: true })

      const { routes, imports } = generate([page])
      expect(imports).toEqual(new Set())
      expect(routes).toMatchInlineSnapshot(`
        "[
          {
            name: "some-custom-name",
            path: "/",
            meta: {"layout":"admin","layoutProps":{"collapsed":true},"title":"hello"},
            component: () => import("/app/pages/index.vue")
          }
        ]"
      `)
    })
  })
})
