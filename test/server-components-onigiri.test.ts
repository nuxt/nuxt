import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { withQuery } from 'ufo'
import { isWindows } from 'std-env'
import { normalize } from 'pathe'
import { $fetch, fetch, setup, startServer } from '@nuxt/test-utils/e2e'
import type { DefineComponent } from 'vue'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { renderOnigiri } from 'vue-onigiri/runtime/deserialize'
import type { OnigiriPayload } from 'vue-onigiri/runtime/shared'
import type { NuxtIslandResponse } from 'nuxt/app'
import { getIslandHash, serializeIslandProps } from '../packages/nuxt/src/app/island-hash'
import { MAX_ISLAND_BODY_BYTES } from '../packages/nitro-server/src/runtime/utils/island-props'
 
import { isDev, isWebpack,   } from './matrix'
import { renderPage } from './utils'

const shouldRun = !isWebpack

function islandURL (name: string, opts: { props?: Record<string, any>, context?: Record<string, any> } = {}) {
  const serializedProps = serializeIslandProps(opts.props)
  const ctx = opts.context ?? {}
  const hashId = getIslandHash({ name, props: serializedProps, context: ctx })
  const query: Record<string, any> = { ...ctx }
  if (opts.props) { query.props = serializedProps }
  return withQuery(`/__nuxt_island/${name}_${hashId}.json`, query)
}
if(shouldRun) {
await setup({
  rootDir: fileURLToPath(new URL('./fixtures/vue-onigiri', import.meta.url)),
  dev: isDev,
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
})
}

describe.runIf(shouldRun)('server components/islands', () => {
  it('/islands', async () => {
    const { page } = await renderPage('/islands')
    const islandRequest = page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.locator('#increase-pure-component').click()
    await islandRequest

    // TODO: consumer slot content is dropped under onigiri (deferred: slot marker design)
    expect(await page.locator('#slot-in-server').count()).toBe(0)
    expect(await page.locator('#test-slot').count()).toBe(0)

    // the island's own unfilled-slot fallbacks render inline
    expect(await page.locator('.fallback-slot-content').all()).toHaveLength(2)
    await page.locator('.box').getByText('Sugar Counter 12 x 101').first().waitFor()
    const requests = [
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200),
    ]
    await page.locator('#update-server-components').click()
    await Promise.all(requests)

    await page.locator('#async-server-component-count').getByText('1').waitFor()
    await page.locator('#long-async-component-count').getByText('1').waitFor()

    // test islands mounted client side (passed slot content is dropped)
    await page.locator('#show-island').click()
    await page.locator('#island-mounted-client-side').getByText('hello world !!!').waitFor()
    expect(await page.locator('#island-mounted-client-side').innerHTML()).not.toContain('Interactive testing slot post SSR')

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

    // the `#fallback` slot is consumer content, so pending lazy islands render placeholders
    const text = await page.innerText('pre')
    expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><!----></section><section id="no-fallback"><!----></section><!---->"')
    expect(text).not.toContain('async component that was very long')

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
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <div class="sugar-counter" v-load-client=""> Sugar Counter 12 x 1 = 12 <button> Inc </button></div></div></div>"')
    } else {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!----></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!----></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><div>a</div><div>b</div><div>c</div></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border: 1px solid red;"> The component below is not a slot but declared as interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div></div></div>"')
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
    expect(html).toContain('data-internal')

    const clientPageHtml = await $fetch<string>('/')
    expect(clientPageHtml).not.toContain('data-internal')
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

  it('/server-page - links inside islands use client-side navigation', async () => {
    const { page } = await renderPage('/server-page')
    await page.evaluate(() => { (window as any).__islandNavMarker = true })

    await page.click('#island-link-server-page')
    await page.locator('#server-page-with-nuxtpage').waitFor()
    expect(page.url()).toContain('/server-page-with-nuxtpage')
    expect(await page.evaluate(() => (window as any).__islandNavMarker)).toBe(true)

    await page.goBack()
    await page.locator('#island-link-home').waitFor()
    await page.click('#island-link-home')
    await page.locator('#islands').waitFor()
    expect(await page.evaluate(() => (window as any).__islandNavMarker)).toBe(true)

    await page.close()
  })

  it('/server-page - island links are prefetched when visible', async () => {
    const { page } = await renderPage('/server-page')
    await page.waitForFunction(() => (window as any).__prefetchedLinks?.includes('/server-page-with-nuxtpage'))
    await page.close()
  })

  it('/server-page - island links with `replace` do not add a history entry', async () => {
    const { page } = await renderPage('/')
    await page.getByText('to server page').click()
    await page.locator('#island-link-replace').waitFor()
    await page.click('#island-link-replace')
    await page.locator('#server-page-with-nuxtpage').waitFor()

    await page.goBack()
    await page.locator('#islands').waitFor()
    expect(page.url().endsWith('/')).toBe(true)

    await page.close()
  })

  // Unlike the legacy renderer (which re-reads the island's SSR DOM at hydration), the
  // serialized AST in the payload is onigiri's hydration source, so the island body
  // legitimately appears twice in the initial response: once rendered, once as data.
  it('/server-page - ships the island body once in the markup and once in the payload', async () => {
    const html = await $fetch<string>('/server-page')
    const [markup = '', payload = ''] = html.split(/<script[^>]*id="__NUXT_DATA__"[^>]*>/)
    expect(markup.match(/Hello this is a server page/g)).toHaveLength(1)
    expect(payload.match(/Hello this is a server page/g)).toHaveLength(1)
  })

  it('/server-page - island response is prefetched by NuxtLink', async () => {
    const { page, requests } = await renderPage('/')
    await page.waitForLoadState('networkidle')

    const isServerPageIsland = (req: string) => /^\/__nuxt_island\/page_server-page_/.test(req)

    expect(requests.some(isServerPageIsland)).toBe(true)
    requests.length = 0

    await page.getByText('to server page').click()
    await page.waitForFunction(() => !!document.head.querySelector('meta[name="author"][content="Nuxt"]'))

    expect(requests.some(isServerPageIsland)).toBe(false)
    await page.close()
  })

  it('/server-page-with-nuxtpage/child renders the parent server page with the child route', async () => {
    const html = await $fetch<string>('/server-page-with-nuxtpage/child')
    expect(html).toContain('id="server-page-with-nuxtpage"')
    expect(html).toContain('id="server-page-with-nuxtpage-child"')
    expect(html).toContain('Child body')
  })

  it('/server-page-with-nuxtpage renders the parent without recursing into itself', async () => {
    const html = await $fetch<string>('/server-page-with-nuxtpage')
    expect(html).toContain('id="server-page-with-nuxtpage"')
    expect(html).toContain('Parent body')
  })

  // https://github.com/nuxt/nuxt/issues/31510
  // TODO: restore the scoped-style assertions once island slots render again — the
  // serializer will also need to carry `vnode.scopeId` for scoped styles to match
  it.skipIf(isWebpack)('does not render consumer slot content in server components', async () => {
    const { page } = await renderPage('/slotted-styles')

    try {
      expect(await page.locator('#slotted-style-in-server').count()).toBe(0)
    } finally {
      await page.close()
    }
  })
})

describe.runif(shouldrun)('component islands', () => {
  it('renders components with route', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('RouteComponent', { context: { url: '/foo' } }))

    expect(result.html).toBeUndefined()
    const html = await renderIslandAst(result.ast)
    expect(html).toContain('Route: /foo')
  })

  it('render async component', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('LongAsyncComponent', { props: { count: 3 } }))

    const html = await renderIslandAst(result.ast)
    expect(html).toContain('count is above 2')
    expect(html).toContain('that was very long')
    expect(html).toMatch(/id="long-async-component-count">\s*3\s*</)
    expect(html).toContain('<p>hello world !!!</p>')
    // caller slot content does not travel over the island protocol, so the
    // unfilled named slots serialize their fallback content inline
    expect(html).toContain('fallback slot -- index: 0')
    expect(html).toContain('fallback slot -- index: 2')
    expect(html).toMatch(/fall slot -- index: 0/)
    expect(html).toMatch(/back slot -- index: 1/)
    expect(html).toContain('wonderful fallback')
  })

  it('render .server async component', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('AsyncServerComponent', { props: { count: 2 } }))

    const html = await renderIslandAst(result.ast)
    expect(html).toContain('This is a .server (20ms) async component')
    expect(html).toContain('that was very long')
    expect(html).toMatch(/id="async-server-component-count">\s*2\s*</)
    // the non-interactive <Counter> is serialized inline, not as a client reference
    expect(html).toContain('Sugar Counter 12 x 1 = 12')
    expect(html).not.toContain('data-client-stub')
  })

  if (!isWebpack) {
    it('render server component with selective client hydration', async () => {
      const result = await $fetch<NuxtIslandResponse>(islandURL('ServerWithClient'))

      const html = await renderIslandAst(result.ast)
      expect(html).toContain('ServerWithClient.server.vue')
      expect(html).toContain('<p>count: 0</p>')
      expect(html).toContain('This component should not be preloaded')
      // the non-interactive <Counter> is serialized inline...
      expect(html).toContain('Sugar Counter 12 x 1 = 12')
      // ...while the `v-load-client` one ships as a component reference the
      // client resolves, replacing the legacy `components` teleport channel
      expect(html).toMatch(/class="interactive-component-wrapper"[\s\S]*data-client-stub="[^"]*Counter[^"]*"/)
    })
  }

  it('renders pure components', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('PureComponent', {
      props: {
        bool: false,
        number: 3487,
        str: 'something',
        obj: { foo: 42, bar: false, me: 'hi' },
      },
    }))
    if (isDev) {
      const fixtureDir = normalize(fileURLToPath(new URL('./fixtures/vue-onigiri', import.meta.url)))
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
    } else if (isWebpack) {
      // island CSS is delivered by the vite dev server module graph, which webpack/rspack have no
      // equivalent for in dev: https://github.com/nuxt/nuxt/issues/35573
      expect(result.head.link).toBeUndefined()
      expect(result.head.style).toBeUndefined()
    } else {
      // the dev module graph accumulates scoped styles of islands rendered by earlier
      // tests, so assert this island's own stylesheet rather than snapshotting the list
      const links = result.head.link ?? []
      expect(links.some(link => /PureComponent\.vue\?vue&type=style&index=0&scoped=[^&]+&lang\.css$/.test(String(link.href)))).toBe(true)
    }

    const html = await renderIslandAst(result.ast)
    expect(html).toContain('Was router enabled: true')
    // the scope id survives serialization so scoped styles keep matching
    expect(html).toMatch(/<pre[^>]*data-v-xxxxx/)
    // `v-html` raw JSON of the props
    expect(html).toContain('"number": 3487')
    expect(html).toContain('"str": "something"')
    expect(html).toContain('"foo": 42')
    expect(html).toContain('"bool": false')
  })

  it('test client-side navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('#islands')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/islands')

    await page.locator('#increase-pure-component').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)

    // consumer slot content does not travel over the island protocol under onigiri
    expect(await page.locator('#slot-in-server').count()).toBe(0)
    expect(await page.locator('#test-slot').count()).toBe(0)

    // test islands update (see the StaticHtml note in the `/islands` test for why this
    // asserts through the client component's prop)
    await page.locator('.box').getByText('Sugar Counter 12 x 101').first().waitFor()
    const islandRequests = [
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200),
    ]
    await page.locator('#update-server-components').click()
    await Promise.all(islandRequests)

    await page.locator('#long-async-component-count').getByText('1').waitFor()

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

  it.skipIf(isDev)('should render an island shared by prerendered pages only once', async () => {
    const [a, b] = await Promise.all([
      $fetch<string>('/prerender/island-a'),
      $fetch<string>('/prerender/island-b'),
    ])
    const renderId = (html: string) => html.match(/id="prerender-dedupe"[^>]*>([^<]*)</)?.[1]?.trim()

    expect(renderId(a)).toBeTruthy()
    expect(renderId(a)).toBe(renderId(b))
  })

  it('should show error on 404 error for server pages during client navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('[href="/server-components/lost-page"]')
    await page.getByText('This is the error page').waitFor()
  })

  // `showError(404)` inside a `.server.vue` page must surface as the SSR response status,
  // not render a 200 with an empty island.
  it('maps a server page error to the SSR response status', async () => {
    const res = await fetch('/server-components/lost-page')
    expect(res.status).toBe(404)
  })
})

describe.runif(shouldrun)('hash binding', () => {
  it('accepts a request whose URL hash matches the props', async () => {
    const res = await fetch(islandURL('PureComponent', {
      props: { bool: false, number: 1, str: 's', obj: {} },
    }))
    expect(res.status).toBe(200)
  })

  it('accepts props that change during JSON serialization', async () => {
    const res = await fetch(islandURL('PureComponent', {
      props: {
        bool: false,
        number: 1,
        str: 's',
        obj: { optional: undefined, callback: () => {}, items: [undefined] },
      },
    }))
    expect(res.status).toBe(200)
  })

  // External island clients (e.g. `@nuxtjs/og-image`) build the URL hash from the props object
  // and send `JSON.stringify(props)`. `getIslandHash` over the serialized string and the
  // client's object hash converge (asserted in island-hash.test.ts); here we send the raw
  // `JSON.stringify(props)` the external client emits rather than `serializeIslandProps`.
  it('accepts a request whose props were serialized by an external client', async () => {
    const name = 'PureComponent'
    const props = { bool: false, number: 1, str: 's', obj: {} }
    const hashId = getIslandHash({ name, props: JSON.stringify(props) })
    const res = await fetch(withQuery(`/__nuxt_island/${name}_${hashId}.json`, {
      props: JSON.stringify(props),
    }))
    expect(res.status).toBe(200)
  })

  it('rejects a request whose URL hash was computed over different props', async () => {
    // Compute a valid hash for one set of props, then swap the actual query props.
    const url = islandURL('PureComponent', {
      props: { bool: false, number: 1, str: 's', obj: {} },
    })
    const tampered = url.replace(/props=[^&]+/, 'props=' + encodeURIComponent(JSON.stringify({
      bool: true, number: 999, str: '<script>x</script>', obj: { evil: true },
    })))
    const res = await fetch(tampered)
    expect(res.status).toBe(400)
  })

  it('maps a nuxt error thrown inside an island to its HTTP status', async () => {
    const res = await fetch(islandURL('ThrowingComponent'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({
      status: 404,
      statusText: 'Island not found',
    })
  })

  it('rejects a request with a fabricated hash', async () => {
    const res = await fetch(withQuery('/__nuxt_island/PureComponent_deadbeefcafef00d.json', {
      props: JSON.stringify({ bool: false, number: 1, str: 's', obj: {} }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a request with no hash segment in the URL', async () => {
    const res = await fetch(withQuery('/__nuxt_island/PureComponent.json', {
      props: JSON.stringify({ bool: false, number: 1, str: 's', obj: {} }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects array props even when the hash matches their indexed form', async () => {
    const name = 'PureComponent'
    const hashId = getIslandHash({ name, props: { 0: 3, 1: 0, 2: 3 } })
    const res = await fetch(withQuery(`/__nuxt_island/${name}_${hashId}.json`, {
      props: JSON.stringify([3, 0, 3]),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects primitive props', async () => {
    const name = 'PureComponent'
    const hashId = getIslandHash({ name, props: {} })
    const res = await fetch(withQuery(`/__nuxt_island/${name}_${hashId}.json`, {
      props: 'false',
    }))
    expect(res.status).toBe(400)
  })

  it('rejects null props', async () => {
    const name = 'PureComponent'
    const hashId = getIslandHash({ name, props: {} })
    const res = await fetch(withQuery(`/__nuxt_island/${name}_${hashId}.json`, {
      props: 'null',
    }))
    expect(res.status).toBe(400)
  })
})

describe.runif(shouldrun)('denial-of-service protections', () => {
  it('rejects an oversized island body before hashing', async () => {
    const props = JSON.stringify(Object.fromEntries(Array.from({ length: 150_000 }, (_, i) => [`k${i}`, i])))
    expect(props.length).toBeGreaterThan(MAX_ISLAND_BODY_BYTES)
    const res = await fetch('/__nuxt_island/PureComponent_deadbeef.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ props }),
    })
    expect(res.status).toBe(413)
  })

  it('rejects an oversized chunked island body without content-length', async () => {
    const chunk = JSON.stringify(Object.fromEntries(Array.from({ length: 10_000 }, (_, i) => [`k${i}`, i])))
    const body = new ReadableStream<Uint8Array>({
      start (controller) {
        for (let i = 0; i < 20; i++) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      },
    })
    const res = await fetch('/__nuxt_island/PureComponent_deadbeef.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      // @ts-expect-error `duplex` is required for a streamed request body but missing from the types
      duplex: 'half',
    })
    expect(res.status).toBe(413)
  })

  it('rejects a deeply nested island body before hashing', async () => {
    const props = '['.repeat(500) + ']'.repeat(500)
    const res = await fetch('/__nuxt_island/PureComponent_deadbeef.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ props }),
    })
    expect(res.status).toBe(400)
  })

  it('still accepts a well-formed small island body', async () => {
    const name = 'PureComponent'
    const props = { bool: false, number: 1, str: 's', obj: {} }
    const hashId = getIslandHash({ name, props: serializeIslandProps(props) })
    const res = await fetch(`/__nuxt_island/${name}_${hashId}.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ props: serializeIslandProps(props) }),
    })
    expect(res.status).toBe(200)
  })
})

describe.runif(shouldrun)('hash/render input alignment', () => {
  // `data-v-*` props are stripped before both hashing and rendering, so adding only those
  // keys resolves to the same hash and an identical payload.
  it('ignores data-v-* props so the same hashId yields an identical payload', async () => {
    const name = 'PureComponent'
    const props = { bool: false, number: 1, str: 's', obj: {} }
    const hashId = getIslandHash({ name, props: serializeIslandProps(props) })

    const plain = await $fetch<NuxtIslandResponse>(withQuery(`/__nuxt_island/${name}_${hashId}.json`, {
      props: JSON.stringify(props),
    }))
    const withScopeMarkers = await $fetch<NuxtIslandResponse>(withQuery(`/__nuxt_island/${name}_${hashId}.json`, {
      props: JSON.stringify({ ...props, 'data-v-abc123': '', 'data-v-def456': '' }),
    }))

    expect(JSON.stringify(withScopeMarkers.ast)).not.toContain('data-v-abc123')
    expect(withScopeMarkers.ast).toEqual(plain.ast)
  })
})

describe.runif(shouldrun)('reserved island prop keys', () => {
  // Without `vue.runtimeCompiler` a `template` value is inert, so data that merely contains
  // that key (e.g. CMS content) must still render.
  it('allows a nested template key when the runtime compiler is disabled', async () => {
    const props = { content: { template: 'blog' } }
    const result = await $fetch<NuxtIslandResponse>(islandURL('PureComponent', { props }))
    expect(result.ast).toBeTruthy()
  })

  it('rejects a top-level `as` prop the island does not declare', async () => {
    const res = await fetch(islandURL('PureComponent', { props: { as: 'iframe' } }))
    expect(res.status).toBe(400)
    // the reason is fixed, so a caller cannot probe which islands declare which props
    const body = await res.text()
    expect(body).toContain('Invalid island request props')
    expect(body).not.toContain('declare')
  })

  it('renders a top-level `as` prop the island declares', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('AsPropComponent', { props: { as: 'section' } }))
    expect(JSON.stringify(result.ast)).toContain('as: section')
  })
})

describe.runif(shouldrun)('page-island middleware', () => {
  it('runs page middleware and honours redirects for `page_*` islands', async () => {
    const res = await fetch(islandURL('page_gated-server-page', {
      context: { url: '/gated-server-page' },
    }), { redirect: 'manual' })
    // page middleware calls `navigateTo('/login', { redirectCode: 302 })`
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/login')
    const body = await res.text()
    expect(body).not.toContain('SUPER-SECRET-PAGE-ISLAND-BODY')
    // this asserts the island handler fires `app:rendered` even when middleware short-circuits response
    expect(res.headers.get('set-cookie')).toContain('island-auth-marker=set-from-island-middleware')
  })

  it('still renders unguarded `page_*` islands', async () => {
    const res = await fetch(islandURL('page_server-page', {
      context: { url: '/server-page' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as NuxtIslandResponse
    expect(JSON.stringify(body.ast)).toContain('Hello this is a server page')
  })

  it('rejects a `page_*` island whose url routes to a different page', async () => {
    // Forging `page_gated-server-page` with `url=/server-page` would render the gated
    // page's HTML while running the (empty) middleware for the unguarded page.
    const res = await fetch(islandURL('page_gated-server-page', {
      context: { url: '/server-page' },
    }), { redirect: 'manual' })
    expect(res.status).toBe(400)
    const body = await res.text()
    expect(body).not.toContain('SUPER-SECRET-PAGE-ISLAND-BODY')
  })
})

describe.skipIf(!shouldRun || isDev || isWebpack)('regressions', () => {
  // https://github.com/nuxt/nuxt/issues/26527 — fixed under vue-onigiri since 0.6.0
  it('renders <Counter v-load-client /> when nested two levels deep in server components', async () => {
    const { page } = await renderPage('/nested-nuxt-client')

    await page.locator('.server-inner-counter .sugar-counter button').waitFor({ timeout: 5_000 })
    await page.locator('.universal-counter .sugar-counter button').waitFor({ timeout: 5_000 })

    await page.locator('.server-inner-counter .sugar-counter button').click()
    expect(await page.locator('.server-inner-counter .sugar-counter').innerText()).toContain('Sugar Counter 13')

    await page.close()
  })

  // https://github.com/nuxt/nuxt/issues/32251
  it('does not produce hydration mismatches with selectiveClient: "deep" on slot-using components', async () => {
    const { page, consoleLogs } = await renderPage('/selective-client-slots')

    await page.locator('#slotted').waitFor()
    expect(consoleLogs.filter(l => l.type === 'error' && l.text.includes('Hydration'))).toEqual([])

    await page.close()
  })

  // https://github.com/nuxt/nuxt/issues/32537
  it('keeps a leaving page\'s useHead styles applied throughout pageTransition leave', async () => {
    const { page } = await renderPage('/page-transition-style/red')

    const redLocator = page.locator('.red-page')
    await redLocator.waitFor()
    expect(await redLocator.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 0, 0)')

    // While the leaving page's <Transition> still has its DOM mounted, the
    // `useHead({ style })` entry registered by red.vue must still be present in
    // <head> — otherwise the leaving DIV becomes unstyled mid-animation. Sample
    // the computed background-color across the leave window (rAF) starting from
    // the click; before the fix unhead's debounced render fires within ~20ms of
    // click, dropping the style and turning the bg transparent.
    await page.evaluate(() => {
      const w = window as unknown as { __samples?: Array<{ bg: string | null, hasLeave: boolean | null }> }
      w.__samples = []
      const start = performance.now()
      const tick = () => {
        const el = document.querySelector('.red-page')
        w.__samples!.push({
          bg: el ? getComputedStyle(el).backgroundColor : null,
          hasLeave: el ? el.classList.contains('page-leave-active') : null,
        })
        if (performance.now() - start < 600) { requestAnimationFrame(tick) }
      }
      ;(document.querySelector('#to-blue') as HTMLAnchorElement).click()
      requestAnimationFrame(tick)
    })

    await page.locator('.blue-page').waitFor()

    const samples = await page.evaluate(() => (window as unknown as { __samples: Array<{ bg: string | null, hasLeave: boolean | null }> }).__samples)
    const leaveSamples = samples.filter(s => s.hasLeave)
    expect(leaveSamples.length).toBeGreaterThan(0)
    expect(leaveSamples.every(s => s.bg === 'rgb(255, 0, 0)')).toBe(true)

    await page.close()
  })
})

describe.runif(shouldrun)('onigiri rendering matrix', () => {
  it('SSR renders multiple instances of the same island with their own props', async () => {
    const html = await $fetch<string>('/multi')
    expect(html).toContain('block:multi-a x2')
    expect(html).toContain('block:multi-b x5')
    // `v-load-client` components still render inline during SSR
    expect(html).toContain('Sugar Counter 12 x 2 = 24')
    expect(html).toContain('Sugar Counter 12 x 5 = 60')
  })

  it('island endpoint returns an AST payload, not island HTML', async () => {
    const result = await $fetch<NuxtIslandResponse & { ast?: unknown }>(islandURL('PureComponent', { props: { bool: true, number: 3, str: 'hi', obj: { foo: 42 } } }))
    expect(result.ast).toBeDefined()
    expect(result.html).toBeUndefined()
  })

  it('hydrates client components inside islands without mismatches', async () => {
    const { page, consoleLogs } = await renderPage('/hydration')
    await page.locator('#hydration-island .sugar-counter button').waitFor()

    await page.locator('#hydration-island .sugar-counter button').click()
    expect(await page.locator('#hydration-island .sugar-counter').innerText()).toContain('Sugar Counter 13 x 4 = 52')

    // the page-level counter hydrates independently of the island one
    await page.locator('.page-counter .sugar-counter button').click()
    expect(await page.locator('.page-counter .sugar-counter').innerText()).toContain('Sugar Counter 13 x 3 = 39')

    expect(consoleLogs.filter(l => l.type === 'error')).toEqual([])
    expect(consoleLogs.filter(l => l.text.includes('Hydration'))).toEqual([])
    await page.close()
  })

  it('hydrates sibling island client components independently', async () => {
    const { page } = await renderPage('/multi')
    await page.locator('#multi-a .sugar-counter button').waitFor()

    await page.locator('#multi-a .sugar-counter button').click()
    await page.locator('#multi-a .sugar-counter button').click()
    await page.locator('#multi-b .sugar-counter button').click()

    expect(await page.locator('#multi-a .sugar-counter').innerText()).toContain('Sugar Counter 14 x 2 = 28')
    expect(await page.locator('#multi-b .sugar-counter').innerText()).toContain('Sugar Counter 13 x 5 = 65')
    await page.close()
  })

  it('fetches and renders an island during client-side navigation', async () => {
    const { page } = await renderPage('/nav')
    const islandRequest = page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.click('#to-nav-island')
    await islandRequest

    await page.locator('.nav-server-label').getByText('nav-island:from-nav').waitFor()
    await page.close()
  })

  it('loads island client components through navigation and hydrates them', async () => {
    const { page } = await renderPage('/nav')
    await page.click('#to-nav-island')

    await page.locator('#nav-island-page .sugar-counter button').waitFor()
    await page.locator('#nav-island-page .sugar-counter button').click()
    expect(await page.locator('#nav-island-page .sugar-counter').innerText()).toContain('Sugar Counter 13 x 2 = 26')
    await page.close()
  })

  it('applies island scoped styles on first paint', async () => {
    const { page } = await renderPage('/nav/island')
    const label = page.locator('.nav-server-label')
    await label.waitFor()
    expect(await label.evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 128, 0)')
    await page.close()
  })

  it('applies island scoped styles after client-side navigation', async () => {
    const { page } = await renderPage('/nav')
    await page.click('#to-nav-island')

    const label = page.locator('.nav-server-label')
    await label.waitFor()
    expect(await label.evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 128, 0)')
    await page.close()
  })

  it('keeps islands working across back/forward navigation', async () => {
    const { page } = await renderPage('/nav/island')
    await page.locator('#nav-island-page .sugar-counter button').waitFor()

    await page.click('#to-nav-other')
    await page.locator('#nav-other-page').waitFor()

    await page.goBack()
    await page.locator('#nav-island-page .sugar-counter button').waitFor()
    await page.locator('#nav-island-page .sugar-counter button').click()
    expect(await page.locator('#nav-island-page .sugar-counter').innerText()).toContain('Sugar Counter 13 x 2 = 26')

    await page.goForward()
    await page.locator('#nav-other-page').waitFor()
    await page.close()
  })

  it('refetches an island when its props change', async () => {
    const { page } = await renderPage('/props-update')
    await page.locator('#props-update-block').getByText('block:props-update-block x1').waitFor()

    const refetch = page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.click('#bump-multiplier')
    await refetch

    await page.locator('#props-update-block').getByText('block:props-update-block x2').waitFor()
    await page.close()
  })
})

/**
 * Renders an island AST payload through the client deserializer, so assertions
 * survive AST layout changes. Client chunk references resolve to a marker
 * element since the test process cannot load them.
 */
async function renderIslandAst (ast: unknown): Promise<string> {
  const app = createSSRApp(defineComponent({
    setup: () => () => renderOnigiri(ast as OnigiriPayload, {
      importFn: chunk => Promise.resolve(defineComponent({
        setup: (_, { slots }) => () => h('div', { 'data-client-stub': chunk }, slots.default?.()),
      }) as DefineComponent),
    }),
  }))
  const html = await renderToString(app)
  return html.replace(/data-v-[a-z0-9]+/g, 'data-v-xxxxx')
}

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
