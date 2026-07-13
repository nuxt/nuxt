import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, createPage, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev } from './matrix'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/lazy-route-discovery', import.meta.url)),
  dev: isDev,
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
})

describe('experimental.lazyRouteDiscovery', () => {
  it('server renders all routes', async () => {
    expect(await $fetch<string>('/')).toContain('index-page')
    expect(await $fetch<string>('/about')).toContain('about-page:lazy-about-title')
    expect(await $fetch<string>('/parent/child')).toContain('child-page')
    expect(await $fetch<string>('/dynamic/123')).toContain('dynamic-123')
    expect(await $fetch<string>('/deep/nested/xyz')).toContain('deep-xyz')
    expect(await $fetch<string>('/catchall/a/b/c')).toContain('catchall-a/b/c')
    expect(await $fetch<string>('/opt')).toContain('opt-none')
    expect(await $fetch<string>('/opt/42')).toContain('opt-42')
    expect(await $fetch<string>('/alias-target')).toContain('aliased-page')
    expect(await $fetch<string>('/fn-meta')).toContain('fn-meta:lazy-fn-meta-title')
    expect(await $fetch<string>('/eager')).toContain('eager:eager-page-title')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await fetch('/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('shows a 404 error for unmatched client-side navigations without any network', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    await page.waitForLoadState('networkidle')

    // the stub table is authoritative: blocking every asset proves that no discovery
    // request is needed to distinguish a genuine 404 from an undiscovered route
    await page.route(/\/_nuxt\//, route => route.abort())
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => Promise<unknown> }).push('/definitely-not-a-route').catch(() => {}))
    await page.waitForFunction(() => window.useNuxtApp?.().payload.error?.status === 404)
    await page.unroute(/\/_nuxt\//)
    await page.close()
  })

  it('serves route-rule rendering modes', async () => {
    // prerendered
    expect(await $fetch<string>('/static')).toContain('static-page')
    // swr (cached ssr)
    expect(await $fetch<string>('/swr')).toContain('swr-page')
    expect(await $fetch<string>('/swr')).toContain('swr-page')
    // spa: no ssr content, but the shell is served
    const spaHtml = await $fetch<string>('/spa')
    expect(spaHtml).not.toContain('spa-page')
  })

  it('renders a client-only (ssr: false) page after client-side discovery', async () => {
    const page = await createPage('/spa')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/spa')
    expect(await page.locator('#page').textContent()).toContain('spa-page')
    await page.close()
  })

  it('navigates client-side across rendering modes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    const payloadRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('_payload.json')) {
        payloadRequests.push(request.url())
      }
    })

    await page.locator('#link-static').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/static')
    expect(await page.locator('#page').textContent()).toContain('static-page')

    await page.locator('#link-swr').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/swr')
    expect(await page.locator('#page').textContent()).toContain('swr-page')

    await page.locator('#link-spa').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/spa')
    expect(await page.locator('#page').textContent()).toContain('spa-page')

    // payload extraction still fetches the prerendered payload: /static-hidden has no link,
    // so nothing was prefetched before the listener attached
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => void }).push('/static-hidden'))
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/static-hidden')
    expect(await page.locator('#page').textContent()).toContain('static-hidden-page')
    if (!isDev) {
      expect(payloadRequests.some(url => url.includes('/static-hidden/_payload.json'))).toBe(true)
    }
    await page.close()
  })

  it.skipIf(isDev)('ships a stubbed route table without page meta in the entry chunk', async () => {
    const html = await $fetch<string>('/')
    const entrySrc = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1]
    expect(entrySrc).toBeTruthy()
    const entry = await $fetch<string>(entrySrc!)
    expect(entry).toContain('__nuxtRouteGroup')
    // meta of lazily discoverable pages lives in group chunks, not the entry
    expect(entry).not.toContain('lazy-about-title')
    expect(entry).not.toContain('lazy-fn-meta-title')
    // pages with dynamic matching fields stay in the initial bundle
    expect(entry).toContain('eager-page-title')
  })

  it.skipIf(isDev)('fetches route group chunks on demand for direct navigations', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    // let viewport-triggered prefetching settle
    await page.waitForLoadState('networkidle')

    const jsRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/_nuxt/') && url.includes('.js')) {
        jsRequests.push(url)
      }
    })

    // no link to /catchall/** exists, so its group cannot have been prefetched
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => void }).push('/catchall/a/b'))
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/catchall/a/b')
    expect(await page.locator('#page').textContent()).toContain('catchall-a/b')
    expect(jsRequests.length).toBeGreaterThan(0)

    // a second navigation to the same group loads nothing new
    const requestsAfterFirstNavigation = jsRequests.length
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => void }).push('/catchall/x'))
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/catchall/x')
    expect(jsRequests.length).toBe(requestsAfterFirstNavigation)
    await page.close()
  })

  it('navigates to deeply nested and aliased routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-deep').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/deep/nested/xyz')
    expect(await page.locator('#page').textContent()).toContain('deep-xyz')
    expect(await page.locator('#deep-l1').count()).toBe(1)
    expect(await page.locator('#deep-l2').count()).toBe(1)

    await page.locator('#link-alias').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/alias-target')
    expect(await page.locator('#page').textContent()).toContain('aliased-page')
    await page.close()
  })

  it('resolves non-serializable page meta from the macro chunk after discovery', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-fn-meta').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/fn-meta')
    expect(await page.locator('#page').textContent()).toContain('fn-meta:lazy-fn-meta-title')
    await page.close()
  })

  it('navigates to eager (non-stubbed) pages alongside lazy ones', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-eager').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/eager')
    expect(await page.locator('#page').textContent()).toContain('eager:eager-page-title')

    await page.locator('#link-about').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')
    await page.close()
  })

  it.skipIf(isDev)('emits modulepreload hints for the rendered route\'s group chunk', async () => {
    const html = await $fetch<string>('/about')
    const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(m => m[1]!)
    expect(preloads.length).toBeGreaterThan(0)
    const chunks = await Promise.all(preloads.map(href => $fetch<string>(href).catch(() => '')))
    // the group chunk carrying the route record (and its meta) is preloaded for hydration
    expect(chunks.some(chunk => chunk.includes('lazy-about-title'))).toBe(true)
  })

  it('handles back and forward navigation through discovered routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-about').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    await page.locator('#link-child').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/parent/child')

    await page.goBack()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')

    await page.goBack()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    expect(await page.locator('#page').textContent()).toContain('index-page')

    await page.goForward()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')
    await page.close()
  })

  it.skipIf(isDev)('recovers when a group chunk fails to load', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    await page.waitForLoadState('networkidle')

    // block the undiscovered group chunk for /catchall/**
    await page.route(/\/_nuxt\/.*\.js/, route => route.abort())
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => Promise<unknown> }).push('/catchall/blocked').catch(() => {}))
    // the navigation fails but the app stays on the current route
    await page.waitForTimeout(500)

    // unblock: the chunk-error plugin may have triggered a full reload while assets were
    // still blocked, so reload to a known-good state and verify discovery works again
    await page.unroute(/\/_nuxt\/.*\.js/)
    await page.reload()
    await page.waitForFunction(() => !!window.useNuxtApp?.())
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => Promise<unknown> }).push('/catchall/retried').catch(() => {}))
    await page.waitForFunction(() => document.querySelector('#page')?.textContent?.includes('catchall-retried'))
    await page.close()
  })

  it('applies layouts from lazily discovered route meta', async () => {
    // ssr: layouts resolved from the full server table
    const one = await $fetch<string>('/nested/one')
    expect(one).toContain('id="layout-custom"')
    expect(one).toContain('nested-one')
    const two = await $fetch<string>('/nested/two')
    expect(two).toContain('id="layout-default"')
    expect(two).toContain('nested-two')
  })

  it('switches layouts when navigating between lazily discovered nested routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    expect(await page.locator('#layout-default').count()).toBe(1)

    // custom layout comes from the discovered child's meta
    await page.locator('#link-nested-one').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/nested/one')
    await page.waitForSelector('#layout-custom')
    expect(await page.locator('#page').textContent()).toContain('nested-one')

    // sibling child switches back to the default layout
    await page.locator('#link-nested-two').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/nested/two')
    await page.waitForSelector('#layout-default')
    expect(await page.locator('#page').textContent()).toContain('nested-two')
    await page.close()
  })

  it('applies route-rules middleware to lazily discovered routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-rules-mw').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/rules-mw')
    expect(await page.locator('#page').textContent()).toContain('rules-mw:tracked-true')
    await page.close()
  })

  it('supports module-duplicated localized routes (i18n prefix pattern)', async () => {
    // routes added by a module via `pages:extend` are stubbed like scanned pages
    expect(await $fetch<string>('/fa/about')).toContain('about-page:lazy-about-title')
    expect(await $fetch<string>('/fa/parent/child')).toContain('child-page')

    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    // `localePath`-style navigation: by suffixed route name, before discovery
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: unknown) => Promise<unknown> }).push({ name: 'about___fa' }))
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/fa/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')
    await page.close()
  })

  it('streams SSR for routes with `streaming: true` and hydrates through discovery', async () => {
    const html = await $fetch<string>('/streamed')
    expect(html).toContain('streamed-page')

    // direct load of a streamed route: hydration discovers the group without preload hints
    const direct = await createPage('/streamed')
    await direct.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/streamed')
    expect(await direct.locator('#page').textContent()).toContain('streamed-page')
    await direct.close()

    // client-side navigation into a streamed route behaves like any other
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    await page.locator('#link-streamed').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/streamed')
    expect(await page.locator('#page').textContent()).toContain('streamed-page')
    await page.close()
  })

  it('renders server-component (island) pages through discovered groups', async () => {
    expect(await $fetch<string>('/island')).toContain('island-page')

    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    await page.locator('#link-island').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/island')
    await page.waitForFunction(() => document.querySelector('#page')?.textContent?.includes('island-page'))
    await page.close()
  })

  it('renders named views from discovered groups', async () => {
    const html = await $fetch<string>('/withviews')
    expect(html).toContain('withviews-default')
    expect(html).toContain('withviews-aside')

    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    await page.locator('#link-withviews').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/withviews')
    expect(await page.locator('#page').textContent()).toContain('withviews-default')
    expect(await page.locator('#aside-view').textContent()).toContain('withviews-aside')
    await page.close()
  })

  it('restores scroll position when navigating back through discovered routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.evaluate(() => window.scrollTo(0, 1500))
    await page.waitForFunction(() => window.scrollY > 1000)

    // navigate programmatically: clicking would scroll the link into view first,
    // clobbering the scroll position the router should save
    await page.evaluate(() => (window.useNuxtApp?.().$router as { push: (to: string) => Promise<unknown> }).push('/about'))
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')

    await page.goBack()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')
    await page.waitForFunction(() => window.scrollY > 1000)
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThanOrEqual(1400)
    await page.close()
  })

  it('navigates client-side to a lazily discovered route', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-about').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')
    await page.close()
  })

  it('navigates to nested and dynamic routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-child').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/parent/child')
    expect(await page.locator('#page').textContent()).toContain('child-page')

    await page.locator('#link-dynamic').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/dynamic/123')
    expect(await page.locator('#page').textContent()).toContain('dynamic-123')
    await page.close()
  })

  it('runs route middleware on lazily discovered routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-named').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/named')
    expect(await page.locator('#page').textContent()).toContain('named-page:tracked-true')
    await page.close()
  })

  it('navigates by route name to an undiscovered route', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-by-name').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')
    await page.close()
  })

  it('follows redirects declared on undiscovered routes', async () => {
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.locator('#link-old').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/about')
    expect(await page.locator('#page').textContent()).toContain('about-page:lazy-about-title')
    await page.close()
  })
})
