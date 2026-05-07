import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { withQuery } from 'ufo'
import { isWindows } from 'std-env'
import { normalize } from 'pathe'
import { $fetch, fetch, setup, startServer } from '@nuxt/test-utils/e2e'
import type { NuxtIslandResponse } from 'nuxt/app'

import { isDev, isWebpack } from './matrix'
import { renderPage } from './utils'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/server-components', import.meta.url)),
  dev: isDev,
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    hooks: {
      'modules:done' () {
        // TODO: investigate whether to upstream a fix to vite-plugin-vue or nuxt/test-utils
        // Vite reads its `isProduction` value from NODE_ENV and passes this to some plugins
        // like vite-plugin-vue
        if (!isDev) {
          process.env.NODE_ENV = 'production'
        }
      },
    },
  },
})

describe('server components/islands', () => {
  it('/islands', async () => {
    const { page } = await renderPage('/islands')
    const islandRequest = page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.locator('#increase-pure-component').click()
    await islandRequest

    await page.locator('#slot-in-server').getByText('Slot with in .server component').waitFor()
    await page.locator('#test-slot').getByText('Slot with name test').waitFor()

    // test fallback slot with v-for
    expect(await page.locator('.fallback-slot-content').all()).toHaveLength(2)
    // test islands update
    await page.locator('.box').getByText('"number": 101,').first().waitFor()
    const requests = [
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200),
    ]
    await page.locator('#update-server-components').click()
    await Promise.all(requests)

    await page.locator('#async-server-component-count').getByText('1').waitFor()
    await page.locator('#long-async-component-count').getByText('1').waitFor()

    // test islands slots interactivity
    await page.locator('#first-sugar-counter button').click()
    expect(await page.locator('#first-sugar-counter').innerHTML()).toContain('Sugar Counter 13')

    // test islands mounted client side with slot
    await page.locator('#show-island').click()
    expect(await page.locator('#island-mounted-client-side').innerHTML()).toContain('Interactive testing slot post SSR')
    expect(await page.locator('#island-mounted-client-side').innerHTML()).toContain('Sugar Counter')

    // test islands wrapped with client-only
    expect(await page.locator('#wrapped-client-only').innerHTML()).toContain('Was router enabled')

    if (!isWebpack) {
      // test nested client components
      await page.locator('.server-with-nested-client button').click()
      expect(await page.locator('.server-with-nested-client .sugar-counter').innerHTML()).toContain('Sugar Counter 13 x 1 = 13')
    }

    if (!isWebpack) {
      // test client component interactivity
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 12')
      await page.locator('.interactive-component-wrapper button').click()
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 13')
    }

    await page.close()
  })

  it('lazy server components', async () => {
    const { page, consoleLogs } = await renderPage('/server-components/lazy/start')

    await page.getByText('Go to page with lazy server component').click()

    const text = await page.innerText('pre')
    expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"> Loading server component </section><section id="no-fallback"><div></div></section><div></div>"')
    expect(text).not.toContain('async component that was very long')
    expect(text).toContain('Loading server component')

    // Wait for all pending micro ticks to be cleared
    // await page.waitForLoadState('networkidle')
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))
    await page.waitForFunction(() => (document.querySelector('#no-fallback') as HTMLElement)?.innerText?.includes('async component'))
    await page.waitForFunction(() => (document.querySelector('#fallback') as HTMLElement)?.innerText?.includes('async component'))

    // test navigating back and forth for lazy <ServerWithClient> component (should not trigger any issue)
    await page.goBack({ waitUntil: 'networkidle' })
    await page.getByText('Go to page with lazy server component').click()
    await page.waitForLoadState('networkidle')

    expect(consoleLogs.filter(l => l.type === 'error')).toHaveLength(0)

    await page.close()
  })

  it('should not preload ComponentWithRef', async () => {
    // should not add <ComponentWithRef> to the modulepreload list since it is used only server side
    const { page } = await renderPage('/islands')
    const links = await page.locator('link').all()
    for (const link of links) {
      if (await link.getAttribute('rel') === 'modulepreload') {
        expect(await link.getAttribute('href')).not.toContain('ComponentWithRef')
      }
    }

    await page.close()
  })

  it('non-lazy server components', async () => {
    const { page } = await renderPage('/server-components/lazy/start')
    await page.waitForLoadState('networkidle')
    await page.getByText('Go to page without lazy server component').click()

    const text = (await page.innerText('pre')).replaceAll(/ data-island-uid="[^"]*"/g, '').replace(/data-island-component="[^"]*"/g, 'data-island-component')

    if (isWebpack) {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <div class="sugar-counter" nuxt-client=""> Sugar Counter 12 x 1 = 12 <button> Inc </button></div></div></div>"')
    } else {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--[--><div style="display: contents;" data-island-component></div><!--teleport start--><!--teleport end--><!--]--></div></div>"')
    }
    expect(text).toContain('async component that was very long')

    // Wait for all pending micro ticks to be cleared
    // await page.waitForLoadState('networkidle')
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))
    await page.waitForFunction(() => (document.querySelector('#no-fallback') as HTMLElement)?.innerText?.includes('async component'))
    await page.waitForFunction(() => (document.querySelector('#fallback') as HTMLElement)?.innerText?.includes('async component'))

    await page.close()
  })

  it('/server-page', async () => {
    const html = await $fetch<string>('/server-page')
    // test island head
    expect(html).toContain('<meta name="author" content="Nuxt">')
    expect(html).toContain('plugin-style')
    // #34482 - title should be composed with titleTemplate
    expect(html).toContain('<title>Server Page - Fixture</title>')
  })

  it('/server-page - should preserve title after hydration', async () => {
    const { page } = await renderPage('/server-page')
    await page.waitForLoadState('networkidle')
    expect(await page.title()).toBe('Server Page - Fixture')
    await page.close()
  })

  it('/server-page - client side navigation', async () => {
    const { page } = await renderPage('/')
    await page.getByText('to server page').click()
    await page.waitForLoadState('networkidle')

    expect(await page.innerHTML('head')).toContain('<meta name="author" content="Nuxt">')
    await page.close()
  })
})

describe('component islands', () => {
  it('renders components with route', async () => {
    const result = await $fetch<NuxtIslandResponse>('/__nuxt_island/RouteComponent.json?url=/foo')

    result.html = result.html.replace(/ data-island-uid="[^"]*"/g, '')
    if (isDev) {
      result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || (!l.href.includes('_nuxt/components/islands/RouteComponent') && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */))
    }

    result.head.link ||= []
    result.head.style ||= []

    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<pre data-island-uid>    Route: /foo
        </pre>",
      }
    `)
  })

  it('render async component', async () => {
    const result = await $fetch<NuxtIslandResponse>(withQuery('/__nuxt_island/LongAsyncComponent.json', {
      props: JSON.stringify({
        count: 3,
      }),
    }))
    if (isDev) {
      result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || (!l.href.includes('_nuxt/components/islands/LongAsyncComponent') && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */))
    }

    result.head.link ||= []
    result.head.style ||= []
    result.html = result.html.replaceAll(/ (?:data-island-uid|data-island-component)="[^"]*"/g, '')
    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<div data-island-uid><div> count is above 2 </div><!--[--><div style="display: contents;" data-island-uid data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--> that was very long ... <div id="long-async-component-count">3</div>  <!--[--><div style="display: contents;" data-island-uid data-island-slot="test"><!--teleport start--><!--teleport end--></div><!--]--><p>hello world !!!</p><!--[--><div style="display: contents;" data-island-uid data-island-slot="hello"><!--teleport start--><!--teleport end--></div><!--teleport start--><!--teleport end--><!--]--><!--[--><div style="display: contents;" data-island-uid data-island-slot="fallback"><!--teleport start--><!--teleport end--></div><!--teleport start--><!--teleport end--><!--]--></div>",
        "slots": {
          "default": {
            "props": [],
          },
          "fallback": {
            "fallback": "<!--teleport start anchor--><!--[--><div style="display:contents;"><div>fall slot -- index: 0</div><div class="fallback-slot-content"> wonderful fallback </div></div><div style="display:contents;"><div>back slot -- index: 1</div><div class="fallback-slot-content"> wonderful fallback </div></div><!--]--><!--teleport anchor-->",
            "props": [
              {
                "t": "fall",
              },
              {
                "t": "back",
              },
            ],
          },
          "hello": {
            "fallback": "<!--teleport start anchor--><!--[--><div style="display:contents;"><div> fallback slot -- index: 0</div></div><div style="display:contents;"><div> fallback slot -- index: 1</div></div><div style="display:contents;"><div> fallback slot -- index: 2</div></div><!--]--><!--teleport anchor-->",
            "props": [
              {
                "t": 0,
              },
              {
                "t": 1,
              },
              {
                "t": 2,
              },
            ],
          },
          "test": {
            "props": [
              {
                "count": 3,
              },
            ],
          },
        },
      }
    `)
  })

  it('render .server async component', async () => {
    const result = await $fetch<NuxtIslandResponse>(withQuery('/__nuxt_island/AsyncServerComponent.json', {
      props: JSON.stringify({
        count: 2,
      }),
    }))
    if (isDev) {
      result.head.link = result.head.link?.filter(l => typeof l.href === 'string' && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */ && (!l.href.startsWith('_nuxt/components/islands/') || l.href.includes('AsyncServerComponent')))
    }

    result.head.link ||= []
    result.head.style ||= []
    result.props = {}
    result.components = {}
    result.slots = {}
    result.html = result.html.replaceAll(/ (?:data-island-uid|data-island-component)="[^"]*"/g, '')

    expect(result).toMatchInlineSnapshot(`
      {
        "components": {},
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<div data-island-uid> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">2</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-uid data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div>",
        "props": {},
        "slots": {},
      }
    `)
  })

  if (!isWebpack) {
    it('render server component with selective client hydration', async () => {
      const result = await $fetch<NuxtIslandResponse>('/__nuxt_island/ServerWithClient')
      if (isDev) {
        result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || (!l.href.includes('_nuxt/components/islands/LongAsyncComponent') && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */))

        if (!result.head.link) {
          delete result.head.link
        }
      }
      const { components } = result
      result.components = {}
      result.slots = {}
      result.html = result.html.replace(/data-island-component="[^"]*"/g, 'data-island-component')

      const teleportsEntries = Object.entries(components || {})

      result.head.link ||= []
      result.head.style ||= []

      expect(result).toMatchInlineSnapshot(`
        {
          "components": {},
          "head": {
            "link": [],
            "style": [],
          },
          "html": "<div data-island-uid> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--[--><div style="display: contents;" data-island-uid data-island-component></div><!--teleport start--><!--teleport end--><!--]--></div></div>",
          "slots": {},
        }
      `)
      expect(teleportsEntries).toHaveLength(1)
      expect(teleportsEntries[0]![1].props).toMatchInlineSnapshot(`
        {
          "multiplier": 1,
        }
      `)
      expect(teleportsEntries[0]![1].html).toMatchInlineSnapshot(`"<div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--teleport anchor-->"`)
    })
  }

  it('renders pure components', async () => {
    const result = await $fetch<NuxtIslandResponse>(withQuery('/__nuxt_island/PureComponent.json', {
      props: JSON.stringify({
        bool: false,
        number: 3487,
        str: 'something',
        obj: { foo: 42, bar: false, me: 'hi' },
      }),
    }))
    result.html = result.html.replace(/ data-island-uid="[^"]*"/g, '')

    if (isDev) {
      const fixtureDir = normalize(fileURLToPath(new URL('./fixtures/server-components', import.meta.url)))
      for (const key in result.head) {
        if (key === 'link') {
          result.head[key] = result.head[key]?.map((h) => {
            h.href &&= (h.href).replace(fixtureDir, '/<rootDir>').replaceAll('//', '/')
            return h
          })
        }
      }
    }

    if (!isDev) {
      expect(normaliseIslandResult(result).head).toMatchInlineSnapshot(`
        {
          "style": [
            {
              "innerHTML": "pre[data-v-xxxxx]{color:#00f}",
            },
          ],
        }
      `)
    } else {
      // TODO: resolve dev bug triggered by earlier fetch of /vueuse-head page
      // https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/runtime/nitro/handlers/renderer.ts#L139
      result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || !l.href.includes('SharedComponent'))
      if (result.head.link?.[0]?.href) {
        result.head.link[0].href = result.head.link[0].href.replace(/scoped=[^?&]+/, 'scoped=xxxxx')
      }

      expect(result.head).toMatchInlineSnapshot(`
        {
          "link": [
            {
              "crossorigin": "",
              "href": "/_nuxt/components/islands/PureComponent.vue?vue&type=style&index=0&scoped=xxxxx&lang.css",
              "rel": "stylesheet",
            },
          ],
        }
      `)
    }

    expect(result.html.replace(/data-v-\w+|"|<!--.*-->/g, '').replace(/data-island-uid="[^"]"/g, '')).toMatchInlineSnapshot(`
      "<div data-island-uid > Was router enabled: true <br > Props: <pre >{
        number: 3487,
        str: something,
        obj: {
          foo: 42,
          bar: false,
          me: hi
        },
        bool: false
      }</pre></div>"
    `)
  })

  it('test client-side navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('#islands')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/islands')

    await page.locator('#increase-pure-component').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)

    await page.locator('#slot-in-server').getByText('Slot with in .server component').waitFor()
    await page.locator('#test-slot').getByText('Slot with name test').waitFor()

    // test islands update
    expect(await page.locator('.box').first().innerHTML()).toContain('"number": 101,')
    const islandRequests = [
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200),
    ]
    await page.locator('#update-server-components').click()
    await Promise.all(islandRequests)

    await page.locator('#long-async-component-count').getByText('1').waitFor()

    // test islands slots interactivity
    await page.locator('#first-sugar-counter button').click()
    expect(await page.locator('#first-sugar-counter').innerHTML()).toContain('Sugar Counter 13')

    if (!isWebpack) {
      // test client component interactivity
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 12')
      await page.locator('.interactive-component-wrapper button').click()
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 13')
    }

    await page.close()
  })

  it.skipIf(isDev)('should not render an error when having a baseURL', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/foo/',
      },
    })

    const result = await fetch('/foo/islands')
    expect(result.status).toBe(200)

    await startServer()
  })

  it('render island page', async () => {
    const { page } = await renderPage('/')

    const islandPageRequest = page.waitForRequest((req) => {
      return req.url().includes('/__nuxt_island/page_server-page')
    })
    await page.getByText('to server page').click()
    await islandPageRequest
    await page.locator('#server-page').waitFor()
  })

  it('should show error on 404 error for server pages during client navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('[href="/server-components/lost-page"]')
    await page.getByText('This is the error page').waitFor()
  })
})

describe.skipIf(isDev || isWebpack)('regressions (expected failures)', () => {
  // https://github.com/nuxt/nuxt/issues/26527
  it.fails('renders <Counter nuxt-client /> when nested two levels deep in server components', async () => {
    const { page } = await renderPage('/nested-nuxt-client')

    await page.locator('.server-inner-counter .sugar-counter button').waitFor({ timeout: 5_000 })
    await page.locator('.universal-counter .sugar-counter button').waitFor({ timeout: 5_000 })

    await page.locator('.server-inner-counter .sugar-counter button').click()
    expect(await page.locator('.server-inner-counter .sugar-counter').innerText()).toContain('Sugar Counter 13')

    await page.close()
  })

  // https://github.com/nuxt/nuxt/issues/32251
  it.fails('does not produce hydration mismatches with selectiveClient: "deep" on slot-using components', async () => {
    const { page, consoleLogs } = await renderPage('/selective-client-slots')

    await page.locator('#slotted').waitFor()
    expect(consoleLogs.filter(l => l.type === 'error' && l.text.includes('Hydration'))).toEqual([])

    await page.close()
  })
})

function normaliseIslandResult (result: NuxtIslandResponse) {
  if (result.head.style) {
    for (const style of result.head.style) {
      if (typeof style !== 'string') {
        style.innerHTML &&=
          (style.innerHTML as string)
            .replace(/data-v-[a-z0-9]+/g, 'data-v-xxxxx')
          // Vite 6 enables CSS minify by default for SSR
            .replace(/blue/, '#00f')
        style.key &&= style.key.replace(/-[a-z0-9]+$/i, '')
      }
    }
  }
  return result
}
