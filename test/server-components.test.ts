import { connect } from 'node:net'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { withQuery } from 'ufo'
import { normalize } from 'pathe'
import { glob } from 'tinyglobby'
import { $fetch, fetch, startServer, url, useTestContext } from '@nuxt/test-utils/e2e'
import type { NuxtIslandResponse } from 'nuxt/app'
import { getIslandHash, serializeIslandProps } from '../packages/nuxt/src/app/island-hash'
import { MAX_VFOR_LENGTH } from '../packages/nuxt/src/app/components/vfor'
import { MAX_ISLAND_BODY_BYTES, MAX_ISLAND_DRAIN_BYTES } from '../packages/nitro-server/src/runtime/utils/island-props'

import { isDev, isWebpack, islandsV2, legacyErrorRendering, runsOnceInMatrix as once, runsOncePerBuildInMatrix as oncePerBuild, runsOncePerViteBuilderInMatrix as oncePerServer } from './matrix'
import { fixturePath, renderPage, setupFixture } from './utils'

/** Projects asserting on error responses, including the legacy error rendering variants. */
const errorProjects = oncePerServer || legacyErrorRendering

function islandURL (name: string, opts: { props?: Record<string, any>, context?: Record<string, any> } = {}) {
  const serializedProps = serializeIslandProps(opts.props)
  const ctx = opts.context ?? {}
  const hashId = getIslandHash({ name, props: serializedProps, context: ctx })
  const query: Record<string, any> = { ...ctx }
  if (opts.props) { query.props = serializedProps }
  return withQuery(`/__nuxt_island/${name}_${hashId}.json`, query)
}

await setupFixture('server-components', oncePerBuild || errorProjects, {
  browser: true,
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

describe.skipIf(!oncePerBuild)('server components/islands', () => {
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
    await page.locator('#island-mounted-client-side').getByText('hello world !!!').waitFor()
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
    if (islandsV2) {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"> Loading server component </section><section id="no-fallback"><!----></section><!---->"')
    } else {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"> Loading server component </section><section id="no-fallback"><div></div></section><div></div>"')
      expect(text).toContain('Loading server component')
    }
    expect(text).not.toContain('async component that was very long')

    await page.waitForFunction(() => (document.querySelector('#no-fallback') as HTMLElement)?.innerText?.includes('async component'))
    await page.waitForFunction(() => (document.querySelector('#fallback') as HTMLElement)?.innerText?.includes('async component'))

    await page.goBack({ waitUntil: 'networkidle' })
    await page.getByText('Go to page with lazy server component').click()
    await page.waitForLoadState('networkidle')

    expect(consoleLogs.filter(l => l.type === 'error')).toHaveLength(0)

    await page.close()
  })

  it('should not preload a component only used by a server component', async () => {
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

    const text = normaliseIslandHTML(await page.innerText('pre'))

    if (isWebpack) {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <div class="sugar-counter" nuxt-client=""> Sugar Counter 12 x 1 = 12 <button> Inc </button></div></div></div>"')
    } else if (islandsV2) {
      expect(text).toMatchInlineSnapshot(`" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--i:s:NONCE["default",{},null,""]--><!--/i:s:NONCE--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--i:s:NONCE["default",{},null,""]--><!--/i:s:NONCE--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border: 1px solid red;"> The component below is not a slot but declared as interactive <!--i:c:NONCE[{"multiplier":1},"/components/Counter.vue","default"]--><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--/i:c:NONCE--></div></div>"`)
    } else {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--[--><div style="display: contents;" data-island-component></div><!--teleport start--><!--teleport end--><!--]--></div></div>"')
    }
    expect(text).toContain('async component that was very long')

    await page.waitForFunction(() => (document.querySelector('#no-fallback') as HTMLElement)?.innerText?.includes('async component'))
    await page.waitForFunction(() => (document.querySelector('#fallback') as HTMLElement)?.innerText?.includes('async component'))

    await page.close()
  })

  it('/server-page', async () => {
    const html = await $fetch<string>('/server-page')
    // the island body ships only in the markup, not again in the payload
    const [markup = '', payload = ''] = html.split(/<script[^>]*id="__NUXT_DATA__"[^>]*>/)
    expect(markup.match(/Hello this is a server page/g)).toHaveLength(1)
    expect(payload).not.toContain('Hello this is a server page')
    expect(html).toContain('<meta name="author" content="Nuxt">')
    expect(html).toContain('plugin-style')
    // https://github.com/nuxt/nuxt/issues/34482
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

  it('/server-page - island response is prefetched by NuxtLink', async () => {
    const { page, requests } = await renderPage('/')
    await page.waitForLoadState('networkidle')

    const isServerPageIsland = (req: string) => /^\/__nuxt_island\/page_server-page_/.test(req)

    // in dev, links do not prefetch their pages, so the island is fetched on navigation
    expect(requests.some(isServerPageIsland)).toBe(!isDev)
    requests.length = 0

    await page.getByText('to server page').click()
    await page.waitForFunction(() => !!document.head.querySelector('meta[name="author"][content="Nuxt"]'))

    expect(requests.some(isServerPageIsland)).toBe(isDev)
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

  it('re-mounts a hydrated island without refetching it', async () => {
    const { page, requests } = await renderPage('/island-remount')

    try {
      await expect.poll(() => page.locator('#remount-island').textContent()).toContain('Route: /remount')
      for (let i = 0; i < 2; i++) {
        await page.locator('#toggle-remount-island').click()
        await page.locator('#remount-island').waitFor({ state: 'detached' })
        await page.locator('#toggle-remount-island').click()
        await expect.poll(() => page.locator('#remount-island').textContent()).toContain('Route: /remount')
      }
      expect(requests.filter(request => request.includes('/__nuxt_island/'))).toEqual([])
    } finally {
      await page.close()
    }
  })

  it('renders the fallback slot with the error when an island fails, until it recovers', async () => {
    const html = await $fetch<string>('/island-error')
    expect(html).toContain('Island failed with 404')

    const { page, consoleLogs } = await renderPage('/island-error')
    try {
      await page.waitForLoadState('networkidle')
      expect(await page.locator('#island-error-fallback').textContent()).toContain('Island failed with 404')
      expect(await page.locator('#island-error-no-fallback').textContent()).not.toContain('never rendered')
      if (islandsV2) {
        expect(consoleLogs.filter(log => log.text.includes('Hydration'))).toEqual([])
      }

      await page.locator('#island-error-recover').click()
      await expect.poll(() => page.locator('#island-error').textContent()).toContain('Route: /island-error')
      expect(await page.locator('#island-error-fallback').count()).toBe(0)

      // referesh the island after it fails again
      await page.locator('#island-error-break').click()
      await page.locator('#island-error-fallback').waitFor()
      expect(await page.locator('#island-error').textContent()).not.toContain('Route: /island-error')
      const refreshed = page.waitForResponse(response => response.url().includes('/__nuxt_island/ThrowingComponent'))
      await page.locator('#island-error-refresh').click()
      expect((await refreshed).status()).toBe(404)
      expect(await page.locator('#island-error-fallback').textContent()).toContain('Island failed with 404')

      await page.locator('#island-error-recover').click()
      await expect.poll(() => page.locator('#island-error').textContent()).toContain('Route: /island-error')
      expect(await page.locator('#island-error-fallback').count()).toBe(0)
    } finally {
      await page.close()
    }
  })

  it.skipIf(!islandsV2)('renders page slots interactively at the island\'s own slot outlets', async () => {
    // The island response is rendered without the page's slots, so it only holds markers and fallbacks.
    const island = await $fetch<NuxtIslandResponse>(islandURL('ServerSlots'))
    expect(normaliseIslandHTML(island.html!)).toMatchInlineSnapshot(`"<div class="server-slots"><div class="slot-box"><!--[--><p class="box-content"> island box content </p><!--]--></div><!--i:s:NONCE["default",{},null,"\\u003Cp class=\\"default-fallback\\"> default fallback \\u003C/p>"]--><!--/i:s:NONCE--><!--i:c:NONCE[null,"/components/SlotEcho.vue","default",{"default":"\\u003C!-\\u002Di:s:NONCE[\\"in-client\\",{},null,\\"\\"]-\\u002D>\\u003C!-\\u002D/i:s:NONCE-\\u002D>"}]--><div class="slot-echo"><button class="slot-echo-inc"> echo 0</button><!--[--><!--i:s:NONCE["in-client",{},null,""]--><!--/i:s:NONCE--><!--]--></div><!--/i:c:NONCE--><!--i:s:NONCE["unused",{},null,"\\u003Cp class=\\"unused-fallback\\"> unused fallback \\u003C/p>"]--><!--/i:s:NONCE--></div>"`)

    const html = await $fetch<string>('/island-slots')
    expect(html).toContain('id="island-slot-default"')
    expect(html).toContain('id="island-slot-in-client"')
    // The fallbacks also travel JSON-escaped in the markers, which this does not match.
    expect(html).not.toContain('class="default-fallback"')
    expect(html).toContain('class="unused-fallback"')

    const { page, consoleLogs, requests } = await renderPage('/island-slots')
    try {
      const first = page.locator('#first-slots-island')
      // A universal child's own `<slot>` keeps the island's content.
      expect(await first.locator('.slot-box').innerText()).toContain('island box content')
      expect(await page.locator('#island-slot-default').count()).toBe(1)
      expect(await first.locator('.unused-fallback').count()).toBe(1)

      await page.locator('#island-slot-inc').click()
      await expect.poll(() => page.locator('#island-slot-default').innerText()).toContain('page 1')
      // A page slot inside a `v-load-client` component's slot stays reactive.
      expect(await first.locator('.slot-echo #island-slot-in-client').innerText()).toContain('in client 1')
      await first.locator('.slot-echo-inc').click()
      await expect.poll(() => first.locator('.slot-echo-inc').innerText()).toContain('echo 1')

      // The same island mounted again reuses the HTML captured on hydration, with its own slots.
      await page.locator('#show-second-slots-island').click()
      const second = page.locator('#second-slots-island')
      await expect.poll(() => second.locator('#second-island-slot').innerText()).toContain('second 1')
      expect(await second.locator('#island-slot-default').count()).toBe(0)
      expect(await second.locator('.default-fallback').count()).toBe(0)
      expect(await second.locator('.unused-fallback').count()).toBe(1)
      expect(await second.locator('.slot-box').innerText()).toContain('island box content')

      expect(requests.filter(request => request.includes('/__nuxt_island/'))).toEqual([])
      expect(consoleLogs.filter(l => l.type === 'error')).toEqual([])
      expect(consoleLogs.filter(l => l.text.includes('Hydration'))).toEqual([])
    } finally {
      await page.close()
    }
  })

  // https://github.com/nuxt/nuxt/issues/31510
  it.skipIf(isWebpack)('applies scoped styles to server component slots', async () => {
    const { page } = await renderPage('/slotted-styles')

    try {
      const slotted = page.locator('#slotted-style-in-server')
      expect(await slotted.count()).toBe(1)

      const slottedStyles = await slotted.evaluate((element) => {
        const scopeIds = element.getAttributeNames().filter(attribute => attribute.startsWith('data-v-'))
        return {
          backgroundColor: getComputedStyle(element).backgroundColor,
          color: getComputedStyle(element).color,
          hasParentScopeId: scopeIds.some(attribute => !attribute.endsWith('-s')),
          hasSlottedScopeId: scopeIds.some(attribute => attribute.endsWith('-s')),
        }
      })
      expect(slottedStyles).toEqual({
        backgroundColor: 'rgb(4, 5, 6)',
        color: 'rgb(1, 2, 3)',
        hasParentScopeId: true,
        hasSlottedScopeId: true,
      })
    } finally {
      await page.close()
    }
  })
})

describe('component islands', () => {
  it.skipIf(!once)('renders components with route', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('RouteComponent', { context: { url: '/foo' } }))

    expect(normaliseIslandResponse(result)).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<pre>    Route: /foo
        </pre>",
      }
    `)
  })

  it.skipIf(!oncePerBuild || isDev)('keeps server component implementations out of the client bundle', async () => {
    const marker = 'ServerWithClient.server.vue :'
    // @ts-expect-error ssssh! untyped secret property
    const { output } = useTestContext().nuxt._nitro.options
    const contents = async (dir: string) => Promise.all((await glob('**/*.{js,mjs}', { cwd: dir, absolute: true })).map(file => readFile(file, 'utf8')))

    expect((await contents(output.publicDir)).some(code => code.includes(marker))).toBe(false)
    expect((await contents(output.serverDir)).some(code => code.includes(marker))).toBe(true)
  })

  it.skipIf(!oncePerBuild)('render async component', async () => {
    const result = normaliseIslandResponse(await $fetch<NuxtIslandResponse>(islandURL('LongAsyncComponent', { props: { count: 3 } })))

    // Legacy teleports page slots into placeholders and ships fallbacks in `slots`; v2 renders them at `i:s` outlets.
    if (islandsV2) {
      expect(result).toMatchInlineSnapshot(`
        {
          "head": {
            "link": [],
            "style": [],
          },
          "html": "<div><div> count is above 2 </div><!--i:s:NONCE["default",{},null,""]--><!--/i:s:NONCE--> that was very long ... <div id="long-async-component-count">3</div>  <!--i:s:NONCE["test",{"count":3},null,""]--><!--/i:s:NONCE--><p>hello world !!!</p><!--[--><!--i:s:NONCE["hello",{"t":1},null,"\\u003Cdiv> fallback slot -\\u002D index: 0\\u003C/div>"]--><!--/i:s:NONCE--><!--i:s:NONCE["hello",{"t":2},null,"\\u003Cdiv> fallback slot -\\u002D index: 1\\u003C/div>"]--><!--/i:s:NONCE--><!--i:s:NONCE["hello",{"t":3},null,"\\u003Cdiv> fallback slot -\\u002D index: 2\\u003C/div>"]--><!--/i:s:NONCE--><!--]--><!--[--><!--i:s:NONCE["fallback",{"t":"fall"},null,"\\u003Cdiv>fall slot -\\u002D index: 0\\u003C/div>\\u003Cdiv class=\\"fallback-slot-content\\"> wonderful fallback \\u003C/div>"]--><!--/i:s:NONCE--><!--i:s:NONCE["fallback",{"t":"back"},null,"\\u003Cdiv>back slot -\\u002D index: 1\\u003C/div>\\u003Cdiv class=\\"fallback-slot-content\\"> wonderful fallback \\u003C/div>"]--><!--/i:s:NONCE--><!--]--></div>",
        }
      `)
      return
    }
    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<div><div> count is above 2 </div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--> that was very long ... <div id="long-async-component-count">3</div>  <!--[--><div style="display: contents;" data-island-slot="test"><!--teleport start--><!--teleport end--></div><!--]--><p>hello world !!!</p><!--[--><div style="display: contents;" data-island-slot="hello"><!--teleport start--><!--teleport end--></div><!--teleport start--><!--teleport end--><!--]--><!--[--><div style="display: contents;" data-island-slot="fallback"><!--teleport start--><!--teleport end--></div><!--teleport start--><!--teleport end--><!--]--></div>",
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
                "t": 1,
              },
              {
                "t": 2,
              },
              {
                "t": 3,
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

  it.skipIf(!oncePerBuild)('render .server async component', async () => {
    const result = normaliseIslandResponse(await $fetch<NuxtIslandResponse>(islandURL('AsyncServerComponent', { props: { count: 2 } })))

    if (islandsV2) {
      expect(result).toMatchInlineSnapshot(`
        {
          "head": {
            "link": [],
            "style": [],
          },
          "html": "<div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">2</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--i:s:NONCE["default",{},null,""]--><!--/i:s:NONCE--></div>",
        }
      `)
      return
    }
    result.props = {}
    result.components = {}
    result.slots = {}

    expect(result).toMatchInlineSnapshot(`
      {
        "components": {},
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">2</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div>",
        "props": {},
        "slots": {},
      }
    `)
  })

  if (!isWebpack) {
    it.skipIf(!oncePerBuild)('render server component with selective client hydration', async () => {
      const result = normaliseIslandResponse(await $fetch<NuxtIslandResponse>(islandURL('ServerWithClient')))

      // Legacy teleports client components from `components`; v2 renders them inline between `i:c` markers.
      if (islandsV2) {
        expect(result).toMatchInlineSnapshot(`
          {
            "head": {
              "link": [],
              "style": [],
            },
            "html": "<div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--i:c:NONCE[{"multiplier":1},"/components/Counter.vue","default"]--><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--/i:c:NONCE--></div></div>",
          }
        `)
        return
      }
      const { components } = result
      result.components = {}
      result.slots = {}

      const teleportsEntries = Object.entries(components || {})

      expect(result).toMatchInlineSnapshot(`
        {
          "components": {},
          "head": {
            "link": [],
            "style": [],
          },
          "html": "<div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--[--><div style="display: contents;" data-island-component></div><!--teleport start--><!--teleport end--><!--]--></div></div>",
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

    it.skipIf(!oncePerBuild)('render nested server components with one client component', async () => {
      const result = await $fetch<NuxtIslandResponse>(islandURL('ServerOuter'))

      const html = result.html!
      expect(html).toContain('server-outer')
      expect(html).toContain('server-inner-counter')
      // Under v2 the nested island's client component travels in an `i:c` marker instead of `components`.
      const clientComponents = islandsV2 ? html.match(/<!--i:c:\w+\[/g) ?? [] : Object.keys(result.components ?? {})
      expect(clientComponents).toHaveLength(1)
    })
  }

  it.skipIf(!oncePerBuild)('renders pure components', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('PureComponent', {
      props: {
        bool: false,
        number: 3487,
        str: 'something',
        obj: { foo: 42, bar: false, me: 'hi' },
      },
    }))

    if (isDev) {
      const fixtureDir = normalize(fixturePath('server-components'))
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
      for (const link of result.head.link ?? []) {
        link.href &&= link.href.replace(/scoped=[^?&]+/, 'scoped=xxxxx')
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

    const html = normaliseIslandHTML(result.html!).replaceAll(/data-v-\w+/g, 'data-v-xxxxx')
    // Legacy teleports the client Counter out of the HTML; v2 renders it inline between `i:c` markers.
    if (islandsV2) {
      expect(html).toMatchInlineSnapshot(`
        "<div data-v-xxxxx> Was router enabled: true <br data-v-xxxxx> Props: <!-- eslint-disable-next-line vue/no-v-html --><pre data-v-xxxxx>{
          "number": 3487,
          "str": "something",
          "obj": {
            "foo": 42,
            "bar": false,
            "me": "hi"
          },
          "bool": false
        }</pre><!--i:c:NONCE[{"multiplier":3487},"/components/Counter.vue","default"]--><div class="sugar-counter" data-v-xxxxx> Sugar Counter 12 x 3487 = 41844 <button> Inc </button></div><!--/i:c:NONCE--></div>"
      `)
    }
    expect(html.replace(/data-v-xxxxx|"|<!--.*-->/g, '')).toMatchInlineSnapshot(`
      "<div > Was router enabled: true <br > Props: <pre >{
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

  it.skipIf(!oncePerBuild)('test client-side navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('#islands')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/islands')

    await page.locator('#increase-pure-component').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)

    await page.locator('#slot-in-server').getByText('Slot with in .server component').waitFor()
    await page.locator('#test-slot').getByText('Slot with name test').waitFor()

    // test islands update
    await page.locator('.box').getByText('"number": 101,').first().waitFor()
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

  it.skipIf(!oncePerServer || isDev)('should not render an error when having a baseURL', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/foo/',
      },
    })

    const result = await fetch('/foo/islands')
    expect(result.status).toBe(200)

    await startServer()
  })

  it.skipIf(!oncePerBuild)('render island page', async () => {
    const { page } = await renderPage('/')

    const islandPageRequest = page.waitForRequest((req) => {
      return req.url().includes('/__nuxt_island/page_server-page')
    })
    await page.getByText('to server page').click()
    await islandPageRequest
    await page.locator('#server-page').waitFor()
    await page.close()
  })

  it.skipIf(!once)('should render an island shared by prerendered pages only once', async () => {
    const [a, b] = await Promise.all([
      $fetch<string>('/prerender/island-a'),
      $fetch<string>('/prerender/island-b'),
    ])
    const renderId = (html: string) => html.match(/id="prerender-dedupe"[^>]*>([^<]*)</)?.[1]?.trim()

    expect(renderId(a)).toBeTruthy()
    expect(renderId(a)).toBe(renderId(b))
  })

  it.skipIf(!errorProjects)('maps a nuxt error thrown inside an island to its HTTP status', async () => {
    const res = await fetch(islandURL('ThrowingComponent'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({
      status: 404,
      statusText: 'Island not found',
    })
  })

  it.skipIf(!errorProjects)('should show error on 404 error for server pages during client navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('[href="/server-components/lost-page"]')
    await page.getByText('This is the error page').waitFor()
    await page.close()
  })

  it.skipIf(!errorProjects)('maps a server page error to the SSR response status', async () => {
    const res = await fetch('/server-components/lost-page')
    expect(res.status).toBe(404)
  })
})

const pureProps = { bool: false, number: 1, str: 's', obj: {} }

function islandURLWithHash (props: string, hashedProps: Record<string, unknown> | string = props, name = 'PureComponent') {
  return withQuery(`/__nuxt_island/${name}_${getIslandHash({ name, props: hashedProps })}.json`, { props })
}

describe.skipIf(!oncePerServer)('hash binding', () => {
  it.each([
    ['props matching the hash', islandURL('PureComponent', { props: pureProps })],
    ['props that change during JSON serialization', islandURL('PureComponent', { props: { ...pureProps, obj: { optional: undefined, callback: () => {}, items: [undefined] } } })],
    // external island clients such as `@nuxtjs/og-image` send `JSON.stringify(props)`
    ['props serialized by an external client', islandURLWithHash(JSON.stringify(pureProps))],
  ])('accepts a request with %s', async (_, url) => {
    expect((await fetch(url)).status).toBe(200)
  })

  it.each([
    ['a fabricated hash', withQuery('/__nuxt_island/PureComponent_deadbeefcafef00d.json', { props: JSON.stringify(pureProps) })],
    ['no hash segment in the URL', withQuery('/__nuxt_island/PureComponent.json', { props: JSON.stringify(pureProps) })],
    ['array props whose indexed form matches the hash', islandURLWithHash(JSON.stringify([3, 0, 3]), { 0: 3, 1: 0, 2: 3 })],
    ['primitive props', islandURLWithHash('false', {})],
    ['null props', islandURLWithHash('null', {})],
  ])('rejects a request with %s', async (_, url) => {
    expect((await fetch(url)).status).toBe(400)
  })

  it('rejects a request whose URL hash was computed over different props', async () => {
    const url = islandURL('PureComponent', {
      props: { bool: false, number: 1, str: 's', obj: {} },
    })
    const tampered = url.replace(/props=[^&]+/, 'props=' + encodeURIComponent(JSON.stringify({
      bool: true, number: 999, str: '<script>x</script>', obj: { evil: true },
    })))
    const res = await fetch(tampered)
    expect(res.status).toBe(400)
  })
})

describe.skipIf(!oncePerServer)('denial-of-service protections', () => {
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

  it('keeps the connection usable after rejecting an oversized body', async () => {
    const { hostname, port } = new URL(url('/'))
    const oversized = 'x'.repeat(MAX_ISLAND_DRAIN_BYTES)
    const nested = `{"props":${'['.repeat(500)}${']'.repeat(500)}}`
    const request = (body: string) => [
      'POST /__nuxt_island/PureComponent_deadbeef.json HTTP/1.1',
      `Host: ${hostname}:${port}`,
      'Content-Type: application/json',
      `Content-Length: ${Buffer.byteLength(body)}`,
      '',
      body,
    ].join('\r\n')

    const statuses = await new Promise<string[]>((resolve, reject) => {
      const socket = connect(Number(port), hostname)
      let received = ''
      socket.on('data', (chunk) => {
        received += chunk.toString()
        const statuses = [...received.matchAll(/HTTP\/1\.1 (\d{3}) /g)].map(m => m[1]!)
        if (statuses.length === 2) {
          socket.end()
          resolve(statuses)
        }
      })
      socket.on('error', reject)
      socket.on('close', () => reject(new Error(`connection closed after: ${received.split('\r\n')[0]}`)))
      socket.on('connect', () => {
        socket.write(request(oversized))
        socket.write(request(nested))
      })
    })

    expect(statuses).toEqual(['413', '400'])
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
    const res = await fetch('/__nuxt_island/PureComponent_deadbeef.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: `{"props":${'['.repeat(500)}${']'.repeat(500)}}`,
    })
    expect(res.status).toBe(400)
  })

  it('still accepts a well-formed small island body', async () => {
    const name = 'PureComponent'
    const hashId = getIslandHash({ name, props: serializeIslandProps(pureProps) })
    const res = await fetch(`/__nuxt_island/${name}_${hashId}.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ props: serializeIslandProps(pureProps) }),
    })
    expect(res.status).toBe(200)
  })
})

describe.skipIf(!oncePerBuild)('v-for bounds in islands', () => {
  // Bounds both the plain-element path (`ssrRenderList`, rendered inline into `html`) and the
  // slot path (`vforToArray`, whose `:props` array and fallback content are teleported into
  // the slot response rather than the island body; v2 writes one `i:s` outlet per item).
  it('bounds plain and slot v-for over a large-integer prop', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('BoundedVForComponent', { props: { count: 10_000_000 } }))
    const html = result.html!
    expect(html.match(/class="plain-item"/g)?.length ?? 0).toBe(MAX_VFOR_LENGTH)
    const loop = islandsV2 ? readSlotOutlets(result, 'loop') : result.slots?.loop
    expect(loop?.props?.length ?? 0).toBe(MAX_VFOR_LENGTH)
    expect(loop?.fallback?.match(/class="slot-item"/g)?.length ?? 0).toBe(MAX_VFOR_LENGTH)
  })

  it('renders a small v-for prop unchanged', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('BoundedVForComponent', { props: { count: 3 } }))
    const html = result.html!
    expect(html.match(/class="plain-item"/g)?.length ?? 0).toBe(3)
    const loop = islandsV2 ? readSlotOutlets(result, 'loop') : result.slots?.loop
    expect(loop?.props?.length ?? 0).toBe(3)
    expect(loop?.fallback?.match(/class="slot-item"/g)?.length ?? 0).toBe(3)
  })

  it.each([
    ['BoundedVForPug', 'pug-item'],
    ['BoundedVForSrc', 'src-item'],
    ['BoundedVForSpaced', 'spaced-item'],
    ['BoundedVForForwarded', 'row-item'],
  ])('bounds a large-integer v-for in %s', async (name, className) => {
    const result = await $fetch<NuxtIslandResponse>(islandURL(name, { props: { count: 10_000_000 } }))
    expect(result.html!.match(new RegExp(`class="${className}"`, 'g'))?.length ?? 0).toBe(MAX_VFOR_LENGTH)
  })

  it('does not bound a large-integer v-for outside island renders', async () => {
    const html = await $fetch<string>(`/row-list?rows=${MAX_VFOR_LENGTH + 1}`)
    expect(html.match(/class="row-item"/g)?.length ?? 0).toBe(MAX_VFOR_LENGTH + 1)
  })
})

describe.skipIf(!once)('hash/render input alignment', () => {
  it('ignores data-v-* props so the same hashId yields identical HTML', async () => {
    const plain = await $fetch<NuxtIslandResponse>(islandURLWithHash(JSON.stringify(pureProps), serializeIslandProps(pureProps)))
    const withScopeMarkers = await $fetch<NuxtIslandResponse>(islandURLWithHash(JSON.stringify({ ...pureProps, 'data-v-abc123': '', 'data-v-def456': '' }), serializeIslandProps(pureProps)))

    expect(withScopeMarkers.html).not.toContain('data-v-abc123')
    expect(normaliseIslandHTML(withScopeMarkers.html!)).toBe(normaliseIslandHTML(plain.html!))
  })
})

describe.skipIf(!oncePerServer)('reserved island prop keys', () => {
  // Without `vue.runtimeCompiler` a `template` value is inert, so data that merely contains
  // that key (e.g. CMS content) must still render.
  it('allows a nested template key when the runtime compiler is disabled', async () => {
    const props = { content: { template: 'blog' } }
    const result = await $fetch<NuxtIslandResponse>(islandURL('PureComponent', { props }))
    expect(result.html).toBeTruthy()
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
    expect(result.html).toContain('as: section')
  })
})

describe.skipIf(!oncePerServer)('page-island middleware', () => {
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

  it('honours `redirect` route rules for `page_*` islands', async () => {
    const res = await fetch(islandURL('page_redirected-server-page', {
      context: { url: '/redirected-server-page' },
    }), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/server-page')
    const body = await res.text()
    expect(body).not.toContain('REDIRECTED-PAGE-ISLAND-BODY')
  })

  it('still renders unguarded `page_*` islands', async () => {
    const res = await fetch(islandURL('page_server-page', {
      context: { url: '/server-page' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as NuxtIslandResponse
    expect(body.html).toContain('Hello this is a server page')
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

describe.skipIf(!oncePerServer)('island request headers', () => {
  it('forwards the page request headers to the island subrequest', async () => {
    const html = await $fetch<string>('/island-headers', {
      headers: {
        cookie: 'session=alice',
        authorization: 'Bearer alice-token',
      },
    })

    expect(html).toContain('<span id="page-cookie">session=alice</span>')
    expect(html).toContain('<span id="island-cookie">session=alice</span>')
    expect(html).toContain('<span id="island-authorization">Bearer alice-token</span>')
  })

  it('does not forward headers from a different request', async () => {
    const html = await $fetch<string>('/island-headers', { headers: { cookie: 'session=bob' } })
    expect(html).toContain('<span id="island-cookie">session=bob</span>')
    expect(html).toContain('<span id="island-authorization">none</span>')

    const anonymous = await $fetch<string>('/island-headers')
    expect(anonymous).toContain('<span id="island-cookie">none</span>')
    expect(anonymous).toContain('<span id="island-authorization">none</span>')
  })
})

describe.skipIf(!once)('island head', () => {
  it('applies useHeadSafe rules to the island response', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('SafeHead'))
    expect(result.head.meta).toEqual([
      { name: 'island-trusted-meta', content: 'trusted' },
      { name: 'island-safe-meta', content: 'safe' },
    ])
    expect(result.head.bodyAttrs).toEqual({ class: 'island-safe-body' })
    expect(JSON.stringify(result.head)).not.toContain('__islandUnsafe')
  })

  it('applies useHeadSafe rules to island head when server rendering the page', async () => {
    const html = await $fetch<string>('/island-safe-head')
    expect(html).toContain('<meta name="island-trusted-meta" content="trusted">')
    expect(html).toContain('<meta name="island-safe-meta" content="safe">')
    expect(html).toContain('island-safe-body')
    expect(html).not.toContain('__islandUnsafe')
  })

  it('applies useHeadSafe rules to island head after hydration', async () => {
    const { page } = await renderPage('/island-safe-head')
    await page.locator('#safe-head-island').waitFor()
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => (window as any).__islandUnsafe)).toBeUndefined()
    expect(await page.locator('body').getAttribute('onload')).toBeNull()
    expect(await page.locator('body').getAttribute('class')).toContain('island-safe-body')
    expect(await page.content()).not.toContain('__islandUnsafe')
    await page.close()
  })

  it('applies useHeadSafe rules to island head on client-side navigation', async () => {
    const { page } = await renderPage('/')
    await page.evaluate(() => (window as any).useNuxtApp?.().$router.push('/island-safe-head'))
    await page.locator('#safe-head-island').waitFor()
    await page.waitForFunction(() => document.querySelector('meta[name="island-safe-meta"]'))
    expect(await page.evaluate(() => (window as any).__islandUnsafe)).toBeUndefined()
    expect(await page.locator('body').getAttribute('onload')).toBeNull()
    expect(await page.content()).not.toContain('__islandUnsafe')
    await page.close()
  })
})

describe.skipIf(!oncePerBuild || isDev || isWebpack)('regressions', () => {
  // https://github.com/nuxt/nuxt/issues/26527
  it('renders <Counter nuxt-client /> when nested two levels deep in server components', async () => {
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

    // sample the leaving page's background on every frame of the leave transition
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

describe.skipIf(!oncePerBuild)('rendering matrix', () => {
  it('SSR renders multiple instances of the same island with their own props', async () => {
    const html = await $fetch<string>('/multi')
    expect(html).toContain('block:multi-a x2')
    expect(html).toContain('block:multi-b x5')
    expect(html).toContain('Sugar Counter 12 x 2 = 24')
    expect(html).toContain('Sugar Counter 12 x 5 = 60')
  })

  it('hydrates client components inside islands without mismatches', async () => {
    const { page, consoleLogs } = await renderPage('/hydration')
    await page.locator('#hydration-island .sugar-counter button').waitFor()

    await page.locator('#hydration-island .sugar-counter button').click()
    expect(await page.locator('#hydration-island .sugar-counter').innerText()).toContain('Sugar Counter 13 x 4 = 52')

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

describe.skipIf(!oncePerBuild)('remote islands', () => {
  it('server renders remote islands, and the fallback when the source fails', async () => {
    const html = await $fetch<string>('/remote-island')
    expect(html).toContain('block:remote-static-island x2')
    expect(html).toContain('Sugar Counter 12 x 2 = 24')
    expect(html).toContain('block:remote-interactive-island x3')
    expect(html).toContain('Sugar Counter 12 x 3 = 36')
    expect(html).toContain('Remote island failed: true')
  })

  it.skipIf(!islandsV2)('sends the client path of each chunk the island loads', async () => {
    const result = await $fetch<NuxtIslandResponse>(islandURL('MultiServerCounter', { props: { blockId: 'chunks', multiplier: 1 } }))
    const paths = Object.values(result.chunks ?? {})
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatch(/^\/_nuxt\//)
    expect((await fetch(paths[0]!)).status).toBe(200)
  })

  it('hydrates remote islands, loading client components only when opted in', async () => {
    const { page, consoleLogs } = await renderPage('/remote-island')
    await expectInteractive(page, '#remote-interactive-island .sugar-counter', 'Sugar Counter 13 x 3 = 39')

    const staticCounter = page.locator('#remote-static-island .sugar-counter')
    await staticCounter.locator('button').click()
    expect(await staticCounter.innerText()).toContain('Sugar Counter 12 x 2 = 24')
    expect(await page.locator('#remote-failing-fallback').innerText()).toContain('Remote island failed: true')

    // the legacy implementation reports a mismatch for remote islands
    if (islandsV2) {
      expect(consoleLogs.filter(l => l.text.includes('Hydration'))).toEqual([])
    }
    await page.close()
  })

  it.skipIf(!islandsV2)('hydrates a remote island rendered in a local island\'s page slot', async () => {
    const html = await $fetch<string>('/remote-island')
    expect(html).toContain('block:remote-in-slot-island x4')

    const { page, consoleLogs } = await renderPage('/remote-island')
    await expectInteractive(page, '#remote-in-local-slot .sugar-counter', 'Sugar Counter 13 x 4 = 52')
    expect(await page.locator('#remote-in-local-slot .slot-box').innerText()).toContain('island box content')
    expect(consoleLogs.filter(l => l.type === 'error' || l.text.includes('Hydration'))).toEqual([])
    await page.close()
  })

  it('fetches remote islands during client-side navigation', async () => {
    const { page } = await renderPage('/nav')
    const islandRequest = page.waitForResponse(response => response.url().includes('/__nuxt_island/MultiServerCounter') && response.status() === 200)
    await page.click('#to-remote-island')
    await islandRequest

    await page.locator('#remote-static-island .multi-label').getByText('block:remote-static-island x2').waitFor()
    await expectInteractive(page, '#remote-interactive-island .sugar-counter', 'Sugar Counter 13 x 3 = 39')
    await page.locator('#remote-failing-fallback').getByText('Remote island failed: true').waitFor()
    await page.close()
  })
})

/**
 * Click the counter's button until it reacts, as the remote chunk can load after the page hydrated.
 */
async function expectInteractive (page: Awaited<ReturnType<typeof renderPage>>['page'], selector: string, text: string) {
  const counter = page.locator(selector)
  await expect.poll(async () => {
    if (!(await counter.innerText()).includes(text)) { await counter.locator('button').click() }
    return counter.innerText()
  }, { timeout: 15_000 }).toContain(text)
}

/**
 * Props and joined fallback HTML of a v2 island's own `i:s` outlets named `name`, in the legacy `slots` entry shape.
 */
function readSlotOutlets (result: NuxtIslandResponse, name: string): { props: unknown[], fallback: string } {
  const tuples = [...result.html!.matchAll(new RegExp(`<!--i:s:${result.nonce}(\\[.*?\\])-->`, 'g'))]
    .map(match => JSON.parse(match[1]!) as [string, unknown, string | null, string])
    .filter(([slotName]) => slotName === name)
  return { props: tuples.map(tuple => tuple[1]), fallback: tuples.map(tuple => tuple[3]).join('') }
}

/**
 * Island response without its per-render fields, with normalised HTML and defaulted head arrays.
 */
function normaliseIslandResponse (result: NuxtIslandResponse): NuxtIslandResponse {
  const { id: _id, nonce: _nonce, nonces: _nonces, chunks: _chunks, ...rest } = result
  return { ...rest, head: { link: [], style: [], ...rest.head }, html: normaliseIslandHTML(rest.html ?? '') }
}

/**
 * Island HTML without what differs per render or mode only mechanically: `data-island-uid`
 * (legacy only), `data-island-component` values and v2 marker nonces, JSON-escaped ones included.
 */
function normaliseIslandHTML (html: string): string {
  return html
    .replaceAll(/ data-island-uid(?:="[^"]*")?/g, '')
    .replaceAll(/ data-island-component="[^"]*"/g, ' data-island-component')
    .replaceAll(/(\/?i:[cst]:)[a-z0-9]{16,}/gi, '$1NONCE')
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
